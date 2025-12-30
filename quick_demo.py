import os
import django
import random
from datetime import timedelta

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.utils import timezone
# Import only the correct School model
from schools.models import School
from academics.models import ClassRoom, Section, Subject, StudentProfile
from users.models import User, Profile
from fees.models import FeeStructure, Payment
from attendance.models import AttendanceRecord

def create_quick_demo():
    # Create a school
    school = School.objects.create(
        name="ধলাইতলী জনতা উচ্চ বিদ্যালয়",
        address="ধলাইতলী, চাঁদপুর"
    )
    print(f"Created school: {school.name}")
    
    # Get the academics.models.School instance for ClassRoom
    from academics.models import School as AcademicsSchool
    academic_school = AcademicsSchool.objects.create(
        name=school.name,
        address=school.address
    )
    
    # Create classes
    class_names = ["ষষ্ঠ শ্রেণী (Class 6)", "সপ্তম শ্রেণী (Class 7)", "অষ্টম শ্রেণী (Class 8)"]
    classes = []
    for name in class_names:
        class_obj = ClassRoom.objects.create(name=name, school=academic_school)
        classes.append(class_obj)
    print(f"Created {len(classes)} classes")
    
    # Create sections
    section_names = ["ক (A)", "খ (B)"]
    sections = []
    for class_obj in classes:
        for name in section_names:
            section = Section.objects.create(name=name, classroom=class_obj)
            sections.append(section)
    print(f"Created {len(sections)} sections")
    
    # Create subjects
    subject_names = ["বাংলা (Bengali)", "ইংরেজি (English)", "গণিত (Mathematics)"]
    subjects = []
    for name in subject_names:
        subject = Subject.objects.create(name=name, school=academic_school)
        subjects.append(subject)
    print(f"Created {len(subjects)} subjects")
    
    # Create teachers
    teachers = []
    teacher_names = [
        ("Rahima", "Begum"),
        ("Abdul", "Karim"),
        ("Nasrin", "Akter")
    ]
    
    for first_name, last_name in teacher_names:
        username = f"{first_name.lower()}.{last_name.lower()}"
        email = f"{username}@example.com"
        teacher_user = User.objects.create_user(
            username=username,
            email=email,
            password="password123",
            first_name=first_name,
            last_name=last_name
        )
        teacher_profile = Profile.objects.create(
            user=teacher_user,
            role="teacher",
            school=school
        )
        teachers.append(teacher_profile)
    print(f"Created {len(teachers)} teachers")
    
    # Create students
    students = []
    student_profiles = []
    student_names = [
        ("Kamal", "Hossain"),
        ("Jamal", "Ahmed"),
        ("Nusrat", "Jahan"),
        ("Farida", "Yasmin"),
        ("Rahim", "Khan")
    ]
    
    for first_name, last_name in student_names:
        username = f"{first_name.lower()}.{last_name.lower()}"
        email = f"{username}@example.com"
        student_user = User.objects.create_user(
            username=username,
            email=email,
            password="password123",
            first_name=first_name,
            last_name=last_name
        )
        # Create Profile for user authentication
        student_profile = Profile.objects.create(
            user=student_user,
            role="student",
            school=school
        )
        students.append(student_profile)
        
        # Create StudentProfile for academic records
        academic_profile = StudentProfile.objects.create(
            user=student_user,
            school=academic_school,
            classroom=random.choice(classes),
            section=random.choice(sections),
            roll_number=str(random.randint(1, 100))
        )
        student_profiles.append(academic_profile)
    print(f"Created {len(students)} students")
    
    # Create fee structures
    fee_types = ["বার্ষিক ফি (Annual Fee)", "পরীক্ষা ফি (Exam Fee)"]
    fee_structures = []
    for class_obj in classes:
        for fee_type in fee_types:
            fee_structure = FeeStructure.objects.create(
                name=f"{fee_type} - {class_obj.name}",
                amount=random.randint(500, 2000),
                due_day=random.randint(1, 28),
                school=school
            )
            fee_structures.append(fee_structure)
    print(f"Created {len(fee_structures)} fee structures")
    
    # Create payments - using StudentProfile instead of User
    payments = []
    for student_profile in student_profiles[:3]:  # Only some students have made payments
        fee = random.choice(fee_structures)
        payment = Payment.objects.create(
            student=student_profile,
            fee=fee,
            amount=fee.amount,
            reference="নগদ (Cash)"
        )
        payments.append(payment)
    print(f"Created {len(payments)} payments")
    
    # Create attendance records - simplified to avoid errors
    print("Skipping attendance records for now to ensure basic functionality")
    
    print("Quick demo data creation completed!")

if __name__ == "__main__":
    create_quick_demo()
    # Create a school
    school = School.objects.create(
        name="ধলাইতলী জনতা উচ্চ বিদ্যালয়",
        address="ধলাইতলী, চাঁদপুর"
    )
    print(f"Created school: {school.name}")
    
    # Create classes
    class_names = ["ষষ্ঠ শ্রেণী (Class 6)", "সপ্তম শ্রেণী (Class 7)", "অষ্টম শ্রেণী (Class 8)"]
    classes = []
    for name in class_names:
        class_obj = ClassRoom.objects.create(name=name, school=school)
        classes.append(class_obj)
    print(f"Created {len(classes)} classes")
    
    # Create sections
    section_names = ["ক (A)", "খ (B)"]
    sections = []
    for class_obj in classes:
        for name in section_names:
            section = Section.objects.create(name=name, classroom=class_obj, school=school)
            sections.append(section)
    print(f"Created {len(sections)} sections")
    
    # Create subjects
    subject_names = ["বাংলা (Bengali)", "ইংরেজি (English)", "গণিত (Mathematics)"]
    subjects = []
    for name in subject_names:
        subject = Subject.objects.create(name=name, school=school)
        subjects.append(subject)
    print(f"Created {len(subjects)} subjects")
    
    # Create teachers
    teachers = []
    teacher_names = [
        ("Rahima", "Begum"),
        ("Abdul", "Karim"),
        ("Nasrin", "Akter")
    ]
    
    for first_name, last_name in teacher_names:
        username = f"{first_name.lower()}.{last_name.lower()}"
        email = f"{username}@example.com"
        teacher_user = User.objects.create_user(
            username=username,
            email=email,
            password="password123",
            first_name=first_name,
            last_name=last_name
        )
        teacher_profile = Profile.objects.create(
            user=teacher_user,
            role="teacher",
            school=school
        )
        teachers.append(teacher_profile)
    print(f"Created {len(teachers)} teachers")
    
    # Create students
    students = []
    student_names = [
        ("Kamal", "Hossain"),
        ("Jamal", "Ahmed"),
        ("Nusrat", "Jahan"),
        ("Farida", "Yasmin"),
        ("Rahim", "Khan")
    ]
    
    for first_name, last_name in student_names:
        username = f"{first_name.lower()}.{last_name.lower()}"
        email = f"{username}@example.com"
        student_user = User.objects.create_user(
            username=username,
            email=email,
            password="password123",
            first_name=first_name,
            last_name=last_name
        )
        student_profile = Profile.objects.create(
            user=student_user,
            role="student",
            school=school
        )
        students.append(student_profile)
    print(f"Created {len(students)} students")
    
    # Create fee structures
    fee_types = ["বার্ষিক ফি (Annual Fee)", "পরীক্ষা ফি (Exam Fee)"]
    fee_structures = []
    for class_obj in classes:
        for fee_type in fee_types:
            fee_structure = FeeStructure.objects.create(
                name=f"{fee_type} - {class_obj.name}",
                amount=random.randint(500, 2000),
                due_date=timezone.now().date() + timedelta(days=30),
                school=school
            )
            fee_structures.append(fee_structure)
    print(f"Created {len(fee_structures)} fee structures")
    
    # Create payments
    payments = []
    for student in students[:3]:  # Only some students have made payments
        payment = Payment.objects.create(
            student=student.user,
            amount=random.randint(500, 2000),
            payment_date=timezone.now().date() - timedelta(days=random.randint(1, 10)),
            payment_method="নগদ (Cash)",
            school=school
        )
        payments.append(payment)
    print(f"Created {len(payments)} payments")
    
    # Create attendance records
    attendance_statuses = ["উপস্থিত (Present)", "অনুপস্থিত (Absent)"]
    attendance_records = []
    for student in students:
        for _ in range(3):  # 3 attendance records per student
            date = timezone.now().date() - timedelta(days=random.randint(1, 10))
            status = random.choice(attendance_statuses)
            record = AttendanceRecord.objects.create(
                student=student.user,
                date=date,
                status=status,
                school=school
            )
            attendance_records.append(record)
    print(f"Created {len(attendance_records)} attendance records")
    
    print("Quick demo data creation completed!")

if __name__ == "__main__":
    create_quick_demo()