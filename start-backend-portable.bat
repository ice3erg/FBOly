@echo off
setlocal

cd /d "%~dp0"
set PORT=8000

set NODE_EXE=
if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if "%NODE_EXE%"=="" if exist "%LOCALAPPDATA%\OpenAI\Codex\bin\node.exe" set "NODE_EXE=%LOCALAPPDATA%\OpenAI\Codex\bin\node.exe"

if "%NODE_EXE%"=="" (
  echo Node.js not found.
  echo Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

echo Starting FBOly API on http://localhost:8000
echo Keep this window open while using the web service.
"%NODE_EXE%" ".\portable\server.js"

pause
