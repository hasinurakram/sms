#!/usr/bin/env python
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import Subject
from academics.serializers import SubjectSerializer
import traceback

try:
    subject = Subject.objects.first()
    if subject:
        serializer = SubjectSerializer(subject)
        data = serializer.data
        print('Subject serialization successful!')
        print(f'Has assigned_teachers: {"assigned_teachers" in data}')
except Exception as e:
    print(f'Error: {e}')
    traceback.print_exc()
