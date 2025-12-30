@echo off
echo Starting Django backend server...
set USE_POSTGRES=1
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
