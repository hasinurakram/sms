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
    
    # We need a user context
    user = User.objects.first()
    if not user:
        user = User.objects.create_user(username='test_admin', password='password')
    
    request.user = user
    
    view = SoftwareAssistantView.as_view()
    try:
        response = view(request)
        print(f"Query: {query}")
        print(f"Response Text: {response.data.get('text')}")
        users_list = response.data.get('users_list')
        if users_list:
            print(f"Users List ({len(users_list)}):")
            for u in users_list:
                print(f" - {u['name']} ({u['role']}): {u['phone']}")
        else:
            print("Users List: None")
        print("-" * 20)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Setup test data
    print("Setting up test data...")
    school = School.objects.create(name="Blood Group Test School")
    
    # Create B+ students
    for i in range(3):
        username = f"bg_student_{i}"
        User.objects.filter(username=username).delete()
        u = User.objects.create_user(username=username, password="password", phone_number=f"+880170000000{i}")
        u.first_name = f"Student{i}"
        u.last_name = "Test"
        u.save()
        
        # Create Profile
        if not hasattr(u, 'profile'):
            Profile.objects.create(user=u, school=school, role='student', blood_group='B+')
        else:
            u.profile.school = school
            u.profile.role = 'student'
            u.profile.blood_group = 'B+'
            u.profile.save()
            
        # Create StudentProfile
        StudentProfile.objects.create(user=u, school=school, blood_group='B+')

    # Create A+ student (noise)
    username = "bg_student_diff"
    User.objects.filter(username=username).delete()
    u = User.objects.create_user(username=username, password="password", phone_number="+8801800000000")
    
    if not hasattr(u, 'profile'):
        Profile.objects.create(user=u, school=school, role='student', blood_group='A+')
    else:
        u.profile.school = school
        u.profile.role = 'student'
        u.profile.blood_group = 'A+'
        u.profile.save()
    
    print("Testing B+ query...")
    test_query("B+ রক্তের গ্রুপের কতজন আছে?", school_id=school.id)
    
    # Cleanup
    # school.delete() # Keep for manual check if needed, but usually better to clean. 
    # Actually I will clean up to avoid DB clutter.
    school.delete()
    User.objects.filter(username__startswith="bg_student_").delete()
