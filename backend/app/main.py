from datetime import date, datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt, JWTError
from pydantic_settings import BaseSettings
from sqlalchemy.orm import Session

from . import models, schemas, auth, seed, crud
from .db import make_engine, make_session_local, Base


# =========================
# SETTINGS
# =========================
class Settings(BaseSettings):
    ENV: str = "dev"
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_EXPIRES_MIN: int = 720
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    BOOTSTRAP_ADMIN_EMAIL: str
    BOOTSTRAP_ADMIN_PASSWORD: str


settings = Settings()

engine = make_engine(settings.DATABASE_URL)
SessionLocal = make_session_local(engine)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Gestione Turni API")

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
if not origins:
    origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# DB
# =========================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# AUTH
# =========================
oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/token")


def require_user(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> models.User:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        uid = payload.get("sub")
        if not uid:
            raise HTTPException(status_code=401, detail="Token non valido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token non valido")

    user = db.get(models.User, uid)
    if not user:
        raise HTTPException(status_code=401, detail="Utente non trovato")
    return user


def parse_date(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


# -------------------------
# AUTH endpoints (Swagger -> Authorize)
# -------------------------
@app.post("/auth/bootstrap-admin")
def bootstrap_admin(db: Session = Depends(get_db)):
    if settings.ENV != "dev":
        raise HTTPException(status_code=403, detail="bootstrap-admin disabilitato in produzione")

    existing = db.query(models.User).filter(models.User.email == settings.BOOTSTRAP_ADMIN_EMAIL).one_or_none()
    if existing:
        return {"status": "exists", "email": existing.email}

    u = models.User(
        email=settings.BOOTSTRAP_ADMIN_EMAIL,
        password_hash=auth.hash_password(settings.BOOTSTRAP_ADMIN_PASSWORD),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"status": "created", "email": u.email}


@app.post("/auth/login", response_model=schemas.TokenOut)
def login(payload: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).one_or_none()
    if not user or not auth.verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    token = auth.create_access_token(
        subject=user.id,
        secret=settings.JWT_SECRET,
        expires_minutes=settings.JWT_EXPIRES_MIN,
    )
    return schemas.TokenOut(access_token=token)


@app.post("/auth/token", response_model=schemas.TokenOut)
def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form.username).one_or_none()
    if not user or not auth.verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    token = auth.create_access_token(
        subject=user.id,
        secret=settings.JWT_SECRET,
        expires_minutes=settings.JWT_EXPIRES_MIN,
    )
    return schemas.TokenOut(access_token=token)


# =========================
# PEOPLE
# =========================
@app.get("/people", response_model=list[schemas.PersonOut])
def list_people(db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    return db.query(models.Person).order_by(models.Person.full_name).all()


@app.post("/people", response_model=schemas.PersonOut)
def create_person(p: schemas.PersonIn, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    person = models.Person(full_name=p.full_name, notes=p.notes)
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


@app.put("/people/{person_id}", response_model=schemas.PersonOut)
def update_person(person_id: str, upd: schemas.PersonUpdate, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    person = db.get(models.Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Persona non trovata")

    if upd.full_name is not None:
        person.full_name = upd.full_name
    if upd.is_active is not None:
        person.is_active = upd.is_active
    if upd.notes is not None:
        person.notes = upd.notes

    db.commit()
    db.refresh(person)
    return person


@app.put("/people/{person_id}/rotation", response_model=schemas.PersonOut)
def set_rotation(person_id: str, payload: schemas.RotationIn, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    person = db.get(models.Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Persona non trovata")

    person.rotation_base_riposo_date = payload.base_riposo_date
    db.commit()
    db.refresh(person)
    return person


# =========================
# SHIFTS
# =========================
@app.post("/shifts", response_model=schemas.ShiftOut)
def create_shift(payload: schemas.ShiftCreate, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    max_order = db.query(models.Shift.sort_order).order_by(models.Shift.sort_order.desc()).first()
    next_order = (max_order[0] if max_order else 0) + 1

    shift = models.Shift(
        name=payload.name,
        start_time=payload.start_time,
        end_time=payload.end_time,
        notes=payload.notes,
        sort_order=next_order,
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


@app.get("/shifts", response_model=list[schemas.ShiftOut])
def list_shifts(db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    return db.query(models.Shift).order_by(models.Shift.sort_order).all()


@app.put("/shifts/{shift_id}", response_model=schemas.ShiftOut)
def update_shift(shift_id: str, upd: schemas.ShiftUpdate, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    shift = db.get(models.Shift, shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="Turno non trovato")

    if upd.name is not None:
        shift.name = upd.name
    if upd.start_time is not None:
        shift.start_time = upd.start_time
    if upd.end_time is not None:
        shift.end_time = upd.end_time
    if upd.notes is not None:
        shift.notes = upd.notes

    db.commit()
    db.refresh(shift)
    return shift


@app.delete("/shifts/{shift_id}")
def delete_shift(shift_id: str, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    shift = db.get(models.Shift, shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="Turno non trovato")

    used = db.query(models.Assignment).filter(models.Assignment.shift_id == shift_id).first()
    if used:
        raise HTTPException(status_code=409, detail="Turno già usato in una pianificazione: non posso eliminarlo.")

    db.delete(shift)
    db.commit()
    return {"status": "deleted"}


# =========================
# EXTRA ABSENCES (FERIE/MALATTIA/INFORTUNIO)
# =========================
@app.post("/absences", response_model=schemas.ExtraAbsenceOut)
def create_absence(payload: schemas.ExtraAbsenceIn, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    kind = payload.kind.upper().strip()
    if kind not in ["FERIE", "MALATTIA", "INFORTUNIO"]:
        raise HTTPException(status_code=400, detail="kind deve essere FERIE/MALATTIA/INFORTUNIO")
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="end_date deve essere >= start_date")

    person = db.get(models.Person, payload.person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Persona non trovata")

    row = models.ExtraAbsence(
        person_id=payload.person_id,
        kind=kind,
        start_date=payload.start_date,
        end_date=payload.end_date,
        notes=payload.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.get("/absences", response_model=list[schemas.ExtraAbsenceOut])
def list_absences(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_user),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
):
    q = db.query(models.ExtraAbsence)
    if date_from:
        q = q.filter(models.ExtraAbsence.end_date >= date_from)
    if date_to:
        q = q.filter(models.ExtraAbsence.start_date <= date_to)
    return q.order_by(models.ExtraAbsence.start_date.desc()).all()


@app.delete("/absences/{absence_id}")
def delete_absence(absence_id: str, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    row = db.get(models.ExtraAbsence, absence_id)
    if not row:
        raise HTTPException(status_code=404, detail="Assenza non trovata")
    db.delete(row)
    db.commit()
    return {"status": "deleted"}


# =========================
# WEEKS / PLANNING
# =========================
@app.get("/weeks/{monday}/plan", response_model=schemas.PlanOut)
def get_plan(monday: str, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    monday_date = parse_date(monday)
    week = crud.get_or_create_week(db, monday_date)
    shifts, people_active, grid, alerts = crud.build_grid_and_alerts(db, week)

    # ✅ anti-crash: struttura sempre completa
    for d in range(7):
        grid.setdefault(d, {})
    alerts.setdefault("duplicates", {d: [] for d in range(7)})
    alerts.setdefault("not_planned", {d: [] for d in range(7)})
    alerts.setdefault("riposo_saltato", {d: [] for d in range(7)})
    alerts.setdefault("permesso_saltato", {d: [] for d in range(7)})
    alerts.setdefault("extra_absence_saltata", {d: [] for d in range(7)})

    return schemas.PlanOut(
        monday_date=monday_date,
        shifts=shifts,
        people=people_active,
        grid=grid,
        alerts=alerts,
    )


@app.put("/weeks/{monday}/cell")
def put_cell(monday: str, payload: schemas.CellUpdateIn, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    if not (0 <= payload.day_index <= 6):
        raise HTTPException(status_code=400, detail="day_index deve essere 0..6")
    week = crud.get_or_create_week(db, parse_date(monday))
    crud.set_cell(db, week, payload.day_index, payload.shift_id, payload.person_id)
    return {"status": "ok"}


@app.post("/weeks/{monday}/clear")
def clear_week(monday: str, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    week = crud.get_or_create_week(db, parse_date(monday))
    crud.clear_week(db, week)
    return {"status": "cleared"}


@app.post("/weeks/{monday}/copy-from/{prev_monday}")
def copy_from(monday: str, prev_monday: str, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    dst = crud.get_or_create_week(db, parse_date(monday))
    src = crud.get_or_create_week(db, parse_date(prev_monday))
    crud.copy_week(db, src, dst)
    return {"status": "copied"}


@app.get("/weeks/{monday}/absences")
def get_absences(monday: str, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    monday_date = parse_date(monday)

    # sempre strutture complete
    riposi = {d: [] for d in range(7)}
    permessi = {d: [] for d in range(7)}
    extra = {d: {} for d in range(7)}

    # riposi/permessi calcolati via rotazione (se già implementati altrove li rimetterai)
    people = db.query(models.Person).filter(models.Person.is_active == True).all()
    for p in people:
        if not p.rotation_base_riposo_date:
            continue
        for d in range(7):
            day_date = monday_date + timedelta(days=d)
            diff = (day_date - p.rotation_base_riposo_date).days
            mod = diff % 8
            if mod == 0:
                riposi[d].append(p.id)
            elif mod == 1:
                permessi[d].append(p.id)

    # extra (ferie/malattia/infortunio)
    week_start = monday_date
    week_end = monday_date + timedelta(days=6)
    rows = db.query(models.ExtraAbsence).filter(
        models.ExtraAbsence.start_date <= week_end,
        models.ExtraAbsence.end_date >= week_start
    ).all()

    for r in rows:
        for d in range(7):
            day_date = monday_date + timedelta(days=d)
            if r.start_date <= day_date <= r.end_date:
                extra[d][r.person_id] = r.kind

    return {"monday_date": str(monday_date), "riposi": riposi, "permessi": permessi, "extra": extra}