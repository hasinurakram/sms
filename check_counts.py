
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile, ClassRoom, Subject
from users.models import Profile
from schools.models import School

sid = 16
s = School.objects.filter(id=sid).first()
print(f'School: {s}')
print(f'Students: {StudentProfile.objects.filter(school_id=sid).count()}')
print(f'Teachers: {Profile.objects.filter(school_id=sid, role="teacher").count()}')
print(f'Parents: {Profile.objects.filter(school_id=sid, role="parent").count()}')
print(f'Classes: {ClassRoom.objects.filter(school_id=sid).count()}')
print(f'Subjects: {Subject.objects.filter(school_id=sid).count()}')
