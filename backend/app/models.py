from sqlalchemy import Column, String, Boolean, Date, Integer, ForeignKey, Text, Time, UniqueConstraint
from sqlalchemy.orm import relationship
from uuid import uuid4

from .db import Base


def gen_id():
    return str(uuid4())


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_id)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)


class Person(Base):
    __tablename__ = "people"
    id = Column(String, primary_key=True, default=gen_id)
    full_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)

    # Rotazione 8 giorni: base = data di RIPOSO
    rotation_base_riposo_date = Column(Date, nullable=True)


class Shift(Base):
    __tablename__ = "shifts"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)

    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)

    notes = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)


class Week(Base):
    __tablename__ = "weeks"
    id = Column(String, primary_key=True, default=gen_id)
    monday_date = Column(Date, unique=True, nullable=False)


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (UniqueConstraint("week_id", "day_index", "shift_id", name="uq_assignment_cell"),)

    id = Column(String, primary_key=True, default=gen_id)
    week_id = Column(String, ForeignKey("weeks.id"), nullable=False)
    day_index = Column(Integer, nullable=False)  # 0=Lun … 6=Dom
    shift_id = Column(String, ForeignKey("shifts.id"), nullable=False)
    person_id = Column(String, ForeignKey("people.id"), nullable=True)


class AssignmentMeta(Base):
    """
    Metadati della cella (week+day+shift):
    - override orari (start/end) per quel giorno
    - ruolo APERTURA/CHIUSURA
    """
    __tablename__ = "assignment_meta"
    __table_args__ = (UniqueConstraint("week_id", "day_index", "shift_id", name="uq_assignment_meta_cell"),)

    id = Column(String, primary_key=True, default=gen_id)
    week_id = Column(String, ForeignKey("weeks.id"), nullable=False)
    day_index = Column(Integer, nullable=False)
    shift_id = Column(String, ForeignKey("shifts.id"), nullable=False)

    override_start_time = Column(Time, nullable=True)
    override_end_time = Column(Time, nullable=True)
    role = Column(String, nullable=True)  # "APERTURA" | "CHIUSURA" | None


class ExtraAbsence(Base):
    __tablename__ = "extra_absences"
    id = Column(String, primary_key=True, default=gen_id)
    person_id = Column(String, ForeignKey("people.id"), nullable=False)

    kind = Column(String, nullable=False)  # FERIE / MALATTIA / INFORTUNIO
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    notes = Column(Text, nullable=True)