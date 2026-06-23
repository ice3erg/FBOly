@echo off
setlocal

cd /d "%~dp0"

echo Starting FBOly as a web service...
echo.
echo API:      http://localhost:8000
echo Frontend: http://localhost:3000
echo.

start "FBOly API" cmd /k "%~dp0start-backend-portable.bat"
timeout /t 2 /nobreak >nul
start "FBOly Frontend" cmd /k "%~dp0start-frontend.bat"

echo Two windows were opened: API and Frontend.
echo Keep both windows open.
pause
