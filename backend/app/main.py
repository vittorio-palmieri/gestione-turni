from datetime import date, datetime, timedelta
from io import BytesIO
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
from jose import jwt, JWTError
from pydantic_settings import BaseSettings
from sqlalchemy.orm import Session

from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

from . import models, schemas, auth, crud
from .db import make_engine, make_session_local, Base


# =========================
# SETTINGS
# =========================
class Settings(BaseSettings):
    ENV: str = "dev"
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_EXPIRES_MIN: int = 720
    CORS_ORIGINS: str = "*"
    BOOTSTRAP_ADMIN_EMAIL: str
    BOOTSTRAP_ADMIN_PASSWORD: str


settings = Settings()

engine = make_engine(settings.DATABASE_URL)
SessionLocal = make_session_local(engine)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Gestione Turni API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


def decode_token(token: str, db: Session) -> models.User:
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


def require_user(token: str = Depends(oauth2), db: Session = Depends(get_db)):
    return decode_token(token, db)


def get_bearer_token(request: Request) -> Optional[str]:
    authz = request.headers.get("Authorization")
    if not authz:
        return None
    parts = authz.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def parse_date(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


# =========================
# AUTH ENDPOINTS
# =========================
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
    return {"access_token": token}


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
    return {"access_token": token}


# =========================
# PEOPLE
# =========================
@app.get("/people", response_model=list[schemas.PersonOut])
def get_people(db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    return db.query(models.Person).order_by(models.Person.full_name).all()


@app.post("/people", response_model=schemas.PersonOut)
def create_person(p: schemas.PersonIn, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    row = models.Person(full_name=p.full_name, notes=p.notes)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


# =========================
# SHIFTS
# =========================
@app.get("/shifts", response_model=list[schemas.ShiftOut])
def get_shifts(db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    return db.query(models.Shift).order_by(models.Shift.sort_order).all()


@app.post("/shifts", response_model=schemas.ShiftOut)
def create_shift(p: schemas.ShiftCreate, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    row = models.Shift(
        name=p.name,
        start_time=p.start_time,
        end_time=p.end_time,
        notes=p.notes,
        sort_order=0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


# =========================
# ABSENCES (FIX 500)
# =========================
@app.get("/absences", response_model=list[schemas.ExtraAbsenceOut])
def list_absences(db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    return db.query(models.ExtraAbsence).order_by(models.ExtraAbsence.start_date.desc()).all()


@app.post("/absences", response_model=schemas.ExtraAbsenceOut)
def create_absence(p: schemas.ExtraAbsenceIn, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    row = models.ExtraAbsence(
        person_id=p.person_id,
        kind=p.kind,
        start_date=p.start_date,
        end_date=p.end_date,
        notes=p.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


# =========================
# PLANNING
# =========================
@app.get("/weeks/{monday}/plan")
def get_plan(monday: str, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    week = crud.get_or_create_week(db, parse_date(monday))
    shifts, people, grid, alerts = crud.build_grid_and_alerts(db, week)
    return {
        "monday_date": monday,
        "shifts": shifts,
        "people": people,
        "grid": grid,
        "alerts": alerts,
    }


@app.put("/weeks/{monday}/cell")
def put_cell(
    monday: str,
    payload: schemas.CellUpdateIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_user),
):
    week = crud.get_or_create_week(db, parse_date(monday))
    crud.set_cell(db, week, payload.day_index, payload.shift_id, payload.person_id)
    return {"status": "ok"}


@app.post("/weeks/{monday}/clear")
def clear_week(monday: str, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    week = crud.get_or_create_week(db, parse_date(monday))
    crud.clear_week(db, week)
    return {"status": "cleared"}


# =========================
# EXPORT PDF (TOKEN SAFE)
# =========================
@app.get("/weeks/{monday}/export.pdf")
def export_pdf(
    monday: str,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    _ = decode_token(token, db)

    monday_date = parse_date(monday)
    week = crud.get_or_create_week(db, monday_date)
    shifts, people, grid, _alerts = crud.build_grid_and_alerts(db, week)

    people_by_id = {p.id: p.full_name for p in people}
    days = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]

    headers = ["Turno"] + [
        f"{days[i]} {(monday_date + timedelta(days=i)).strftime('%d/%m')}"
        for i in range(7)
    ]

    data = [headers]
    for s in shifts:
        row = [s.name]
        for d in range(7):
            pid = grid.get(d, {}).get(s.id)
            row.append(people_by_id.get(pid, "") if pid else "")
        data.append(row)

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4))
    styles = getSampleStyleSheet()
    story = [Paragraph("Pianificazione Turni", styles["Title"]), Spacer(1, 12)]
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
        ("BACKGROUND", (0,0), (-1,0), colors.lightgrey),
    ]))
    story.append(table)
    doc.build(story)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="turni_{monday}.pdf"'},
    )