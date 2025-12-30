#!/usr/bin/env python
"""Test the newly created teacher API response"""
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import Profile, User
from users.serializers import TeacherProfileSerializer
from rest_framework.test import APIRequestFactory

print("=== TESTING NEW TEACHER API RESPONSE ===\n")

# Get the teacher we just created (should have username starting with test_teacher_)
user = User.objects.filter(username__startswith='test_teacher_').order_by('-id').first()

if not user:
    print("No test teacher found!")
else:
    print(f"User: {user.username}")
    print(f"Has photo: {bool(user.photo)}")
    if user.photo:
        print(f"Photo path: {user.photo.path}")
        print(f"Photo URL: {user.photo.url}")
    
    # Get the profile
    try:
        profile = Profile.objects.get(user=user)
        print(f"\nProfile ID: {profile.id}")
        print(f"Role: {profile.role}")
        
        # Create a mock request
        factory = APIRequestFactory()
        request = factory.get('/api/users/teachers/')
        request.META['HTTP_HOST'] = '127.0.0.1:8000'
        
        # Serialize
        serializer = TeacherProfileSerializer(profile, context={'request': request})
        data = serializer.data
        
        print(f"\nSerialized API Response:")
        print(json.dumps(data, indent=2, default=str))
        
        print(f"\n✓ Photo URL in response: {data.get('user', {}).get('photo_url')}")
        
    except Profile.DoesNotExist:
        print("Profile not found!")

print("\n=== END TEST ===")
