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

class SubjectResultWritePermission(permissions.BasePermission):
    message = 'এই সাবজেক্টে রেজাল্ট ইনপুট দেবার জন্য আপনি অনুমোদিত নন। দয়া করে আপনার প্রতিষ্ঠানের প্রধান শিক্ষক অথবা এ্যাডমিনের সাথে যোগাযোগ করুন।'
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
            return True
        profile = getattr(user, 'profile', None)
        role = getattr(profile, 'role', None) if profile else None
        if role in ('admin', 'super_admin'):
            return True
        try:
            from academics.models import TeacherAssignment
            from results.models import Examination, Result
            subject_id = None
            classroom_id = None
            section_id = None
            if request.method == 'POST':
                subject_id = request.data.get('subject') or request.data.get('subject_id')
                exam_id = request.data.get('examination') or request.data.get('examination_id') or view.kwargs.get('pk')
                if not subject_id or not exam_id:
                    return False
                exam = Examination.objects.filter(id=exam_id).first()
                if not exam:
                    return False
                classroom_id = exam.classroom_id
                section_id = exam.section_id
            else:
                obj = getattr(view, 'get_object', None)
                target = obj() if callable(obj) else None
                if not target:
                    return False
                subject_id = getattr(target, 'subject_id', None)
                classroom_id = getattr(getattr(target, 'examination', None), 'classroom_id', None)
                section_id = getattr(getattr(target, 'examination', None), 'section_id', None
                )
            qs = TeacherAssignment.objects.filter(teacher=user, subject_id=subject_id, classroom_id=classroom_id)
            if section_id is not None:
                qs = qs.filter(section_id=section_id)
            return qs.exists()
        except Exception:
            return False
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
            return True
        profile = getattr(user, 'profile', None)
        role = getattr(profile, 'role', None) if profile else None
        if role in ('admin', 'super_admin'):
            return True
        try:
            from academics.models import TeacherAssignment
            subject_id = getattr(obj, 'subject_id', None)
            classroom_id = getattr(getattr(obj, 'examination', None), 'classroom_id', None)
            section_id = getattr(getattr(obj, 'examination', None), 'section_id', None)
            qs = TeacherAssignment.objects.filter(teacher=user, subject_id=subject_id, classroom_id=classroom_id)
            if section_id is not None:
                qs = qs.filter(section_id=section_id)
            return qs.exists()
        except Exception:
            return False
