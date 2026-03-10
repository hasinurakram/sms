
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import RequestFactory
from schools.views import dashboard_stats
from users.models import User

rf = RequestFactory()
# Simulate a request with school_id=16
request = rf.get('/api/dashboard-stats/', {'school_id': '16'})

# Use a superuser to avoid auth issues in this script
# user = User.objects.filter(is_superuser=True).first()
# request.user = user
request.user = type('obj', (object,), {'is_authenticated': False})()

response = dashboard_stats(request)
print(f"Status: {response.status_code}")
print(json.dumps(response.data, indent=2, default=str))
