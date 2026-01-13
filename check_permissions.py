from users.permissions import RolePermission
from django.contrib.auth.models import User, AnonymousUser
from unittest.mock import Mock

def check():
    perm = RolePermission()
    
    # Mock user and profile
    user = Mock(spec=User)
    user.is_authenticated = True
    user.is_superuser = False
    user.is_staff = False
    
    profile = Mock()
    profile.role = 'teacher'
    user.profile = profile
    
    request = Mock()
    request.user = user
    request.method = 'POST' # Create
    
    # Check if teacher can create
    can_create = perm.has_permission(request, None)
    print(f"Teacher can create: {can_create}")
    
    # Check if student can create
    profile.role = 'student'
    can_create = perm.has_permission(request, None)
    print(f"Student can create: {can_create}")

if __name__ == "__main__":
    check()
