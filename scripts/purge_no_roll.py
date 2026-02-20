import os
import sys
import io
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()
from django.db.models import Q, Count
from django.db import transaction
from academics.models import StudentProfile
from users.models import User
targets = StudentProfile.objects.filter(Q(roll_number__isnull=True) | Q(roll_number__exact=''))
total = targets.count()
stats = list(targets.values('school_id').annotate(deleted=Count('id')).order_by('school_id'))
uids = list(targets.values_list('user_id', flat=True))
print("TOTAL:", total)
print("BY_SCHOOL:", stats)
with transaction.atomic():
    User.objects.filter(id__in=uids).delete()
print("DELETED_USERS:", len(uids))
