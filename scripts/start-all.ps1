$ErrorActionPreference = 'Stop'

# Start backend in a new PowerShell window
$backendScript = Join-Path $PSScriptRoot 'start-backend.ps1'
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy Bypass", "-File `"$backendScript`""

Start-Sleep -Seconds 3

# Start frontend in current window
& (Join-Path $PSScriptRoot 'start-frontend.ps1')
