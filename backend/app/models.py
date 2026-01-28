import uuid
from datetime import datetime, timezone, date, time

from sqlalchemy import (
    String, Boolean, Text, DateTime, Date, Time, Integer, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid():
    return str(uuid.uuid4())


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Person(Base):
    __tablename__ = "people"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    full_name: Mapped[str] = mapped_column(String)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Rotazione 8 giorni: base = data di RIPOSO
    rotation_base_riposo_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class Shift(Base):
    __tablename__ = "shifts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Week(Base):
    __tablename__ = "weeks"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    monday_date: Mapped[date] = mapped_column(Date, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (UniqueConstraint("week_id", "day_index", "shift_id", name="uq_assignment_cell"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    week_id: Mapped[str] = mapped_column(String, ForeignKey("weeks.id", ondelete="CASCADE"))
    day_index: Mapped[int] = mapped_column(Integer)  # 0..6
    shift_id: Mapped[str] = mapped_column(String, ForeignKey("shifts.id", ondelete="CASCADE"))
    person_id: Mapped[str | None] = mapped_column(String, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    week = relationship("Week")
    shift = relationship("Shift")
    person = relationship("Person")


class AssignmentMeta(Base):
    """
    Metadati della cella (week + day + shift) per:
    - orari override (inizio/fine variabili per quel giorno)
    - ruolo (APERTURA / CHIUSURA)
    """
    __tablename__ = "assignment_meta"
    __table_args__ = (UniqueConstraint("week_id", "day_index", "shift_id", name="uq_assignment_meta_cell"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    week_id: Mapped[str] = mapped_column(String, ForeignKey("weeks.id", ondelete="CASCADE"))
    day_index: Mapped[int] = mapped_column(Integer)  # 0..6
    shift_id: Mapped[str] = mapped_column(String, ForeignKey("shifts.id", ondelete="CASCADE"))

    override_start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    override_end_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    # "APERTURA" | "CHIUSURA" | None
    role: Mapped[str | None] = mapped_column(String, nullable=True)

    week = relationship("Week")
    shift = relationship("Shift")


class ExtraAbsence(Base):
    """
    Assenze BLOCCANTI: FERIE / MALATTIA / INFORTUNIO
    """
    __tablename__ = "extra_absences"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)

    person_id: Mapped[str] = mapped_column(String, ForeignKey("people.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String)  # FERIE | MALATTIA | INFORTUNIO
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    person = relationship("Person")