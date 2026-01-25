@echo off
title Gestione Turni - START
cd /d C:\Progetti\gestione-turni

echo ==========================================
echo  Avvio Gestione Turni (Docker Compose)
echo ==========================================
echo.

docker compose up -d

echo.
echo ==========================================
echo  Stato servizi
echo ==========================================
docker compose ps

echo.
echo Apri:
echo  - Web App:  http://localhost:3000/login
echo  - Swagger:  http://localhost:8000/docs
echo.
pause