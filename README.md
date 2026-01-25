# Gestione Turni (V2) — MVP pronto

## Avvio rapido
1) Installa Docker Desktop
2) Apri un terminale nella cartella del progetto (quella con `docker-compose.yml`)
3) Avvia:
```bash
docker compose up --build
```

## URL
- Web app: http://localhost:3000/login
- Swagger: http://localhost:8000/docs

## Setup iniziale
1) In Swagger: `POST /auth/bootstrap-admin` (200 OK)
2) Login web:
   - Email: `admin@gestione-turni.local`
   - Password: `Admin!2026Turni`
3) Turni: http://localhost:3000/shifts → “Crea 10 turni base”
4) Risorse: http://localhost:3000/people → aggiungi persone
5) Pianificazione: http://localhost:3000/planning

## Note
- Password hashing: PBKDF2 (evita problemi bcrypt).
- Swagger Authorize funziona (endpoint `/auth/token` form).
- Cestino in Risorse = disattiva/riattiva (non cancella lo storico).
