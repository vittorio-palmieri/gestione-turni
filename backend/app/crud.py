from __future__ import annotations

from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
from . import models


def get_or_create_week(db: Session, monday: date) -> models.Week:
    week = db.query(models.Week).filter(models.Week.monday_date == monday).one_or_none()
    if week:
        return week
    week = models.Week(monday_date=monday)
    db.add(week)
    db.commit()
    db.refresh(week)
    return week


def set_cell(db: Session, week: models.Week, day_index: int, shift_id: str, person_id: str | None):
    cell = db.query(models.Assignment).filter(
        and_(
            models.Assignment.week_id == week.id,
            models.Assignment.day_index == day_index,
            models.Assignment.shift_id == shift_id
        )
    ).one_or_none()

    if cell is None:
        db.add(models.Assignment(
            week_id=week.id,
            day_index=day_index,
            shift_id=shift_id,
            person_id=person_id
        ))
    else:
        cell.person_id = person_id

    db.commit()


def clear_week(db: Session, week: models.Week):
    db.query(models.Assignment).filter(models.Assignment.week_id == week.id).delete()
    db.commit()


def copy_week(db: Session, src_week: models.Week, dst_week: models.Week):
    clear_week(db, dst_week)
    src_cells = db.query(models.Assignment).filter(models.Assignment.week_id == src_week.id).all()
    for c in src_cells:
        db.add(models.Assignment(
            week_id=dst_week.id,
            day_index=c.day_index,
            shift_id=c.shift_id,
            person_id=c.person_id
        ))
    db.commit()


# -------- ROTAZIONE 8 GIORNI (riposo/permesso) ----------
def _rot_kind(person: models.Person, day_date: date) -> str | None:
    base = getattr(person, "rotation_base_riposo_date", None)
    if not base:
        return None
    diff = (day_date - base).days
    mod = diff % 8
    if mod == 0:
        return "RIPOSO"
    if mod == 1:
        return "PERMESSO"
    return None


def build_grid_and_alerts(db: Session, week: models.Week):
    monday_date = week.monday_date

    shifts = db.query(models.Shift).order_by(models.Shift.sort_order).all()
    people_active = db.query(models.Person).filter(models.Person.is_active == True).order_by(models.Person.full_name).all()

    grid: dict[int, dict[str, str | None]] = {d: {s.id: None for s in shifts} for d in range(7)}

    cells = db.query(models.Assignment).filter(models.Assignment.week_id == week.id).all()
    for c in cells:
        if 0 <= c.day_index <= 6 and c.shift_id in grid[c.day_index]:
            grid[c.day_index][c.shift_id] = c.person_id

    duplicates: dict[int, list] = {d: [] for d in range(7)}
    not_planned: dict[int, list[str]] = {d: [] for d in range(7)}
    riposo_saltato: dict[int, list] = {d: [] for d in range(7)}
    permesso_saltato: dict[int, list] = {d: [] for d in range(7)}
    extra_absence_saltata: dict[int, list] = {d: [] for d in range(7)}  # FERIE/MALATTIA/INFORTUNIO pianificata

    active_ids = [p.id for p in people_active]
    shift_name_by_id = {s.id: s.name for s in shifts}

    # extra absences nella settimana (boccanti)
    week_start = monday_date
    week_end = monday_date + timedelta(days=6)
    extra_rows = db.query(models.ExtraAbsence).filter(
        models.ExtraAbsence.start_date <= week_end,
        models.ExtraAbsence.end_date >= week_start
    ).all()

    extra_by_day: dict[int, dict[str, str]] = {d: {} for d in range(7)}  # day -> {person_id: kind}
    for r in extra_rows:
        for d in range(7):
            day_date = monday_date + timedelta(days=d)
            if r.start_date <= day_date <= r.end_date:
                extra_by_day[d][r.person_id] = r.kind

    # rotazione riposi/permessi per settimana
    rot_by_day: dict[int, dict[str, str]] = {d: {} for d in range(7)}
    for p in people_active:
        for d in range(7):
            kind = _rot_kind(p, monday_date + timedelta(days=d))
            if kind:
                rot_by_day[d][p.id] = kind

    for d in range(7):
        assigned = [pid for pid in grid[d].values() if pid is not None]

        # Doppioni
        counts: dict[str, int] = {}
        for pid in assigned:
            counts[pid] = counts.get(pid, 0) + 1
        for pid, cnt in counts.items():
            if cnt >= 2:
                duplicates[d].append({"person_id": pid, "count": cnt})

        # Riposo/permesso/extra saltati (pianificato durante assenza)
        for shift_id, pid in grid[d].items():
            if not pid:
                continue

            # extra blocca (ferie/malattia/infortunio)
            extra_kind = extra_by_day[d].get(pid)
            if extra_kind:
                extra_absence_saltata[d].append({
                    "person_id": pid,
                    "kind": extra_kind,
                    "shift_id": shift_id,
                    "shift_name": shift_name_by_id.get(shift_id, ""),
                })
                continue

            # riposo/permesso (warning)
            rot_kind = rot_by_day[d].get(pid)
            if rot_kind == "RIPOSO":
                riposo_saltato[d].append({
                    "person_id": pid,
                    "shift_id": shift_id,
                    "shift_name": shift_name_by_id.get(shift_id, "")
                })
            elif rot_kind == "PERMESSO":
                permesso_saltato[d].append({
                    "person_id": pid,
                    "shift_id": shift_id,
                    "shift_name": shift_name_by_id.get(shift_id, "")
                })

        # Non pianificati: escludi chi è assente (rotazione o extra)
        assigned_set = set(assigned)
        not_planned[d] = [
            pid for pid in active_ids
            if pid not in assigned_set and pid not in rot_by_day[d] and pid not in extra_by_day[d]
        ]

    alerts = {
        "duplicates": duplicates,
        "not_planned": not_planned,
        "riposo_saltato": riposo_saltato,
        "permesso_saltato": permesso_saltato,
        "extra_absence_saltata": extra_absence_saltata,
    }

    return shifts, people_active, grid, alerts