$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

Write-Host ""
Write-Host "Ozon FBO Excel service"
Write-Host "Project: $projectDir"
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker is not installed or is not available in PATH."
    Write-Host "Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
}

$dockerService = Get-Service -Name "com.docker.service" -ErrorAction SilentlyContinue
if ($dockerService -and $dockerService.Status -ne "Running") {
    Write-Host "Docker Desktop Service is not running."
    Write-Host ""
    Write-Host "Do this once:"
    Write-Host "1. Close Docker Desktop from the tray icon."
    Write-Host "2. Open Docker Desktop as Administrator."
    Write-Host "3. Wait until Docker says Engine running."
    Write-Host "4. Run this script again."
    Write-Host ""
    Write-Host "Alternative from Administrator PowerShell:"
    Write-Host "Start-Service com.docker.service"
    exit 1
}

Write-Host "Checking Docker engine..."
$infoOutput = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Docker is installed, but Docker engine is not ready."
    Write-Host ""
    $infoOutput | Select-Object -First 12 | ForEach-Object { Write-Host $_ }
    Write-Host ""
    Write-Host "Fix:"
    Write-Host "1. Restart Docker Desktop."
    Write-Host "2. If it still fails, run Docker Desktop as Administrator."
    Write-Host "3. Wait until Docker engine is running."
    Write-Host "4. Run .\start-service.ps1 again."
    exit 1
}

Write-Host "Starting containers..."
docker compose up --build -d

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Docker Compose failed. Show logs with:"
    Write-Host "docker compose logs"
    exit 1
}

Write-Host ""
Write-Host "Service is starting."
Write-Host "Open: http://localhost:3000"
Write-Host "API:  http://localhost:8000"
