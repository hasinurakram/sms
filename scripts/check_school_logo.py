import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()
from schools.models import School
sid = 16
s = School.objects.filter(id=sid).first()
print("Exists:", bool(s))
if s:
    print("Name:", s.name)
    print("Logo:", s.logo)
