#!/usr/bin/env python
"""Test teacher photo data"""
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import Profile, User
from users.serializers import TeacherProfileSerializer
from rest_framework.test import APIRequestFactory

print("=== TESTING TEACHER PHOTO DATA ===\n")

# Get first teacher
teachers = Profile.objects.filter(role='teacher').select_related('user')[:3]

print(f"Found {teachers.count()} teachers\n")

for teacher in teachers:
    print(f"\nTeacher: {teacher.user.first_name} {teacher.user.last_name}")
    print(f"Username: {teacher.user.username}")
    print(f"Has photo field: {hasattr(teacher.user, 'photo')}")
    if hasattr(teacher.user, 'photo'):
        print(f"Photo value: {teacher.user.photo}")
        print(f"Photo bool: {bool(teacher.user.photo)}")
        if teacher.user.photo:
            print(f"Photo path: {teacher.user.photo.path if hasattr(teacher.user.photo, 'path') else 'N/A'}")
            print(f"Photo url: {teacher.user.photo.url if hasattr(teacher.user.photo, 'url') else 'N/A'}")
    
    # Test serialization
    factory = APIRequestFactory()
    request = factory.get('/api/users/teachers/')
    request.META['HTTP_HOST'] = '127.0.0.1:8000'
    request.META['SERVER_NAME'] = '127.0.0.1'
    request.META['SERVER_PORT'] = '8000'
    
    serializer = TeacherProfileSerializer(teacher, context={'request': request})
    data = serializer.data
    
    print(f"\nSerialized data:")
    print(f"  user.photo: {data.get('user', {}).get('photo')}")
    print(f"  user.photo_url: {data.get('user', {}).get('photo_url')}")
    print("-" * 60)

print("\n=== END TEST ===")
