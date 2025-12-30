#!/usr/bin/env python
"""Debug Aysha's results for half_yearly examination"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result, Examination, StudentOverallResult
from academics.models import StudentProfile, Subject

print("=== DEBUGGING AYSHA'S RESULTS ===\n")

# Find Aysha
students = StudentProfile.objects.filter(user__first_name__icontains='আয়শা')
print(f"Found {students.count()} students matching 'আয়শা':")
for s in students:
    print(f"  - ID: {s.id}, Name: {s.user.first_name} {s.user.last_name}, Roll: {s.roll_number}, Class: {s.classroom.name if s.classroom else 'N/A'}")

if students.exists():
    aysha = students.first()
    print(f"\nUsing student: {aysha.user.first_name} {aysha.user.last_name} (ID: {aysha.id})")
    
    # Find half_yearly examinations for her class
    if aysha.classroom:
        print(f"\nLooking for half_yearly examinations in class: {aysha.classroom.name}")
        exams = Examination.objects.filter(
            classroom=aysha.classroom,
            exam_type='half_yearly'
        )
        print(f"Found {exams.count()} half_yearly examinations:")
        for exam in exams:
            print(f"  - ID: {exam.id}, Name: {exam.name}, Type: {exam.exam_type}")
        
        if exams.exists():
            exam = exams.first()
            print(f"\nUsing examination: {exam.name} (ID: {exam.id})")
            
            # Check results for this student in this exam
            results = Result.objects.filter(
                examination=exam,
                student=aysha
            ).select_related('subject')
            
            print(f"\nFound {results.count()} results for this student in this examination:")
            for r in results:
                print(f"  - Subject: {r.subject.name}, Written: {r.written_marks}, MCQ: {r.mcq_marks}, Practical: {r.practical_marks}, Total: {r.total_obtained}, Grade: {r.grade}")
            
            # Check overall result
            overall = StudentOverallResult.objects.filter(
                examination=exam,
                student=aysha
            ).first()
            
            if overall:
                print(f"\nOverall Result:")
                print(f"  - Total Obtained: {overall.total_marks_obtained}")
                print(f"  - Total Possible: {overall.total_marks_possible}")
                print(f"  - Percentage: {overall.percentage}%")
                print(f"  - CGPA: {overall.cgpa}")
                print(f"  - Grade: {overall.grade}")
                print(f"  - Passed: {overall.is_passed}")
            else:
                print("\nNo overall result found!")
        else:
            print("\nNo half_yearly examination found for this class!")
            
            # Check all examinations for this class
            all_exams = Examination.objects.filter(classroom=aysha.classroom)
            print(f"\nAll examinations for class {aysha.classroom.name}:")
            for exam in all_exams:
                print(f"  - ID: {exam.id}, Name: {exam.name}, Type: {exam.exam_type}")
    else:
        print("\nStudent has no classroom assigned!")
else:
    print("\nNo student found matching 'আয়শা'!")

print("\n=== END DEBUG ===")
