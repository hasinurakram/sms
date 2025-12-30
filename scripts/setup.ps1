Param(
    [switch]$ForceRecreateVenv
)

$ErrorActionPreference = 'Stop'

# Check for Python
if (!(Get-Command py -ErrorAction SilentlyContinue)) {
    Write-Error 'Python not found. Install Python 3.12+ from https://www.python.org/downloads/'
    exit 1
}

Write-Host '=== Backend: Python venv and dependencies ==='
$venvPath = Join-Path $PSScriptRoot '..\.venv'
if ((Test-Path $venvPath) -and $ForceRecreateVenv) {
    Write-Host 'Removing existing .venv because -ForceRecreateVenv was provided'
    Remove-Item -Recurse -Force $venvPath
}

if (!(Test-Path $venvPath)) {
    Write-Host 'Creating virtual environment in .venv'
    py -m venv $venvPath
}

$activate = Join-Path $venvPath 'Scripts\Activate.ps1'
. $activate

Write-Host 'Upgrading pip'
py -m pip install --upgrade pip

Write-Host 'Installing backend requirements from requirements.txt'
py -m pip install -r (Join-Path $PSScriptRoot '..\requirements.txt')

Write-Host 'Running Django migrations'
py (Join-Path $PSScriptRoot '..\manage.py') makemigrations
py (Join-Path $PSScriptRoot '..\manage.py') migrate

Write-Host '=== Frontend: Node dependencies ==='

# Check for Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Warning 'Node.js not found. Install Node.js LTS from https://nodejs.org/'
    Write-Warning 'Skipping frontend setup. Backend will still work.'
} else {
    $frontendDir = Join-Path $PSScriptRoot '..\frontend'
    if (Test-Path (Join-Path $frontendDir 'package.json')) {
        Push-Location $frontendDir
        try {
            if (!(Test-Path (Join-Path $frontendDir 'node_modules'))) {
                Write-Host 'Installing frontend dependencies (npm install)'
                npm install
            } else {
                Write-Host 'node_modules exists; run `npm ci` if you want a clean reinstall.'
            }
        } finally {
            Pop-Location
        }
    }
}

Write-Host 'Setup complete.'
