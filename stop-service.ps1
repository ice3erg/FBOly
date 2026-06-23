$ErrorActionPreference = "Stop"

Write-Host "Stopping Ozon FBO Excel service..."
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir
docker compose down
