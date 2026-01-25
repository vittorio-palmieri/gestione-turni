@echo off
title Gestione Turni - STOP
cd /d C:\Progetti\gestione-turni

echo ==========================================
echo  Stop Gestione Turni (senza perdere dati)
echo ==========================================
echo.

docker compose down

echo.
echo Fatto.
pause