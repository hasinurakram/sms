#!/usr/bin/env python
"""Find student with roll number 3"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result, Examination, StudentOverallResult
from academics.models import StudentProfile, Subject

print("=== FINDING STUDENT WITH ROLL 3 ===\n")

# Find student with roll number 3
students = StudentProfile.objects.filter(roll_number='৩')
if not students.exists():
    students = StudentProfile.objects.filter(roll_number='3')

print(f"Found {students.count()} students with roll number 3 or ৩:")
for s in students:
    print(f"  - ID: {s.id}, Name: {s.user.first_name} {s.user.last_name}, Roll: {s.roll_number}, Class: {s.classroom.name if s.classroom else 'N/A'}")

if students.exists():
    student = students.first()
    print(f"\nUsing student: {student.user.first_name} {student.user.last_name} (ID: {student.id})")
    
    # Find half_yearly examinations for this class
    if student.classroom:
        print(f"\nLooking for half_yearly examinations in class: {student.classroom.name}")
        exams = Examination.objects.filter(
            classroom=student.classroom,
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
                student=student
            ).select_related('subject')
            
            print(f"\nFound {results.count()} results for this student in this examination:")
            for r in results:
                print(f"  - Subject: {r.subject.name}, Written: {r.written_marks}, MCQ: {r.mcq_marks}, Practical: {r.practical_marks}, Total: {r.total_obtained}, Grade: {r.grade}")
            
            # Check overall result
            overall = StudentOverallResult.objects.filter(
                examination=exam,
                student=student
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
                print("\nLet me check all subjects for this class:")
                subjects = Subject.objects.filter(school=student.classroom.school)
                print(f"Found {subjects.count()} subjects:")
                for subj in subjects:
                    print(f"  - {subj.name}")
        else:
            print("\nNo half_yearly examination found for this class!")
            
            # Check all examinations for this class
            all_exams = Examination.objects.filter(classroom=student.classroom)
            print(f"\nAll examinations for class {student.classroom.name}:")
            for exam in all_exams:
                print(f"  - ID: {exam.id}, Name: {exam.name}, Type: {exam.exam_type}")
    else:
        print("\nStudent has no classroom assigned!")
else:
    print("\nNo student found with roll number 3 or ৩!")
    
    # Show all students in ষষ্ঠ শ্রেণী
    print("\nLet me check all students in ষষ্ঠ শ্রেণী:")
    from academics.models import Classroom
    classrooms = Classroom.objects.filter(name__icontains='ষষ্ঠ')
    for classroom in classrooms:
        print(f"\nClass: {classroom.name}")
        students_in_class = StudentProfile.objects.filter(classroom=classroom)
        print(f"Found {students_in_class.count()} students:")
        for s in students_in_class[:10]:
            print(f"  - ID: {s.id}, Name: {s.user.first_name} {s.user.last_name}, Roll: {s.roll_number}")

print("\n=== END DEBUG ===")
