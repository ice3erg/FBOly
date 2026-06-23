@echo off
setlocal

cd /d "%~dp0frontend"

if not exist "C:\Program Files\nodejs\npm.cmd" (
  echo Node.js npm.cmd not found.
  echo Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing frontend dependencies...
  call "C:\Program Files\nodejs\npm.cmd" install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting FBOly frontend...
echo Open http://localhost:3000
call "C:\Program Files\nodejs\npm.cmd" run dev

pause
