
import os
import django
import sys

# Set stdout to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Examination

# Fix years for school 16 (or all schools where year is None)
# The user mentioned 2025, so let's set year=2025 for exams that don't have one
# and are likely from the current/previous period.
updated = Examination.objects.filter(year__isnull=True).update(year=2025)
print(f"Updated {updated} examinations to year 2025")
