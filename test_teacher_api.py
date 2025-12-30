#!/usr/bin/env python
"""Quick script to test teacher API response"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import Profile
from users.serializers import TeacherProfileSerializer
from django.test import RequestFactory

# Create a fake request for context
factory = RequestFactory()
request = factory.get('/api/users/teachers/')

# Get a teacher
teachers = Profile.objects.select_related('user', 'school').filter(role='teacher')[:1]

if teachers:
    teacher = teachers[0]
    print(f"\n=== Teacher Data ===")
    print(f"ID: {teacher.id}")
    print(f"User: {teacher.user}")
    print(f"Username: {teacher.user.username}")
    print(f"First Name: {teacher.user.first_name}")
    print(f"Last Name: {teacher.user.last_name}")
    print(f"Photo: {teacher.user.photo}")
    print(f"Photo (bool): {bool(teacher.user.photo)}")
    
    # Serialize
    serializer = TeacherProfileSerializer(teacher, context={'request': request})
    data = serializer.data
    
    print(f"\n=== Serialized Data ===")
    import json
    print(json.dumps(data, indent=2, default=str))
    
    print(f"\n=== Photo URL ===")
    print(f"photo_url in user: {data.get('user', {}).get('photo_url')}")
else:
    print("No teachers found")
