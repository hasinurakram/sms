import os
import sys
import django
import re

# Add the project root to sys.path
sys.path.append('F:\\Project')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.assistant_logic import AssistantLogic
from users.models import AIChatSession, AIChatMessage, User

def test_context():
    # Setup test data
    user = User.objects.first()
    school_id = user.profile.school_id
    
    session = AIChatSession.objects.create(user=user, school_id=school_id, title="Test Session")
    
    # Message 1: User asks about Class 6
    query1 = "ক্লাস সিক্সে কতজন স্টুডেন্ট আছে?"
    AIChatMessage.objects.create(session=session, role='user', content=query1)
    
    # Message 2: Assistant answers (simulate)
    AIChatMessage.objects.create(session=session, role='assistant', content="ষষ্ঠ শ্রেণি-এ মোট 216 জন শিক্ষার্থী রয়েছে।")
    
    # Message 3: User asks follow-up
    query2 = "ছেলে কত? আর মেয়ে কতজন?"
    
    # Mock request
    class MockRequest:
        def __init__(self, user):
            self.user = user
    
    request = MockRequest(user)
    logic = AssistantLogic(request, school_id=school_id)
    
    # Test logic.get_response
    print(f"Query: {query2}")
    resp = logic.get_response(query2, extra_params={'session_id': session.id})
    print(f"Response: {resp['text']}")
    
    # Clean up
    session.delete()

if __name__ == '__main__':
    test_context()
