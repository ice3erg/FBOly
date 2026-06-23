@echo off
echo Stopping Ozon FBO Excel service...
powershell -ExecutionPolicy Bypass -File "%~dp0stop-service.ps1"
pause
