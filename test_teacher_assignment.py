#!/usr/bin/env python
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import TeacherAssignment
from academics.serializers import TeacherAssignmentSerializer
import traceback

try:
    ta = TeacherAssignment.objects.first()
    if ta:
        serializer = TeacherAssignmentSerializer(ta)
        data = serializer.data
        print('TeacherAssignment serialization successful!')
except Exception as e:
    print(f'Error: {e}')
    traceback.print_exc()
