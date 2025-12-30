from rest_framework import permissions

class RolePermission(permissions.BasePermission):
    """
    Simple role based permission.
    - ReadOnly allowed to everyone (IsAuthenticatedOrReadOnly globally covers it)
    - Create/Update/Delete allowed based on role mapping
    """

    role_map = {
        'student': ['view'],
        'parent': ['view'],
        'teacher': ['view', 'create', 'change', 'delete'],
        'committee': ['view', 'create', 'change'],
        'admin': ['view', 'change', 'create', 'delete'],
    }

    def has_permission(self, request, view):
        # Allow safe methods (GET, HEAD, OPTIONS)
        if request.method in permissions.SAFE_METHODS:
            return True

        # if unauthenticated, deny for write
        if not request.user or not request.user.is_authenticated:
            return False

        # Allow staff or superuser for write operations
        if getattr(request.user, 'is_superuser', False) or getattr(request.user, 'is_staff', False):
            return True

        # get role
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return False
        role = profile.role

        # map method to action
        if request.method == 'POST':
            action = 'create'
        elif request.method in ('PUT','PATCH'):
            action = 'change'
        elif request.method == 'DELETE':
            action = 'delete'
        else:
            action = 'view'

        allowed = self.role_map.get(role, [])
        return action in allowed

class AdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if getattr(user, 'is_staff', False):
            return True
        profile = getattr(user, 'profile', None)
        return bool(profile and getattr(profile, 'role', None) == 'admin')
