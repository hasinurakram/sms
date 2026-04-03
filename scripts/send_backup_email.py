import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
from datetime import datetime

def send_backup_email(file_path, recipient_email="bdappitfirm@gmail.com"):
    # Email configuration (these should be in .env)
    sender_email = os.environ.get("BACKUP_EMAIL_SENDER", "your-backup-email@gmail.com")
    sender_password = os.environ.get("BACKUP_EMAIL_PASSWORD", "your-app-password")
    smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))

    if not os.path.exists(file_path):
        print(f"Error: Backup file {file_path} not found.")
        return False

    print(f"Sending backup {os.path.basename(file_path)} to {recipient_email}...")

    # Create message
    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = recipient_email
    msg['Subject'] = f"Database Backup - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

    body = f"Please find the attached database backup for {datetime.now().strftime('%Y-%m-%d')}."
    msg.attach(MIMEText(body, 'plain'))

    # Attachment
    try:
        with open(file_path, "rb") as attachment:
            part = MIMEBase('application', 'octet-stream')
            part.set_payload(attachment.read())
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename={os.path.basename(file_path)}',
            )
            msg.attach(part)

        # Send email
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)
        server.send_message(msg)
        server.quit()
        print("Email sent successfully!")
        return True
    except Exception as e:
        print(f"Failed to send email: {str(e)}")
        return False

if __name__ == "__main__":
    # Example usage (test with a dummy file if needed)
    # send_backup_email("path/to/your/backup.sql")
    pass
