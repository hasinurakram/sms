$ErrorActionPreference = 'Stop'

$venvPath = Join-Path $PSScriptRoot '..\.venv'
if (!(Test-Path $venvPath)) {
    Write-Error '.venv not found. Run scripts/setup.ps1 first.'
    exit 1
}

. (Join-Path $venvPath 'Scripts\Activate.ps1')

$manage = Join-Path $PSScriptRoot '..\manage.py'

# Force Postgres for backend runs
$env:USE_POSTGRES = '1'

# Ensure database is migrated
py $manage migrate

# Start Django dev server
py $manage runserver 127.0.0.1:8000
