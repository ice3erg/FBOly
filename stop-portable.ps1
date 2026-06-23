$ErrorActionPreference = "Stop"

Write-Host "Stopping portable service on port 3000..."

$connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
$processIds = @()
if ($connections) {
    $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
}

if (-not $processIds) {
    $processIds = netstat -ano |
        Select-String ":3000" |
        ForEach-Object { ($_ -split "\s+")[-1] } |
        Where-Object { $_ -match "^\d+$" -and $_ -ne "0" } |
        Select-Object -Unique
}

if (-not $processIds) {
    Write-Host "No service is listening on port 3000."
    exit 0
}

foreach ($processId in $processIds) {
    Stop-Process -Id $processId -Force
    Write-Host "Stopped process $processId"
}
