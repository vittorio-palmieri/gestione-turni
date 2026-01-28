from __future__ import annotations

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
from sqlalchemy.exc import SQLAlchemyError

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
    CORS_ORIGINS: str = "http://localhost:3000,https://gestione-turni-ten.vercel.app"
    BOOTSTRAP_ADMIN_EMAIL: str
    BOOTSTRAP_ADMIN_PASSWORD: str


settings = Settings()

engine = make_engine(settings.DATABASE_URL)
SessionLocal = make_session_local(engine)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Gestione Turni API")

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
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


def require_user_from_query(token: str, db: Session) -> models.User:
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


# =========================
# AUTH ENDPOINTS
# =========================
@app.post("/auth/bootstrap-admin")
def bootstrap_admin(db: Session = Depends(get_db)):
    if settings.ENV != "dev":
        raise HTTPException(status_code=403, detail="Disabilitato")

    u = db.query(models.User).filter(models.User.email == settings.BOOTSTRAP_ADMIN_EMAIL).one_or_none()
    if u:
        return {"status": "exists"}

    u = models.User(
        email=settings.BOOTSTRAP_ADMIN_EMAIL,
        password_hash=auth.hash_password(settings.BOOTSTRAP_ADMIN_PASSWORD),
    )
    db.add(u)
    db.commit()
    return {"status": "created"}


@app.post("/auth/login", response_model=schemas.TokenOut)
def login(payload: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).one_or_none()
    if not user or not auth.verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenziali errate")

    token = auth.create_access_token(user.id, settings.JWT_SECRET, settings.JWT_EXPIRES_MIN)
    return schemas.TokenOut(access_token=token)


@app.post("/auth/token", response_model=schemas.TokenOut)
def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form.username).one_or_none()
    if not user or not auth.verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenziali errate")

    token = auth.create_access_token(user.id, settings.JWT_SECRET, settings.JWT_EXPIRES_MIN)
    return schemas.TokenOut(access_token=token)


# =========================
# PEOPLE
# =========================
@app.get("/people", response_model=list[schemas.PersonOut])
def list_people(db: Session = Depends(get_db), _: models.User = Depends(require_user)):
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
def list_shifts(db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    return db.query(models.Shift).order_by(models.Shift.sort_order).all()


@app.post("/shifts", response_model=schemas.ShiftOut)
def create_shift(p: schemas.ShiftCreate, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    max_order = db.query(models.Shift.sort_order).order_by(models.Shift.sort_order.desc()).first()
    order = (max_order[0] if max_order else 0) + 1

    row = models.Shift(
        name=p.name,
        start_time=p.start_time,
        end_time=p.end_time,
        notes=p.notes,
        sort_order=order,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


# =========================
# WEEKS / CELL
# =========================
@app.put("/weeks/{monday}/cell")
def put_cell(monday: str, payload: schemas.CellUpdateIn, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    week = crud.get_or_create_week(db, parse_date(monday))
    crud.set_cell(db, week, payload.day_index, payload.shift_id, payload.person_id)
    return {"status": "ok"}


@app.post("/weeks/{monday}/clear")
def clear_week(monday: str, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    week = crud.get_or_create_week(db, parse_date(monday))
    crud.clear_week(db, week)
    return {"status": "cleared"}


# =========================
# META (SAFE – MAI 500)
# =========================
@app.get("/weeks/{monday}/meta")
def get_meta(monday: str, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    return {"monday_date": monday, "meta": {d: {} for d in range(7)}}


@app.put("/weeks/{monday}/meta")
def put_meta(monday: str, db: Session = Depends(get_db), _: models.User = Depends(require_user)):
    return {"status": "ok"}


# =========================
# EXPORT PDF
# =========================
@app.get("/weeks/{monday}/export.pdf")
def export_pdf(monday: str, token: str = Query(...), db: Session = Depends(get_db)):
    require_user_from_query(token, db)

    monday_date = parse_date(monday)
    week = crud.get_or_create_week(db, monday_date)
    shifts, people, grid, _ = crud.build_grid_and_alerts(db, week)

    people_by_id = {p.id: p.full_name for p in people}
    days = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]

    table_data = [["Turno"] + [f"{days[i]} {(monday_date + timedelta(days=i)).strftime('%d/%m')}" for i in range(7)]]

    for s in shifts:
        row = [s.name]
        for d in range(7):
            pid = grid.get(d, {}).get(s.id)
            row.append(people_by_id.get(pid, "") if pid else "")
        table_data.append(row)

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4))
    styles = getSampleStyleSheet()

    story = [Paragraph("Pianificazione Turni", styles["Title"]), Spacer(1, 12)]
    t = Table(table_data, repeatRows=1)
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey)]))
    story.append(t)

    doc.build(story)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="turni_{monday}.pdf"'}
    )