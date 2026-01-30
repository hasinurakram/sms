import os
import sys
import django

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile, ClassRoom
from schools.models import School
from users.models import User, Profile
from django.db.models import Case, When, Value, IntegerField
from django.db.models.functions import Cast

def run():
    print("Setting up test data...")
    # Setup Data
    school_name = "Sort Test School"
    # Cleanup first
    School.objects.filter(name=school_name).delete()
    User.objects.filter(username__startswith="sort_student_").delete()
    
    school = School.objects.create(name=school_name)
    c1 = ClassRoom.objects.create(school=school, name="Class Sort")
    
    rolls = ["10", "1", "2", "20", "", None, "A-1", "3"]
    
    for i, r in enumerate(rolls):
        username = f"sort_student_{i}"
        u = User.objects.create_user(username=username, password="p")
        if hasattr(u, 'profile'):
            u.profile.school = school
            u.profile.role = 'student'
            u.profile.save()
        else:
            Profile.objects.create(user=u, school=school, role='student')
        StudentProfile.objects.create(user=u, school=school, classroom=c1, roll_number=r)

    print("Created students with rolls:", rolls)

    # Test Query Logic
    print("Running query...")
    queryset = StudentProfile.objects.filter(school=school)
    
    queryset = queryset.annotate(
        has_roll=Case(
            When(roll_number__isnull=False, roll_number__gt='', then=1),
            default=0,
            output_field=IntegerField(),
        ),
        roll_int=Case(
            When(roll_number__regex=r'^\d+$', then=Cast('roll_number', IntegerField())),
            default=Value(None),
            output_field=IntegerField(),
        )
    ).order_by('-has_roll', 'roll_int', 'roll_number')
    
    sorted_rolls = list(queryset.values_list('roll_number', flat=True))
    print("Sorted Rolls:", sorted_rolls)
    
    # Expected Order Analysis:
    # 1. has_roll=1 group: "1", "10", "2", "20", "A-1", "3"
    #    Within this:
    #    roll_int values: 1, 10, 2, 20, None (for A-1), 3
    #    Sort by roll_int ASC (NULLS LAST default in Postgres?) -> 1, 2, 3, 10, 20, None
    #    So "A-1" should be last in this group.
    # 2. has_roll=0 group: "", None
    
    # Expected Result: ['1', '2', '3', '10', '20', 'A-1', '', None] (or None, '')
    
    # Cleanup
    print("Cleaning up...")
    School.objects.filter(name=school_name).delete()
    User.objects.filter(username__startswith="sort_student_").delete()

if __name__ == "__main__":
    run()