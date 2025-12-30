import os
import django
import random
from datetime import datetime, timedelta
from django.utils import timezone
from faker import Faker

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

# Import models after Django setup
from users.models import User, Profile
from schools.models import School
from academics.models import ClassRoom, Section, Subject, StudentProfile, TeacherAssignment
from attendance.models import AttendanceRecord
from fees.models import FeeStructure, Payment

fake = Faker()

# Helper functions
def random_date(start_date, end_date):
    time_between = end_date - start_date
    days_between = time_between.days
    random_days = random.randrange(days_between)
    return start_date + timedelta(days=random_days)

def create_users_and_profiles(count, role, school):
    """Create users with profiles for a specific role"""
    created_users = []
    
    for i in range(count):
        username = f"{role}_{school.id}_{i+1}"
        email = f"{username}@example.com"
        first_name = random.choice(["Amit", "Rahul", "Priya", "Neha", "Raj", "Sanjay", "Ananya", "Vikram", "Deepa", "Ravi"])
        last_name = random.choice(["Sharma", "Patel", "Singh", "Kumar", "Gupta", "Verma", "Joshi", "Mishra", "Das", "Banerjee"])
        
        # Create user
        user = User.objects.create_user(
            username=username,
            email=email,
            password="password123",
            first_name=first_name,
            last_name=last_name
        )
        
        # Create profile
        profile = Profile.objects.create(
            user=user,
            role=role,
            school=school
        )
        
        created_users.append((user, profile))
    
    return created_users

def populate_demo_data():
    print("Starting demo data population...")
    
    # Get existing schools or create a demo one if none exist
    schools = School.objects.all()
    if not schools.exists():
        school = School.objects.create(
            name="Demo School",
            address="123 Education Street, Demo City"
        )
        schools = [school]
    
    for school in schools:
        print(f"Creating data for school: {school.name}")
        
        # Create admin users
        admin_users = create_users_and_profiles(2, "admin", school)
        print(f"Created {len(admin_users)} admin users")
        
        # Create classes and sections
        class_names = ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"]
        section_names = ["A", "B", "C"]
        
        classes = []
        for class_name in class_names:
            classroom = ClassRoom.objects.create(
                name=class_name,
                school=school
            )
            classes.append(classroom)
            
            for section_name in section_names:
                Section.objects.create(
                    name=section_name,
                    classroom=classroom
                )
        
        print(f"Created {len(classes)} classes with {len(section_names)} sections each")
        
        # Create subjects
        subjects = []
        subject_names = ["Mathematics", "Science", "English", "Social Studies", "Computer Science", "Physical Education"]
        
        for subject_name in subject_names:
            subject = Subject.objects.create(
                name=subject_name,
                school=school
            )
            subjects.append(subject)
        
        print(f"Created {len(subjects)} subjects")
        
        # Create teachers
        teacher_users = create_users_and_profiles(10, "teacher", school)
        print(f"Created {len(teacher_users)} teachers")
        
        # Assign teachers to subjects and classes
        for i, (teacher_user, teacher_profile) in enumerate(teacher_users):
            # Each teacher gets 1-3 subjects
            teacher_subjects = random.sample(subjects, random.randint(1, 3))
            
            for subject in teacher_subjects:
                # Assign to 1-2 classes
                teacher_classes = random.sample(classes, random.randint(1, 2))
                
                for classroom in teacher_classes:
                    TeacherAssignment.objects.create(
                        teacher=teacher_user,
                        classroom=classroom,
                        subject=subject
                    )
        
        print("Created teacher assignments")
        
        # Create students (more students in lower classes)
        students_per_class = {
            "Class 1": 40,
            "Class 2": 35,
            "Class 3": 30,
            "Class 4": 25,
            "Class 5": 20
        }
        
        all_students = []
        
        for classroom in classes:
            student_count = students_per_class.get(classroom.name, 30)
            sections = Section.objects.filter(classroom=classroom)
            
            # Distribute students across sections
            for i in range(student_count):
                section = random.choice(sections)
                
                # Create student user and profile
                student_users = create_users_and_profiles(1, "student", school)
                student_user, student_profile = student_users[0]
                
                # Create student profile
                student = StudentProfile.objects.create(
                    user=student_user,
                    school=school,
                    classroom=classroom,
                    section=section,
                    roll_number=i+1
                )
                
                all_students.append(student)
        
        print(f"Created {len(all_students)} students")
        
        # Create fee structures
        fee_types = ["Tuition Fee", "Exam Fee", "Library Fee", "Computer Lab Fee", "Sports Fee"]
        
        for classroom in classes:
            base_amount = 1000 + (int(classroom.name.split()[1]) * 200)  # Higher classes have higher fees
            
            for fee_type in fee_types:
                amount = base_amount
                if fee_type == "Tuition Fee":
                    amount *= 2
                elif fee_type == "Exam Fee":
                    amount = 500
                
                FeeStructure.objects.create(
                    name=f"{fee_type} - {classroom.name}",
                    amount=amount,
                    school=school
                )
        
        print("Created fee structures")
        
        # Create payments (some students have paid, some haven't)
        current_date = timezone.now().date()
        start_date = current_date - timedelta(days=60)
        
        fee_structures = FeeStructure.objects.filter(school=school)
        
        for student in all_students:
            # 70% chance student has made a payment
            if random.random() < 0.7:
                # Pick 1-3 fee structures to pay
                student_fees = random.sample(list(fee_structures), random.randint(1, 3))
                
                for fee in student_fees:
                    # Sometimes pay partial amount
                    amount = fee.amount
                    if random.random() < 0.3:
                        amount = round(fee.amount * random.uniform(0.5, 0.9), 2)
                    
                    payment_date = random_date(start_date, current_date)
                    
                    Payment.objects.create(
                        student=student,
                        fee=fee,
                        amount=amount,
                        date=payment_date,
                        reference=f"REF-{student.user.username}-{payment_date.strftime('%Y%m%d')}"
                    )
        
        print("Created fee payments")
        
        # Create attendance records (last 30 days)
        end_date = current_date
        start_date = end_date - timedelta(days=30)
        
        # Generate dates excluding weekends
        dates = []
        date_iter = start_date
        while date_iter <= end_date:
            if date_iter.weekday() < 5:  # Monday to Friday
                dates.append(date_iter)
            date_iter += timedelta(days=1)
        
        for student in all_students:
            for date in dates:
                # 85% chance student is present
                is_present = random.random() < 0.85
                
                AttendanceRecord.objects.create(
                    school=school,
                    student=student,
                    date=date,
                    present=is_present
                )
        
        print(f"Created attendance records for {len(all_students)} students over {len(dates)} days")
    
    print("Demo data population completed successfully!")

if __name__ == "__main__":
    populate_demo_data()