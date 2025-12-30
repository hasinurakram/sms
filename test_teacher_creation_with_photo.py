#!/usr/bin/env python
"""Test creating a teacher with photo"""
import os
import django
from io import BytesIO
from PIL import Image

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.core.files.uploadedfile import SimpleUploadedFile
from users.serializers import TeacherProfileSerializer
from schools.models import School

print("=== TESTING TEACHER CREATION WITH PHOTO ===\n")

# Get a school
school = School.objects.first()
if not school:
    print("No school found!")
    exit()

print(f"Using school: {school.name}\n")

# Create a test image
img = Image.new('RGB', (100, 100), color='red')
img_io = BytesIO()
img.save(img_io, format='JPEG')
img_io.seek(0)
photo_file = SimpleUploadedFile("test_teacher.jpg", img_io.read(), content_type="image/jpeg")

# Test data with unique username
import time
unique_username = f'test_teacher_{int(time.time())}'
data = {
    'school_id': school.id,
    'username': unique_username,
    'password': 'testpass123',
    'first_name': 'Test',
    'last_name': 'Teacher',
    'email': 'test@example.com',
    'phone_number': '+8801712345678',
    'photo': photo_file
}

print("Creating teacher with photo...")
serializer = TeacherProfileSerializer(data=data)

if serializer.is_valid():
    teacher_profile = serializer.save()
    print(f"✓ Teacher created: {teacher_profile.user.username}")
    print(f"  User ID: {teacher_profile.user.id}")
    print(f"  Profile ID: {teacher_profile.id}")
    print(f"  Has photo: {bool(teacher_profile.user.photo)}")
    if teacher_profile.user.photo:
        print(f"  Photo path: {teacher_profile.user.photo.path}")
        print(f"  Photo URL: {teacher_profile.user.photo.url}")
    else:
        print("  ✗ PHOTO NOT SAVED!")
else:
    print(f"✗ Validation errors: {serializer.errors}")

print("\n=== END TEST ===")
