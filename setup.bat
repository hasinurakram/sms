@echo off
echo === Backend: Python venv and dependencies ===

if not exist .venv (
    echo Creating virtual environment in .venv
    py -m venv .venv
)

echo Upgrading pip
.\.venv\Scripts\python.exe -m pip install --upgrade pip

echo Installing backend requirements from requirements.txt
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

echo Running Django migrations
.\.venv\Scripts\python.exe manage.py makemigrations
.\.venv\Scripts\python.exe manage.py migrate

echo.
echo === Frontend: Node dependencies ===
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Node.js not found. Install Node.js LTS from https://nodejs.org/
    echo Skipping frontend setup. Backend will still work.
) else (
    if exist frontend\package.json (
        cd frontend
        if not exist node_modules (
            echo Installing frontend dependencies (npm install)
            npm install
        ) else (
            echo node_modules exists; run 'npm ci' if you want a clean reinstall.
        )
        cd ..
    )
)

echo.
echo Setup complete.
echo.
echo To start the backend: start-backend.bat
echo To start the frontend (after installing Node.js): cd frontend ^&^& npm start
pause
