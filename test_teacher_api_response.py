#!/usr/bin/env python
"""Test teacher API response with photo"""
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import Profile
from users.serializers import TeacherProfileSerializer
from rest_framework.test import APIRequestFactory

print("=== TESTING TEACHER API RESPONSE ===\n")

# Get the teacher we just created
teacher = Profile.objects.filter(role='teacher', user__photo__isnull=False).first()

if not teacher:
    print("No teacher with photo found!")
else:
    print(f"Teacher: {teacher.user.first_name} {teacher.user.last_name}")
    print(f"Username: {teacher.user.username}")
    print(f"Photo: {teacher.user.photo}")
    
    # Create a mock request
    factory = APIRequestFactory()
    request = factory.get('/api/users/teachers/')
    request.META['HTTP_HOST'] = '127.0.0.1:8000'
    
    # Serialize
    serializer = TeacherProfileSerializer(teacher, context={'request': request})
    data = serializer.data
    
    print(f"\nSerialized API Response:")
    print(json.dumps(data, indent=2, default=str))
    
    print(f"\nPhoto URL: {data.get('user', {}).get('photo_url')}")
    print(f"Photo field: {data.get('user', {}).get('photo')}")

print("\n=== END TEST ===")
