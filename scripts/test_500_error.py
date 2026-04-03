import os
import django
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from django.contrib.auth import get_user_model
from schools.models import School
from academics.models import StudentProfile, ClassRoom
from users.models import AIChatSession, AIChatMessage, Profile
from users.assistant_logic import AssistantLogic
from rest_framework.test import APIRequestFactory, force_authenticate

User = get_user_model()

def test_flow():
    factory = APIRequestFactory()
    user = User.objects.filter(is_superuser=True).first() or User.objects.first()
    if not user:
        user = User.objects.create_user(username='test_admin', password='password')
    
    school = School.objects.first()
    if not hasattr(user, 'profile'):
        Profile.objects.create(user=user, school=school, role='admin')
    
    session = AIChatSession.objects.create(user=user, school=school, title="Test Flow")
    
    request = factory.get('/')
    request.user = user
    logic = AssistantLogic(request, school_id=school.id)
    
    # 1. Ask for name search
    query1 = "ইশরাত জাহান নামে কয়জন স্টুডেন্ট আছে?"
    print(f"Query 1: {query1}")
    resp1 = logic.get_response(query1, {'session_id': session.id})
    print(f"Response 1: {resp1}")
    
    if resp1:
        AIChatMessage.objects.create(session=session, role='user', content=query1)
        AIChatMessage.objects.create(session=session, role='assistant', content=resp1['text'])
    
    # 2. Ask for details
    query2 = "ইশরাত জাহান নামে যারা আছে তাদের সম্পর্কে বিস্তারিত তথ্য দাও"
    print(f"Query 2: {query2}")
    try:
        resp2 = logic.get_response(query2, {'session_id': session.id})
        print(f"Response 2: {resp2}")
    except Exception as e:
        print(f"Query 2 ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Ensure there's a student named Ishrat Jahan for testing
    school = School.objects.first()
    u, _ = User.objects.get_or_create(username='ishrat_test', defaults={'first_name': 'ইশরাত', 'last_name': 'জাহান'})
    if not hasattr(u, 'profile'):
        Profile.objects.create(user=u, school=school, role='student')
    
    classroom = ClassRoom.objects.first()
    StudentProfile.objects.get_or_create(user=u, school=school, defaults={'classroom': classroom, 'roll_number': 101})
    
    test_flow()
