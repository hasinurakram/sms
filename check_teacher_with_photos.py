#!/usr/bin/env python
"""Check if any teachers have photos"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from users.models import Profile

User = get_user_model()

print("=== CHECKING TEACHERS WITH PHOTOS ===\n")

# Get all teacher profiles
teacher_profiles = Profile.objects.filter(role='teacher').select_related('user')
print(f"Total teachers: {teacher_profiles.count()}")

# Check which teachers have photos
teachers_with_photos = []
for profile in teacher_profiles:
    user = profile.user
    if user.photo:
        teachers_with_photos.append((user.username, user.first_name, user.last_name, user.photo))

print(f"Teachers with photos: {len(teachers_with_photos)}")

if teachers_with_photos:
    print("\nTeachers with photos:")
    for username, first, last, photo in teachers_with_photos:
        print(f"  - {username} ({first} {last}): {photo}")
else:
    print("\nNO TEACHERS HAVE PHOTOS!")
    print("\nThis is why teacher photos don't display on:")
    print("  - Teacher cards")
    print("  - ID cards")
    print("  - Any other teacher-related pages")

print("\n=== SOLUTION ===")
print("To fix this, teachers need to upload their photos through:")
print("1. The teacher management page (if photo upload is enabled)")
print("2. Django admin panel")
print("3. Or by running a script to assign photos to teachers")

print("\n=== END CHECK ===")
