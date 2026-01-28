import os
import django
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from users.views import SoftwareAssistantView
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from schools.models import School
from academics.models import StudentProfile, ClassRoom

User = get_user_model()

def test_query(query):
    factory = RequestFactory()
    request = factory.get('/api/users/assistant/', {'q': query})
    
    # We need a user. Let's pick the first one or create one.
    user = User.objects.first()
    if not user:
        print("No user found. Cannot test.")
        return
    
    # Ensure user has a profile with a school
    school = School.objects.first()
    if not school:
        school = School.objects.create(name="Test School", code="TS001")
        
    if not hasattr(user, 'profile'):
        from users.models import Profile
        Profile.objects.create(user=user, school=school, role='teacher')
    else:
        user.profile.school = school
        user.profile.save()
        
    request.user = user
    # Pass school_id in query params as well to mimic frontend behavior sometimes
    request.GET = request.GET.copy()
    request.GET['school'] = str(school.id)
    
    view = SoftwareAssistantView.as_view()
    try:
        response = view(request)
        print(f"Query: {query}")
        print(f"Response: {response.data}")
        print("-" * 20)
    except Exception as e:
        print(f"Query: {query}")
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        print("-" * 20)

if __name__ == "__main__":
    test_query("ক্লাস সিক্সে কতজন শিক্ষার্থী আছে")
