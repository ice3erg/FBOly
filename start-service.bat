@echo off
echo Starting Ozon FBO Excel service...
powershell -ExecutionPolicy Bypass -File "%~dp0start-service.ps1"
pause
