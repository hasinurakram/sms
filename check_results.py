
import os
import django
import sys

# Set stdout to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Examination, Result
from academics.models import School

with open('exams_list.txt', 'w', encoding='utf-8') as f:
    f.write(f"Total exams: {Examination.objects.count()}\n")
    for e in Examination.objects.all().select_related('school', 'classroom'):
        f.write(f"ID: {e.id}, School: {e.school.name}, Name: {e.name}, Year: {e.year}, Date: {e.exam_date}, Type: {e.exam_type}, Class: {e.classroom.name}\n")
        results_count = Result.objects.filter(examination=e).count()
        f.write(f"  Results count: {results_count}\n")
