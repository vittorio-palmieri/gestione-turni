from __future__ import annotations

from uuid import uuid4
from datetime import date

from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Date,
    Time,
    Text,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .db import Base


def gen_id() -> str:
    return str(uuid4())


# =========================
# AUTH
# =========================
class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)


# =========================
# PEOPLE
# =========================
class Person(Base):
    __tablename__ = "people"

    id = Column(String, primary_key=True, default=gen_id)
    full_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)

    # Rotazione 8 giorni: base = data RIPOSO
    rotation_base_riposo_date = Column(Date, nullable=True)


# =========================
# SHIFTS
# =========================
class Shift(Base):
    __tablename__ = "shifts"

    id = Column(String, primary_key=True, default=gen_id)

    name = Column(String, nullable=False)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    notes = Column(Text, nullable=True)

    # usato in: db.query(models.Shift).order_by(models.Shift.sort_order)
    sort_order = Column(Integer, default=0, nullable=False)


# =========================
# WEEKS
# =========================
class Week(Base):
    __tablename__ = "weeks"

    id = Column(String, primary_key=True, default=gen_id)

    # univoca per settimana
    monday_date = Column(Date, unique=True, index=True, nullable=False)


# =========================
# ASSIGNMENTS (planning cell: week + day + shift -> person)
# =========================
class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        UniqueConstraint("week_id", "day_index", "shift_id", name="uq_assignment_cell"),
    )

    id = Column(String, primary_key=True, default=gen_id)

    week_id = Column(String, ForeignKey("weeks.id", ondelete="CASCADE"), nullable=False)
    day_index = Column(Integer, nullable=False)  # 0..6
    shift_id = Column(String, ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False)

    # NOTA: nel DB potrebbe essere NOT NULL in alcune versioni.
    # Il nostro CRUD cancella la riga quando person_id è None.
    person_id = Column(String, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)

    week = relationship("Week")
    shift = relationship("Shift")
    person = relationship("Person")


# =========================
# ASSIGNMENT META (orari override + apertura/chiusura)
# =========================
class AssignmentMeta(Base):
    __tablename__ = "assignment_meta"
    __table_args__ = (
        UniqueConstraint("week_id", "day_index", "shift_id", name="uq_assignment_meta_cell"),
    )

    id = Column(String, primary_key=True, default=gen_id)

    week_id = Column(String, ForeignKey("weeks.id", ondelete="CASCADE"), nullable=False)
    day_index = Column(Integer, nullable=False)  # 0..6
    shift_id = Column(String, ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False)

    override_start_time = Column(Time, nullable=True)
    override_end_time = Column(Time, nullable=True)

    # "APERTURA" | "CHIUSURA" | None
    role = Column(String, nullable=True)

    week = relationship("Week")
    shift = relationship("Shift")


# =========================
# EXTRA ABSENCES (ferie/malattia/infortunio) - BLOCCANTI
# =========================
class ExtraAbsence(Base):
    __tablename__ = "extra_absences"

    id = Column(String, primary_key=True, default=gen_id)

    person_id = Column(String, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    kind = Column(String, nullable=False)  # FERIE / MALATTIA / INFORTUNIO
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    notes = Column(Text, nullable=True)

    person = relationship("Person")