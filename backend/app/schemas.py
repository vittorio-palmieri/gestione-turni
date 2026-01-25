from __future__ import annotations

from datetime import date, time
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict


# -------------------------
# AUTH
# -------------------------
class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginIn(BaseModel):
    email: str
    password: str


# -------------------------
# PEOPLE
# -------------------------
class PersonIn(BaseModel):
    full_name: str
    notes: Optional[str] = None


class PersonUpdate(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class PersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    is_active: bool
    notes: Optional[str] = None

    rotation_base_riposo_date: Optional[date] = None


class RotationIn(BaseModel):
    base_riposo_date: date  # es: 2026-01-18


# -------------------------
# SHIFTS
# -------------------------
class ShiftOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    sort_order: int
    notes: Optional[str] = None


class ShiftCreate(BaseModel):
    name: str
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    notes: Optional[str] = None


class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    notes: Optional[str] = None


# -------------------------
# EXTRA ABSENCES (BLOCCANTI)
# -------------------------
class ExtraAbsenceIn(BaseModel):
    person_id: str
    kind: str            # "FERIE" | "MALATTIA" | "INFORTUNIO"
    start_date: date
    end_date: date
    notes: Optional[str] = None


class ExtraAbsenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    person_id: str
    kind: str
    start_date: date
    end_date: date
    notes: Optional[str] = None


# -------------------------
# PLANNING
# -------------------------
class CellUpdateIn(BaseModel):
    day_index: int
    shift_id: str
    person_id: Optional[str] = None


class PlanOut(BaseModel):
    monday_date: date
    shifts: List[ShiftOut]
    people: List[PersonOut]
    grid: Dict[int, Dict[str, Optional[str]]]
    alerts: Dict