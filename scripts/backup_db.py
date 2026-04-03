import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Add current script directory to sys.path for imports
script_dir = Path(__file__).parent
if str(script_dir) not in sys.path:
    sys.path.append(str(script_dir))

try:
    from send_backup_email import send_backup_email
except ImportError:
    def send_backup_email(*args, **kwargs):
        print("Warning: send_backup_email not found.")
        return False

try:
    from upload_to_drive import upload_to_drive
except ImportError:
    upload_to_drive = None

# Configuration
DB_NAME = os.environ.get("PG_NAME", "local_pg_db")
DB_USER = os.environ.get("PG_USER", "local_pg_user")
DB_PASS = os.environ.get("PG_PASSWORD", "Bangladesh@4321$")
DB_HOST = os.environ.get("PG_HOST", "localhost")
DB_PORT = os.environ.get("PG_PORT", "5432")

# PostgreSQL bin path (Update this if pg_dump is not in PATH)
# I found it at C:\Program Files\PostgreSQL\18\bin\pg_dump.exe
PG_DUMP_PATH = os.environ.get("PG_DUMP_PATH", r"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe")

# Set recipient email
RECIPIENT_EMAIL = "bdappitfirm@gmail.com"
# Optional: Set Google Drive Folder ID if you want backups in a specific folder
GDRIVE_FOLDER_ID = os.environ.get("GDRIVE_FOLDER_ID", None)

BACKUP_DIR = Path(__file__).parent.parent / "backups" / "db"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
BACKUP_FILE = BACKUP_DIR / f"{DB_NAME}_{TIMESTAMP}.sql"

def run_backup():
    print(f"Starting backup for {DB_NAME}...")
    
    # Check if pg_dump exists
    pg_dump_cmd = "pg_dump"
    if not subprocess.run(["where", "pg_dump"], capture_output=True).returncode == 0:
        if os.path.exists(PG_DUMP_PATH):
            pg_dump_cmd = PG_DUMP_PATH
        else:
            print(f"Error: pg_dump not found in PATH and not at {PG_DUMP_PATH}")
            print("Please install PostgreSQL or set PG_DUMP_PATH environment variable.")
            return

    # Set password for pg_dump
    os.environ["PGPASSWORD"] = DB_PASS
    
    try:
        # Construct the pg_dump command
        cmd = [
            pg_dump_cmd,
            "-h", DB_HOST,
            "-p", DB_PORT,
            "-U", DB_USER,
            "-F", "c",  # Custom format (compressed)
            "-b",        # Include large objects
            "-v",        # Verbose
            "-f", str(BACKUP_FILE),
            DB_NAME
        ]
        
        print(f"Running command: {' '.join(cmd)}")
        subprocess.run(cmd, check=True)
        print(f"Backup successful: {BACKUP_FILE}")
        
        # 1. Send via Email
        try:
            send_backup_email(str(BACKUP_FILE), RECIPIENT_EMAIL)
        except Exception as e:
            print(f"Email failed: {e}")
        
        # 2. Upload to Google Drive (if credentials are set up)
        if upload_to_drive:
            try:
                upload_to_drive(str(BACKUP_FILE), GDRIVE_FOLDER_ID)
            except Exception as e:
                print(f"Google Drive upload failed: {e}")
        else:
            print("Skipping Google Drive upload (script not found or import error).")

        # Keep only last 30 days of backups
        for old_file in BACKUP_DIR.glob("*.sql"):
            file_age = (datetime.now() - datetime.fromtimestamp(old_file.stat().st_mtime)).days
            if file_age > 30:
                old_file.unlink()
                print(f"Removed old backup: {old_file}")
                
    except subprocess.CalledProcessError as e:
        print(f"Backup failed (pg_dump error): {e}")
    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if "PGPASSWORD" in os.environ:
            del os.environ["PGPASSWORD"]

if __name__ == "__main__":
    run_backup()

