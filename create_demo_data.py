import os
import django
import random
from datetime import datetime, timedelta

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from academics.models import School, ClassRoom, Section, Subject, StudentProfile
from users.models import Profile
from attendance.models import AttendanceRecord
from fees.models import FeeStructure, Payment

User = get_user_model()

def create_demo_data():
    print("Creating demo data...")
    
    # Create schools based on real examples
    schools = [
        {
            "name": "শ্রীরামপুর উচ্চ বিদ্যালয় (Sreerampur High School)",
            "address": "শ্রীরামপুর, কচুয়া, চাঁদপুর",
            "established": "1958"
        },
        {
            "name": "হাজী মঈন উদ্দিন উচ্চ বিদ্যালয় (Hazi Moin Uddin High School)",
            "address": "চরমাছুয়া, ভেদুরিয়া বাজার, মতলব উত্তর, চাঁদপুর",
            "established": "1992"
        },
        {
            "name": "মতলবগঞ্জ পাইলট বালিকা উচ্চ বিদ্যালয় (Matlabganj Pilot Girls High School)",
            "address": "মতলব দক্ষিণ, চাঁদপুর",
            "established": "1960"
        },
        {
            "name": "ধলাইতলী জনতা উচ্চ বিদ্যালয় (Dhalaitali Janata High School)",
            "address": "ধলাইতলী, চাঁদপুর",
            "established": "1975"
        }
    ]
    
    created_schools = []
    for school_data in schools:
        school = School.objects.create(
            name=school_data["name"],
            address=school_data["address"]
        )
        created_schools.append(school)
        print(f"Created school: {school.name}")
    
    # Use the first school as primary for remaining demo data
    school = created_schools[0]
    
    # Create admin user
    admin_user = User.objects.create_superuser(
        username="admin",
        email="admin@bdapp.com",
        password="admin123",
        first_name="BDapp",
        last_name="Admin",
        is_staff=True
    )
    # Use the first school for admin
    first_school = School.objects.first()
    Profile.objects.create(
        user=admin_user,
        role="admin",
        school=first_school
    )
    print("Created admin user")
    
    # Create classes (based on Bangladesh education system)
    class_names = [
        "ষষ্ঠ শ্রেণী (Class 6)", 
        "সপ্তম শ্রেণী (Class 7)", 
        "অষ্টম শ্রেণী (Class 8)", 
        "নবম শ্রেণী (Class 9)", 
        "দশম শ্রেণী (Class 10)"
    ]
    
    classes = []
    for class_name in class_names:
        class_obj = ClassRoom.objects.create(
            name=class_name,
            school=school
        )
        classes.append(class_obj)
    print(f"Created {len(classes)} classes")
    
    # Create sections
    sections = []
    for class_obj in classes:
        for section_name in ["ক (A)", "খ (B)", "গ (C)"]:
            section = Section.objects.create(
                name=section_name,
                classroom=class_obj
            )
            sections.append(section)
    print(f"Created {len(sections)} sections")
    
    # Create subjects (based on Bangladesh curriculum)
    subjects = [
        "বাংলা (Bangla)", 
        "ইংরেজি (English)", 
        "গণিত (Mathematics)", 
        "বিজ্ঞান (Science)", 
        "সামাজিক বিজ্ঞান (Social Science)", 
        "ধর্ম ও নৈতিক শিক্ষা (Religious Studies)", 
        "তথ্য ও যোগাযোগ প্রযুক্তি (ICT)", 
        "শারীরিক শিক্ষা (Physical Education)",
        "চারু ও কারুকলা (Arts and Crafts)"
    ]
    subject_objs = []
    for subject_name in subjects:
        subject = Subject.objects.create(
            name=subject_name,
            school=school
        )
        subject_objs.append(subject)
    print(f"Created {len(subject_objs)} subjects")
    
    # Create teachers with Bengali names
    teacher_names = [
        {"first": "রহিম", "last": "আহমেদ", "en": "Rahim Ahmed"},
        {"first": "নাজমা", "last": "বেগম", "en": "Nazma Begum"},
        {"first": "কামাল", "last": "হোসেন", "en": "Kamal Hossain"},
        {"first": "শাহানা", "last": "খাতুন", "en": "Shahana Khatun"},
        {"first": "মোস্তাফিজুর", "last": "রহমান", "en": "Mostafizur Rahman"},
        {"first": "নাসরিন", "last": "সুলতানা", "en": "Nasrin Sultana"},
        {"first": "আবদুল", "last": "করিম", "en": "Abdul Karim"},
        {"first": "সালমা", "last": "আক্তার", "en": "Salma Akter"},
        {"first": "জাহিদ", "last": "হাসান", "en": "Zahid Hasan"},
        {"first": "তাসলিমা", "last": "নাসরিন", "en": "Taslima Nasrin"},
        {"first": "মাহমুদুল", "last": "হাসান", "en": "Mahmudul Hasan"},
        {"first": "ফারহানা", "last": "ইসলাম", "en": "Farhana Islam"}
    ]
    
    teachers = []
    for i, name in enumerate(teacher_names):
        username = f"teacher{i+1}"
        teacher_user = User.objects.create_user(
            username=username,
            email=f"{username}@bdapp.com",
            password="teacher123",
            first_name=name["first"],
            last_name=name["last"]
        )
        teacher_profile = Profile.objects.create(
            user=teacher_user,
            role="teacher",
            school=school
        )
        teachers.append(teacher_profile)
    print(f"Created {len(teachers)} teachers")
    
    # Create students with Bengali names
    student_first_names = [
        "আরিফ", "সুমাইয়া", "রাফি", "জান্নাত", "তানভীর", "লামিয়া", 
        "সাজিদ", "নুসরাত", "ফারহান", "সাদিয়া", "তাসনিম", "নাহিদ",
        "মেহেদী", "ফাতেমা", "রাকিব", "নাফিসা", "সাইফ", "রিমা",
        "তানজিম", "নাজনীন", "রাইয়ান", "সাবরিনা", "ইমরান", "আফরিন"
    ]
    
    student_last_names = [
        "হোসেন", "আক্তার", "ইসলাম", "খান", "রহমান", "বেগম",
        "উদ্দিন", "খাতুন", "আহমেদ", "চৌধুরী", "মিয়া", "সরকার"
    ]
    
    students = []
    for i in range(1, 101):
        first_name = random.choice(student_first_names)
        last_name = random.choice(student_last_names)
        username = f"student{i}"
        
        student_user = User.objects.create_user(
            username=username,
            email=f"{username}@bdapp.com",
            password="student123",
            first_name=first_name,
            last_name=last_name
        )
        student_profile = Profile.objects.create(
            user=student_user,
            role="student",
            school=school
        )
        
        # Assign student to a section
        section = random.choice(sections)
        student = StudentProfile.objects.create(
            user=student_user,
            school=school,
            section=section
        )
        students.append(student)
    print(f"Created {len(students)} students")
    
    # Create fee structures with Bengali names
    fee_types = [
        "বার্ষিক ফি (Annual Fee)",
        "পরীক্ষা ফি (Exam Fee)",
        "লাইব্রেরি ফি (Library Fee)",
        "খেলাধুলা ফি (Sports Fee)",
        "ল্যাব ফি (Lab Fee)"
    ]
    
    fee_structures = []
    for class_obj in classes:
        for fee_type in fee_types:
            fee_structure = FeeStructure.objects.create(
                name=f"{fee_type} - {class_obj.name}",
                amount=random.randint(500, 5000),
                due_date=timezone.now().date() + timedelta(days=30),
                school=school
            )
            fee_structures.append(fee_structure)
    print(f"Created {len(fee_structures)} fee structures")
    
    # Create payments
    payment_methods = ["নগদ (Cash)", "বিকাশ (bKash)", "রকেট (Rocket)", "ব্যাংক ট্রান্সফার (Bank Transfer)"]
    payments = []
    for student in students[:50]:  # Only half of students have made payments
        payment = Payment.objects.create(
            student=student.user,
            amount=random.randint(500, 5000),
            payment_date=timezone.now().date() - timedelta(days=random.randint(1, 30)),
            payment_method=random.choice(payment_methods),
            school=school
        )
        payments.append(payment)
    print(f"Created {len(payments)} payments")
    
    # Create attendance records
    attendance_statuses = ["উপস্থিত (Present)", "অনুপস্থিত (Absent)", "বিলম্বিত (Late)"]
    attendance_records = []
    for student in students:
        for _ in range(5):  # 5 attendance records per student
            date = timezone.now().date() - timedelta(days=random.randint(1, 30))
            status = random.choice(attendance_statuses)
            record = AttendanceRecord.objects.create(
                student=student.user,
                date=date,
                status=status,
                school=school
            )
            attendance_records.append(record)
    print(f"Created {len(attendance_records)} attendance records")
    
    print("Demo data creation completed!")

if __name__ == "__main__":
    create_demo_data()