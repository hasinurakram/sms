#!/usr/bin/env python
"""Check which users have photos"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

print("=== CHECKING ALL USER PHOTOS ===\n")

total_users = User.objects.count()
users_with_photos = User.objects.exclude(photo='').exclude(photo__isnull=True)

print(f"Total users: {total_users}")
print(f"Users with photos: {users_with_photos.count()}")

if users_with_photos.exists():
    print("\nUsers with photos:")
    for user in users_with_photos[:10]:
        print(f"  - {user.username}: {user.photo}")
else:
    print("\nNO USERS HAVE PHOTOS UPLOADED!")

print("\n=== END CHECK ===")
