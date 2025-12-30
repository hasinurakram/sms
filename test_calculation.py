#!/usr/bin/env python
"""Test the calculation logic"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result
from academics.models import StudentProfile

print("=== TESTING CALCULATION LOGIC ===\n")

# Get Aysha (ID: 919)
student = StudentProfile.objects.get(id=919)
print(f"Student: {student.user.first_name} {student.user.last_name}")

# Get all her half_yearly results
results = Result.objects.filter(
    student=student,
    examination__exam_type='half_yearly'
).select_related('examination', 'subject')

print(f"\nFound {results.count()} results:")
print(f"{'Subject':<30} {'Total Obtained':<15} {'Total Marks':<15} {'GPA':<10}")
print("-" * 70)

total_obtained = 0
total_possible = 0
total_gpa = 0

for r in results:
    print(f"{r.subject.name:<30} {float(r.total_obtained):<15} {r.examination.total_marks:<15} {float(r.gpa):<10}")
    total_obtained += float(r.total_obtained)
    total_possible += r.examination.total_marks
    total_gpa += float(r.gpa)

print("-" * 70)
print(f"{'TOTAL':<30} {total_obtained:<15} {total_possible:<15}")

if results.count() > 0:
    avg_gpa = total_gpa / results.count()
    percentage = (total_obtained / total_possible * 100) if total_possible > 0 else 0
    
    print(f"\nCalculated Results:")
    print(f"  Total Obtained: {total_obtained}")
    print(f"  Total Possible: {total_possible}")
    print(f"  Percentage: {percentage:.2f}%")
    print(f"  Average GPA: {avg_gpa:.2f}")
    
    # Determine grade
    if avg_gpa >= 5.0:
        grade = 'A+'
    elif avg_gpa >= 4.0:
        grade = 'A'
    elif avg_gpa >= 3.5:
        grade = 'A-'
    elif avg_gpa >= 3.0:
        grade = 'B'
    elif avg_gpa >= 2.0:
        grade = 'C'
    elif avg_gpa >= 1.0:
        grade = 'D'
    else:
        grade = 'F'
    
    print(f"  Overall Grade: {grade}")

print("\n=== END TEST ===")
