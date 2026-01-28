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
from users.models import Profile
from academics.models import StudentProfile

User = get_user_model()

def test_query(query, school_id=None):
    factory = RequestFactory()
    params = {'q': query}
    if school_id:
        params['school'] = str(school_id)
        
    request = factory.get('/api/users/assistant/', params)
    
    # We need a user. Let's pick the first one or create one.
    user = User.objects.first()
    if not user:
        print("No user found. Cannot test.")
        return
        
    # Ensure user has a profile with a school
    school = School.objects.first()
    if not school:
        school = School.objects.create(name="Test School", code="TS001")
    
    # Check if user has profile, if not create one
    if not hasattr(user, 'profile'):
        Profile.objects.create(user=user, school=school, role='teacher')
    else:
        # Ensure the profile has a school
        if not user.profile.school:
            user.profile.school = school
            user.profile.save()
        
    request.user = user
    
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
    print("Testing Blood Group Queries:")
    test_query("কোন রক্তের গ্রুপের আইডি বেশি?")
    test_query("Which blood group has most students?")
    
    print("\nTesting School Count Queries:")
    # We need to pass a school ID for school counts if we want to simulate properly, 
    # though the code might pick it up from user profile if not passed in params? 
    # Let's check code: if not school_id: return Error. 
    # school_id comes from request.query_params.get('school') OR user.profile.school_id
    
    # Let's see how school_id is resolved in views.py
    # school_id = request.query_params.get('school')
    # if not school_id and hasattr(request.user, 'profile') and request.user.profile.school:
    #    school_id = request.user.profile.school.id
    
    # So it should work without explicit param if user has school.
    
    # Cleanup previous test schools
    School.objects.filter(name="Test School 2").delete()
    User.objects.filter(username__startswith="student1_").delete()
    User.objects.filter(username__startswith="student6_").delete()
    
    # Create a school with proper class names for testing
    school = School.objects.create(name="Test School 2")
    from academics.models import ClassRoom, Section
    # Create classes
    c1, _ = ClassRoom.objects.get_or_create(school=school, name="প্রথম শ্রেণি")
    c6, _ = ClassRoom.objects.get_or_create(school=school, name="ষষ্ঠ শ্রেণি")
    
    # Create students
    # 5 students in class 1
    for i in range(5):
        username = f"student1_{i}"
        if not User.objects.filter(username=username).exists():
            u = User.objects.create_user(username=username, password="password")
            if hasattr(u, 'profile'):
                p = u.profile
                p.school = school
                p.role = 'student'
                p.save()
            else:
                p = Profile.objects.create(user=u, school=school, role='student')
            StudentProfile.objects.create(user=u, school=school, classroom=c1, roll_number=i+1)
        
    # 10 students in class 6
    for i in range(10):
        username = f"student6_{i}"
        if not User.objects.filter(username=username).exists():
            u = User.objects.create_user(username=username, password="password")
            if hasattr(u, 'profile'):
                p = u.profile
                p.school = school
                p.role = 'student'
                p.save()
            else:
                p = Profile.objects.create(user=u, school=school, role='student')
            StudentProfile.objects.create(user=u, school=school, classroom=c6, roll_number=i+1)
        
    sid = school.id
    
    print(f"Testing with school {school.name} (ID: {sid})")
    print("Class 1: 5 students, Class 6: 10 students")
    
    test_query("ক্লাস সিক্সে কতজন শিক্ষার্থী আছে", school_id=sid)
