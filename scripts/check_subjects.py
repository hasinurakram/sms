import os
import django
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from academics.models import Subject, TeacherAssignment
from django.contrib.auth import get_user_model

User = get_user_model()
print("Subjects:")
for s in Subject.objects.all():
    teachers = User.objects.filter(id__in=TeacherAssignment.objects.filter(subject=s).values_list('teacher_id', flat=True))
    t_names = [t.get_full_name() or t.username for t in teachers]
    print(f" - {s.name}: {', '.join(t_names)}")
