$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

Write-Host ""
Write-Host "Starting Ozon FBO Excel portable service..."

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    $candidates = @(
        "$env:LOCALAPPDATA\OpenAI\Codex\bin\node.exe",
        "C:\Program Files\nodejs\node.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            $nodePath = $candidate
            break
        }
    }
    if (-not $nodePath) {
        $codexNode = Get-ChildItem "C:\Program Files\WindowsApps" -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -like "*OpenAI.Codex*resources*node.exe" } |
            Select-Object -First 1
        if ($codexNode) {
            $nodePath = $codexNode.FullName
        }
    }
}
else {
    $nodePath = $node.Source
}

if (-not $nodePath) {
    Write-Host "Node.js not found."
    Write-Host "Install Node.js LTS from https://nodejs.org/ and run this script again."
    exit 1
}

Write-Host "Node: $nodePath"
Write-Host "Open: http://localhost:3000"
Write-Host ""
& $nodePath ".\portable\server.js"
