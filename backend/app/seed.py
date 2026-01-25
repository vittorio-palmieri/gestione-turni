from sqlalchemy.orm import Session
from . import models

def seed_shifts_if_missing(db: Session) -> int:
    existing_orders = {s.sort_order for s in db.query(models.Shift).all()}
    created = 0
    for i in range(1, 11):
        if i in existing_orders:
            continue
        db.add(models.Shift(name=f"Turno {i}", sort_order=i))
        created += 1
    if created:
        db.commit()
    return created
