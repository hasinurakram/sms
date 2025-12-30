@echo off
echo ============================================
echo  Restarting Django Backend
echo ============================================
echo.
echo Stopping any running Django servers...
taskkill /F /IM python.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Starting Django backend server...
echo Backend will be available at: http://127.0.0.1:8000
echo.
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
