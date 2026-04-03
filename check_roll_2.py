import os
import django
import sys
import io

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from results.models import StudentOverallResult, Examination
from academics.models import StudentProfile

sid = 16
students = StudentProfile.objects.filter(school_id=sid, roll_number='2')
print(f"Total students with Roll 2 in school 16: {students.count()}")

for s in students:
    print(f"\nStudent: {s.user.get_full_name()} (ID: {s.id}, Class: {s.classroom.name})")
    overalls = StudentOverallResult.objects.filter(student=s)
    if overalls.exists():
        for o in overalls:
            print(f"  Exam: {o.examination.name}, Rank: {o.rank}, CGPA: {o.cgpa}")
    else:
        print("  No overall results found.")
