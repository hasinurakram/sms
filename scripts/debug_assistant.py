import os
import django
import sys
import json

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth import get_user_model
from schools.models import School
from users.views import SoftwareAssistantView

User = get_user_model()

def test_query(query):
    factory = APIRequestFactory()
    # Mocking authenticated request
    user = User.objects.filter(is_superuser=True).first() or User.objects.first()
    if not user:
        print("No user found.")
        return
        
    school = School.objects.first()
    if not hasattr(user, 'profile'):
        from users.models import Profile
        Profile.objects.create(user=user, school=school, role='admin')
    
    request = factory.get('/api/users/assistant/', {'q': query, 'school': school.id if school else None})
    force_authenticate(request, user=user)
    
    view = SoftwareAssistantView.as_view()
    try:
        response = view(request)
        print(f"Query: {query}")
        if hasattr(response, 'data'):
            print(f"Response: {response.data}")
        else:
            print(f"Status: {response.status_code}")
            print(f"Content: {response.content}")
        print("-" * 20)
    except Exception as e:
        print(f"Query: {query}")
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        print("-" * 20)

if __name__ == "__main__":
    from users.models import AIChatSession, AIChatMessage
    user = get_user_model().objects.filter(is_superuser=True).first() or get_user_model().objects.first()
    school = School.objects.first()
    
    # 1. Test teacher follow-up
    print("Testing teacher follow-up...")
    session = AIChatSession.objects.create(user=user, school=school, title="Teacher Test")
    AIChatMessage.objects.create(session=session, role='user', content="গণিতের টিচার আছে কে কে?")
    AIChatMessage.objects.create(session=session, role='assistant', content="**Math** বিষয়ের শিক্ষকরা হলেন: **মোঃ শহিদ উল্লাহ**।")
    
    # Second query: asking for phone number
    query = "তাদের মোবাইল নাম্বার দাও"
    factory = APIRequestFactory()
    request = factory.get('/api/users/assistant/', {'q': query, 'school': school.id, 'session_id': session.id})
    force_authenticate(request, user=user)
    view = SoftwareAssistantView.as_view()
    try:
        response = view(request)
        print(f"Query: {query}")
        print(f"Response: {response.data}")
    except Exception as e:
        print(f"Error: {e}")
    print("-" * 20)
    
    # 2. Test attendance pending query
    print("Testing attendance pending query...")
    test_query("আজকের হাজিরা বাকি আছে কোন কোন ক্লাসে?")
