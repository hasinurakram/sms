import os
import sys
import django

# Add the project root to sys.path
sys.path.append('F:\\Project')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import ClassRoom, StudentProfile
from django.db.models import Q

def check_counts():
    classes = ClassRoom.objects.filter(Q(name__icontains='ষষ্ঠ') | Q(name__icontains='6'))
    total = 0
    for c in classes:
        all_count = c.students.count()
        active_count = c.students.filter(user__is_active=True).count()
        print(f"Class: {c.name} (ID: {c.id}) - Total: {all_count}, Active: {active_count}")
        total += active_count
    print(f"Grand Total Active: {total}")

if __name__ == '__main__':
    check_counts()
