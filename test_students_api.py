
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import RequestFactory
from academics.views import StudentProfileViewSet

rf = RequestFactory()
view = StudentProfileViewSet.as_view({'get': 'list'})

# Test with school=16
request = rf.get('/api/academics/students/', {'school': 16})
response = view(request)
print(f"Status: {response.status_code}")
data = response.data
if isinstance(data, dict):
    results = data.get('results', [])
    print(f"Count (dict): {data.get('count', len(results))}")
else:
    print(f"Count (list): {len(data)}")
