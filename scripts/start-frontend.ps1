$ErrorActionPreference = 'Stop'

# Check for Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'Node.js not found. Install Node.js LTS from https://nodejs.org/'
    exit 1
}

$frontendDir = Join-Path $PSScriptRoot '..\frontend'
if (!(Test-Path (Join-Path $frontendDir 'package.json'))) {
    Write-Error 'frontend/package.json not found.'
    exit 1
}

Push-Location $frontendDir
try {
    if (!(Test-Path (Join-Path $frontendDir 'node_modules'))) {
        Write-Host 'Installing frontend dependencies (npm install)'
        npm install
    }
    npm start
} finally {
    Pop-Location
}
