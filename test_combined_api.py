#!/usr/bin/env python
"""Test the combined overall result API"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.views import StudentOverallResultViewSet
from rest_framework.test import APIRequestFactory
from academics.models import StudentProfile

print("=== TESTING COMBINED API ===\n")

# Get Aysha (ID: 919)
student = StudentProfile.objects.get(id=919)
print(f"Student: {student.user.first_name} {student.user.last_name}")
print(f"Class: {student.classroom.name if student.classroom else 'N/A'}")
print(f"Class ID: {student.classroom.id if student.classroom else 'N/A'}")

# Create a mock request
factory = APIRequestFactory()
request = factory.get(
    '/api/results/overall/combined_by_exam_type/',
    {
        'student': student.id,
        'exam_type': 'half_yearly',
        'classroom': student.classroom.id
    }
)

# Call the view
view = StudentOverallResultViewSet.as_view({'get': 'combined_by_exam_type'})
response = view(request)

print(f"\nAPI Response Status: {response.status_code}")
print(f"Response Data:")
import json
print(json.dumps(response.data, indent=2, ensure_ascii=False))

print("\n=== END TEST ===")
