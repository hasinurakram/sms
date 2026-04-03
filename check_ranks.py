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
exams = Examination.objects.filter(school_id=sid)
print(f"Total exams in school 16: {exams.count()}")

overalls = StudentOverallResult.objects.filter(examination__school_id=sid)
print(f"Total overall results in school 16: {overalls.count()}")

if overalls.exists():
    for o in overalls[:10]:
        print(f"Student: {o.student.user.get_full_name()}, Exam: {o.examination.name}, Rank: {o.rank}")
else:
    print("No overall results found for school 16.")

# Check for student with roll 2 specifically
student = StudentProfile.objects.filter(school_id=sid, roll_number='2').first()
if student:
    print(f"\nResults for {student.user.get_full_name()} (Roll 2):")
    s_overalls = StudentOverallResult.objects.filter(student=student)
    for o in s_overalls:
        print(f"  Exam: {o.examination.name}, Rank: {o.rank}, CGPA: {o.cgpa}")
