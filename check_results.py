#!/usr/bin/env python
"""Check if results are being saved"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result, Examination, StudentOverallResult
from academics.models import StudentProfile, Subject

print("=== DATABASE CHECK ===\n")

# Check examinations
exam_count = Examination.objects.count()
print(f"Total Examinations: {exam_count}")

if exam_count > 0:
    exams = Examination.objects.all()[:3]
    for exam in exams:
        print(f"  - {exam.name} (ID: {exam.id}, Class: {exam.classroom.name})")

# Check results
result_count = Result.objects.count()
print(f"\nTotal Results: {result_count}")

if result_count > 0:
    results = Result.objects.select_related('examination', 'student', 'subject').all()[:5]
    print("\nSample Results:")
    for r in results:
        student_name = f"{r.student.user.first_name} {r.student.user.last_name}".strip() or r.student.user.username
        print(f"  - {student_name} | {r.subject.name} | {r.examination.name} | Total: {r.total_obtained} | Grade: {r.grade}")
else:
    print("  No results found in database!")

# Check overall results
overall_count = StudentOverallResult.objects.count()
print(f"\nTotal Overall Results: {overall_count}")

if overall_count > 0:
    overall = StudentOverallResult.objects.select_related('examination', 'student').all()[:5]
    print("\nSample Overall Results:")
    for o in overall:
        student_name = f"{o.student.user.first_name} {o.student.user.last_name}".strip() or o.student.user.username
        print(f"  - {student_name} | {o.examination.name} | CGPA: {o.cgpa} | Grade: {o.grade}")

# Check students and subjects
print(f"\nTotal Students: {StudentProfile.objects.count()}")
print(f"Total Subjects: {Subject.objects.count()}")

print("\n=== END CHECK ===")
