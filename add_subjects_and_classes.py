"""
Quick Setup Script: Add Subjects and Classes to School

Run this script to quickly add common subjects and classes to your school.
Usage: python add_subjects_and_classes.py
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import ClassRoom, Subject
from schools.models import School

def setup_school(school_id):
    """Add subjects and classes to a school"""
    
    try:
        school = School.objects.get(id=school_id)
        print(f"✅ Found school: {school.name}")
    except School.DoesNotExist:
        print(f"❌ School with ID {school_id} not found!")
        return
    
    # Add Classes
    print("\n📚 Adding Classes...")
    classes = [
        'Class 6 (ষষ্ঠ শ্রেণী)',
        'Class 7 (সপ্তম শ্রেণী)',
        'Class 8 (অষ্টম শ্রেণী)',
        'Class 9 (নবম শ্রেণী)',
        'Class 10 (দশম শ্রেণী)',
    ]
    
    for class_name in classes:
        classroom, created = ClassRoom.objects.get_or_create(
            school=school,
            name=class_name
        )
        if created:
            print(f"  ✅ Created: {class_name}")
        else:
            print(f"  ℹ️  Already exists: {class_name}")
    
    # Add Subjects
    print("\n📖 Adding Subjects...")
    subjects = [
        ('বাংলা (Bengali)', 'BANG'),
        ('ইংরেজি (English)', 'ENG'),
        ('গণিত (Mathematics)', 'MATH'),
        ('বিজ্ঞান (Science)', 'SCI'),
        ('সামাজিক বিজ্ঞান (Social Science)', 'SS'),
        ('ধর্ম ও নৈতিক শিক্ষা (Religion)', 'REL'),
        ('কৃষি শিক্ষা (Agriculture)', 'AGR'),
        ('তথ্য ও যোগাযোগ প্রযুক্তি (ICT)', 'ICT'),
        ('শারীরিক শিক্ষা (Physical Education)', 'PE'),
    ]
    
    for subject_name, subject_code in subjects:
        subject, created = Subject.objects.get_or_create(
            school=school,
            name=subject_name,
            defaults={'code': subject_code}
        )
        if created:
            print(f"  ✅ Created: {subject_name} ({subject_code})")
        else:
            print(f"  ℹ️  Already exists: {subject_name} ({subject_code})")
    
    print("\n" + "="*60)
    print("🎉 SETUP COMPLETE!")
    print("="*60)
    print(f"School: {school.name}")
    print(f"Classes: {ClassRoom.objects.filter(school=school).count()}")
    print(f"Subjects: {Subject.objects.filter(school=school).count()}")
    print("\n✅ You can now add teachers and students!")
    print("🔄 Refresh your frontend page to see the changes.")
    print("="*60)

if __name__ == '__main__':
    print("="*60)
    print("🏫 SCHOOL SETUP SCRIPT")
    print("="*60)
    
    # List all schools
    schools = School.objects.all()
    if not schools:
        print("❌ No schools found! Please create a school first.")
        exit()
    
    print("\nAvailable Schools:")
    for school in schools:
        print(f"  {school.id}. {school.name}")
    
    # Get school ID from user
    school_id = input("\nEnter School ID to setup: ").strip()
    
    try:
        school_id = int(school_id)
        setup_school(school_id)
    except ValueError:
        print("❌ Invalid school ID! Please enter a number.")
    except KeyboardInterrupt:
        print("\n\n❌ Setup cancelled.")
