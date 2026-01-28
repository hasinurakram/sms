import os
import django
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from academics.models import ClassRoom
from schools.models import School

def list_classrooms():
    schools = School.objects.all()
    for school in schools:
        print(f"\nSchool: {school.name} ({school.id})")
        classrooms = ClassRoom.objects.filter(school=school)
        print(f"Found {classrooms.count()} classrooms:")
        for cls in classrooms:
            print(f"ID: {cls.id}, Name: '{cls.name}'")

if __name__ == "__main__":
    list_classrooms()
