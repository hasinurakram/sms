# Quick Start Guide

## Prerequisites
- **Python 3.12+** (installed via `py` launcher)
- **Node.js LTS** (optional, for frontend) - Download from https://nodejs.org/

## Setup (First Time)

### Option 1: Using Batch Files (Recommended for Windows)
```cmd
setup.bat
```

### Option 2: Using PowerShell Scripts
```powershell
# If execution policy blocks scripts, run PowerShell as Administrator and execute:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then run:
.\scripts\setup.ps1
```

### Option 3: Manual Setup
```cmd
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
```

## Running the Application

### Backend (Django)
```cmd
start-backend.bat
```
Or manually:
```cmd
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Backend will be available at: **http://127.0.0.1:8000**

### Frontend (React)
```cmd
cd frontend
npm install  # First time only
npm start
```

Frontend will be available at: **http://localhost:3000**

## Admin Panel
Create a superuser to access Django admin:
```cmd
.\.venv\Scripts\python.exe manage.py createsuperuser
```

Then visit: **http://127.0.0.1:8000/admin**

## API Endpoints
- Token (Login): `POST http://127.0.0.1:8000/api/token/`
- Token Refresh: `POST http://127.0.0.1:8000/api/token/refresh/`
- Schools: `GET http://127.0.0.1:8000/api/schools/`
- Dashboard: `GET http://127.0.0.1:8000/api/dashboard-stats/?school_id=<id>`

## Demo Data (Optional)
Populate the database with demo data:
```cmd
.\.venv\Scripts\python.exe create_demo_data.py
```

## Troubleshooting

### PowerShell Execution Policy Error
Run PowerShell as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Port Already in Use
If port 8000 is busy, use a different port:
```cmd
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8001
```

### Node.js Not Found
Install Node.js from https://nodejs.org/ and restart your terminal.

### Python Not Found
Ensure Python 3.12+ is installed. Test with:
```cmd
py --version
```

## Current Status
✅ Backend: **RUNNING** on http://127.0.0.1:8000
✅ Database: SQLite (db.sqlite3) - migrations applied
✅ Virtual Environment: `.venv` created with Python 3.13.5
⚠️ Frontend: Requires Node.js installation
⚠️ Admin User: Not created yet (run `createsuperuser` command)
