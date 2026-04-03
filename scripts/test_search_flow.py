import os
import django
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from django.contrib.auth import get_user_model
from schools.models import School
from academics.models import StudentProfile, ClassRoom, Section
from users.models import AIChatSession, AIChatMessage, Profile
from users.assistant_logic import AssistantLogic
from rest_framework.test import APIRequestFactory, force_authenticate

User = get_user_model()

def test_flow():
    factory = APIRequestFactory()
    user = User.objects.filter(is_superuser=True).first() or User.objects.first()
    school = School.objects.first()
    
    request = factory.get('/')
    request.user = user
    logic = AssistantLogic(request, school_id=school.id)
    
    # 1. Complex query: Eighth grade Ishrat
    session = AIChatSession.objects.create(user=user, school=school, title="Complex Search")
    query1 = "অষ্টম শ্রেণিতে ইশরাত নামে কয়জন ছাত্রী আছে?"
    print(f"Query 1: {query1}")
    resp1 = logic.get_response(query1, {'session_id': session.id})
    print(f"Response 1: {resp1['text']}")
    
    # 2. Short name query
    query2 = "ইশরাত জাহান?"
    print(f"\nQuery 2: {query2}")
    resp2 = logic.get_response(query2, {'session_id': session.id})
    print(f"Response 2: {resp2['text']}")
    
    # 3. Blood group query
    query3 = "বি পজিটিভ রক্তের গ্রুপের কয়জন আছে?"
    print(f"\nQuery 3: {query3}")
    resp3 = logic.get_response(query3, {'session_id': session.id})
    print(f"Response 3: {resp3['text']}")

if __name__ == "__main__":
    # Setup test data
    school = School.objects.first()
    # Create Class 8
    cls8, _ = ClassRoom.objects.get_or_create(school=school, name="অষ্টম শ্রেণি")
    # Create Class 7
    cls7, _ = ClassRoom.objects.get_or_create(school=school, name="সপ্তম শ্রেণি")
    
    # Ishrat in Class 8
    u1, _ = User.objects.get_or_create(username='ishrat8', defaults={'first_name': 'ইশরাত', 'last_name': 'জাহান'})
    StudentProfile.objects.update_or_create(user=u1, defaults={'school': school, 'classroom': cls8, 'roll_number': 1, 'gender': 'female', 'blood_group': 'B+'})
    
    # Ishrat in Class 7
    u2, _ = User.objects.get_or_create(username='ishrat7', defaults={'first_name': 'ইশরাত', 'last_name': 'জাহান'})
    StudentProfile.objects.update_or_create(user=u2, defaults={'school': school, 'classroom': cls7, 'roll_number': 2, 'gender': 'female', 'blood_group': 'A+'})
    
    test_flow()
