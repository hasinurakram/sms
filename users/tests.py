from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model
from schools.models import School
from users.models import Profile
from users.permissions import IsSchoolMember

User = get_user_model()

class PermissionTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.school1 = School.objects.create(name="School 1")
        self.school2 = School.objects.create(name="School 2")
        
        self.user1 = User.objects.create_user(username="user1", password="password")
        self.profile1 = Profile.objects.create(user=self.user1, school=self.school1, role="admin")
        
        self.user2 = User.objects.create_user(username="user2", password="password")
        self.profile2 = Profile.objects.create(user=self.user2, school=self.school2, role="admin")
        
        self.superuser = User.objects.create_superuser(username="admin", password="password", email="admin@test.com")

    def test_is_school_member_permission(self):
        permission = IsSchoolMember()
        
        # Request for school 1 by user 1 (Allowed)
        request = self.factory.get('/api/academics/students/?school=' + str(self.school1.id))
        request.user = self.user1
        request.current_school = self.school1
        self.assertTrue(permission.has_permission(request, None))
        
        # Request for school 2 by user 1 (Denied)
        request = self.factory.get('/api/academics/students/?school=' + str(self.school2.id))
        request.user = self.user1
        request.current_school = self.school2
        self.assertFalse(permission.has_permission(request, None))
        
        # Superuser (Allowed everywhere)
        request = self.factory.get('/api/academics/students/?school=' + str(self.school2.id))
        request.user = self.superuser
        request.current_school = self.school2
        self.assertTrue(permission.has_permission(request, None))
