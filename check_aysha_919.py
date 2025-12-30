#!/usr/bin/env python
"""Check Aysha (ID: 919) results"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result, Examination, StudentOverallResult
from academics.models import StudentProfile, Subject

print("=== CHECKING AYSHA (ID: 919) ===\n")

student = StudentProfile.objects.get(id=919)
print(f"Student: {student.user.first_name} {student.user.last_name}")
print(f"Roll: {student.roll_number}")
print(f"Class: {student.classroom.name if student.classroom else 'N/A'}")

# Find all half_yearly examinations for this class
if student.classroom:
    print(f"\nAll half_yearly examinations in class {student.classroom.name}:")
    exams = Examination.objects.filter(
        classroom=student.classroom,
        exam_type='half_yearly'
    )
    print(f"Found {exams.count()} examinations:")
    for exam in exams:
        print(f"  - ID: {exam.id}, Name: {exam.name}")
        
        # Check if there are any results for this student in this exam
        results = Result.objects.filter(examination=exam, student=student)
        print(f"    Results: {results.count()}")
        for r in results:
            print(f"      - Subject: {r.subject.name}, Total: {r.total_obtained}, Grade: {r.grade}")
    
    # Check all results for this student regardless of examination
    print(f"\nAll results for this student:")
    all_results = Result.objects.filter(student=student).select_related('examination', 'subject')
    print(f"Found {all_results.count()} results:")
    for r in all_results:
        print(f"  - Exam: {r.examination.name} ({r.examination.exam_type}), Subject: {r.subject.name}, Total: {r.total_obtained}")
    
    # Check overall results
    print(f"\nAll overall results for this student:")
    overall_results = StudentOverallResult.objects.filter(student=student).select_related('examination')
    print(f"Found {overall_results.count()} overall results:")
    for o in overall_results:
        print(f"  - Exam: {o.examination.name} ({o.examination.exam_type}), CGPA: {o.cgpa}, Grade: {o.grade}")

print("\n=== END CHECK ===")
