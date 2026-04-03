from rest_framework import serializers
from schools.models import School
from .models import ClassRoom, Section, Subject, StudentProfile, TeacherAssignment, VirtualClass
from django.contrib.auth import get_user_model
from users.models import Profile

User = get_user_model()

class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ['id', 'name', 'address']

class SimpleUserSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    mobile_number = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'phone_number', 'photo', 'photo_url', 'mobile_number', 'educational_qualification']
    
    def get_photo_url(self, obj):
        try:
            if getattr(obj, 'photo', None):
                request = self.context.get('request')
                if request:
                    absolute_url = request.build_absolute_uri(obj.photo.url)
                    return absolute_url
                # Fallback if no request context
                photo_url = obj.photo.url
                return photo_url
        except Exception:
            # Silently handle any errors, including Unicode issues
            pass
        return None
    
    def get_mobile_number(self, obj):
        """Return phone_number as mobile_number for consistency"""
        return getattr(obj, 'phone_number', None)

class ClassRoomSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)
    school_id = serializers.PrimaryKeyRelatedField(source='school', queryset=School.objects.all(), write_only=True)
    student_count = serializers.SerializerMethodField()
    sections = serializers.SerializerMethodField()
    
    def get_student_count(self, obj):
        # Use annotated value if available to avoid extra query
        return getattr(obj, 'annotated_student_count', obj.students.count())
    
    def get_sections(self, obj):
        """Get sections for this classroom"""
        return [{'id': s.id, 'name': s.name} for s in obj.sections.all()]
        
    class Meta:
        model = ClassRoom
        fields = ['id', 'school', 'school_id', 'name', 'description', 'student_count', 'sections']

class SectionSerializer(serializers.ModelSerializer):
    classroom = ClassRoomSerializer(read_only=True)
    classroom_id = serializers.PrimaryKeyRelatedField(source='classroom', queryset=ClassRoom.objects.all(), write_only=True)
    class Meta:
        model = Section
        fields = ['id', 'classroom', 'classroom_id', 'name']

class SubjectSerializer(serializers.ModelSerializer):
    assigned_teachers = serializers.SerializerMethodField()
    school_id = serializers.PrimaryKeyRelatedField(source='school', queryset=School.objects.all(), write_only=True, required=True)
    classrooms = serializers.PrimaryKeyRelatedField(many=True, queryset=ClassRoom.objects.all(), required=False)
    sections = serializers.PrimaryKeyRelatedField(many=True, queryset=Section.objects.all(), required=False)
    
    class Meta:
        model = Subject
        fields = ['id', 'school', 'school_id', 'name', 'code', 'assigned_teachers', 'classrooms', 'sections']
        read_only_fields = ['school']
    
    def get_assigned_teachers(self, obj):
        """Get all teachers assigned to this subject"""
        # Use all() instead of select_related() to leverage prefetched data
        assignments = obj.assignments.all()
        teachers_data = []
        for assignment in assignments:
            teacher = assignment.teacher
            teachers_data.append({
                'id': teacher.id,
                'username': teacher.username,
                'first_name': teacher.first_name,
                'last_name': teacher.last_name,
                'email': teacher.email,
                'phone_number': getattr(teacher, 'phone_number', ''),
                'photo_url': self._get_photo_url(teacher)
            })
        return teachers_data
    
    def _get_photo_url(self, user):
        """Helper to get photo URL"""
        try:
            if getattr(user, 'photo', None):
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(user.photo.url)
                return user.photo.url
        except Exception:
            pass
        return None

class TinyClassRoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassRoom
        fields = ['id', 'name']

class TinySectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ['id', 'name']

class StudentProfileSerializer(serializers.ModelSerializer):
    user = SimpleUserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(source='user', queryset=User.objects.all(), write_only=True, required=False, allow_null=True)
    # Allow setting school via school_id in writes
    school_id = serializers.PrimaryKeyRelatedField(source='school', queryset=School.objects.all(), write_only=True, required=False)
    classroom = TinyClassRoomSerializer(read_only=True)
    classroom_id = serializers.PrimaryKeyRelatedField(source='classroom', queryset=ClassRoom.objects.all(), write_only=True, allow_null=True, required=False)
    section = TinySectionSerializer(read_only=True)
    section_id = serializers.PrimaryKeyRelatedField(source='section', queryset=Section.objects.all(), write_only=True, allow_null=True, required=False)
    guardian = SimpleUserSerializer(read_only=True)
    guardian_id = serializers.PrimaryKeyRelatedField(source='guardian', queryset=User.objects.all(), write_only=True, allow_null=True, required=False)
    # Optional write-only fields to create a user on the fly when user_id is not provided
    username = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False)
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    phone_number = serializers.CharField(write_only=True, required=False, allow_blank=True)
    guardian_name = serializers.CharField(required=False, allow_blank=True)
    photo = serializers.ImageField(write_only=True, required=False)

    class Meta:
        model = StudentProfile
        fields = ['id', 'user', 'user_id', 'username', 'password', 'first_name', 'last_name', 'email', 'phone_number', 'photo', 'school', 'school_id', 'classroom', 'classroom_id', 'section', 'section_id', 'roll_number', 'group', 'blood_group', 'guardian', 'guardian_id', 'guardian_name']
        read_only_fields = ['school']

    def validate(self, data):
        errors = {}
        # Normalize username if provided
        username = data.get('username')
        if username:
            import unicodedata
            data['username'] = unicodedata.normalize('NFKC', str(username)).strip()
            username = data['username']

        # If no user provided, ensure we have enough info to create
        if not data.get('user'):
            first_name = (data.get('first_name') or '').strip()
            if not username and not first_name:
                errors['first_name'] = 'Provide at least a username or a first name'
            # Username uniqueness when provided
            if username and User.objects.filter(username=username).exists():
                errors['username'] = 'This username is already taken.'

        if errors:
            raise serializers.ValidationError(errors)
        return data

    def create(self, validated_data):
        # Ensure school is present (accept from initial_data fallback)
        school = validated_data.get('school')
        if not school:
            sid = (self.initial_data.get('school')
                   if isinstance(self.initial_data, dict) else None) or \
                  (self.initial_data.get('school_id') if isinstance(self.initial_data, dict) else None)
            if not sid:
                raise serializers.ValidationError({'school': 'This field is required.'})
            try:
                school = School.objects.get(pk=sid)
            except School.DoesNotExist:
                raise serializers.ValidationError({'school': 'Invalid school.'})
            validated_data['school'] = school

        # Delegate to original create logic (duplicated from below to insert school early)
        user = validated_data.pop('user', None)
        classroom = validated_data.pop('classroom', None)
        section = validated_data.pop('section', None)
        guardian = validated_data.pop('guardian', None)
        photo = validated_data.pop('photo', None)

        username = validated_data.pop('username', None)
        password = validated_data.pop('password', None)
        first_name = validated_data.pop('first_name', '')
        last_name = validated_data.pop('last_name', '')
        email = validated_data.pop('email', '')
        phone_number = validated_data.pop('phone_number', '')

        if not user:
            if not username:
                base = (first_name or 'student').lower().replace(' ', '')
                suffix = str(User.objects.count() + 1)
                username = f"{base}{suffix}"
                orig = username
                idx = 1
                while User.objects.filter(username=username).exists():
                    idx += 1
                    username = f"{orig}{idx}"
            if not password:
                import secrets, string
                alphabet = string.ascii_letters + string.digits
                password = ''.join(secrets.choice(alphabet) for _ in range(10))
            user = User.objects.create_user(
                username=username,
                password=password,
                first_name=first_name or '',
                last_name=last_name or '',
                email=email or ''
            )
        # Assign phone number and photo if provided
        if 'phone_number' in locals():
            try:
                if phone_number:
                    setattr(user, 'phone_number', phone_number)
            except Exception:
                pass
        if photo is not None and hasattr(user, 'photo'):
            try:
                user.photo = photo
            except Exception:
                pass
        try:
            user.save()
        except Exception:
            pass
        if phone_number:
            try:
                setattr(user, 'phone_number', phone_number)
                user.save(update_fields=['phone_number'])
            except Exception:
                pass

        Profile.objects.update_or_create(user=user, defaults={'school': validated_data.get('school'), 'role': 'student'})

        sp = StudentProfile.objects.create(user=user, classroom=classroom, section=section, guardian=guardian, **validated_data)
        return sp

    def create(self, validated_data):
        # Ensure school present (support write via school_id or initial_data fallback)
        school = validated_data.get('school')
        if not school and isinstance(getattr(self, 'initial_data', None), dict):
            sid = self.initial_data.get('school') or self.initial_data.get('school_id')
            if sid:
                try:
                    from schools.models import School
                    school = School.objects.get(pk=sid)
                    validated_data['school'] = school
                except Exception:
                    pass
        from rest_framework import serializers as drf_serializers
        if not validated_data.get('school'):
            raise drf_serializers.ValidationError({'school': 'This field is required.'})
        # Extract related objects
        user = validated_data.pop('user', None)
        classroom = validated_data.pop('classroom', None)
        section = validated_data.pop('section', None)
        guardian = validated_data.pop('guardian', None)
        photo = validated_data.pop('photo', None)

        # Extract potential user creation fields
        username = validated_data.pop('username', None)
        password = validated_data.pop('password', None)
        first_name = validated_data.pop('first_name', '')
        last_name = validated_data.pop('last_name', '')
        email = validated_data.pop('email', '')
        phone_number = validated_data.pop('phone_number', '')
        guardian_name = validated_data.get('guardian_name') or (self.initial_data.get('guardian_name') if isinstance(self.initial_data, dict) else '')

        # If no user provided, create one (auto-generate username/password if missing)
        if not user:
            if not username:
                import unicodedata
                base = unicodedata.normalize('NFKC', (first_name or 'student')).strip().lower().replace(' ', '') or 'student'
                suffix = str(User.objects.count() + 1)
                username = f"{base}{suffix}"
                # ensure unique
                idx = 1
                orig = username
                while User.objects.filter(username=username).exists() or User.objects.filter(username__iexact=username).exists():
                    idx += 1
                    username = f"{orig}{idx}"
            else:
                import unicodedata
                username = unicodedata.normalize('NFKC', str(username)).strip()
            if not password:
                import secrets, string
                alphabet = string.ascii_letters + string.digits
                password = ''.join(secrets.choice(alphabet) for _ in range(10))
            user = User.objects.create_user(
                username=username,
                password=password,
                first_name=first_name or '',
                last_name=last_name or '',
                email=email or ''
            )
        # Assign phone number and photo if provided
        if 'phone_number' in locals():
            try:
                if phone_number:
                    setattr(user, 'phone_number', phone_number)
            except Exception:
                pass
        if photo is not None and hasattr(user, 'photo'):
            try:
                user.photo = photo
            except Exception:
                pass
        # Save user if any changes
        try:
            user.save()
        except Exception:
            pass
        # Set phone number if provided
        if phone_number:
            try:
                setattr(user, 'phone_number', phone_number)
                user.save(update_fields=['phone_number'])
            except Exception:
                # Silently ignore if user model has no phone_number
                pass

        # Ensure a Profile exists and set school/role
        school = validated_data.get('school')
        Profile.objects.update_or_create(user=user, defaults={'school': school, 'role': 'student'})

        # If guardian not provided but guardian_name present, auto-create a parent profile and link
        if guardian is None and guardian_name:
            g_first = str(guardian_name).strip()
            if g_first:
                g_base = g_first.lower().replace(' ', '') or 'parent'
                g_username = g_base
                g_idx = 1
                while User.objects.filter(username=g_username).exists():
                    g_idx += 1
                    g_username = f"{g_base}{g_idx}"
                g_password = '123456'
                g_user = User.objects.create_user(
                    username=g_username,
                    password=g_password,
                    first_name=g_first,
                    last_name=''
                )
                try:
                    if phone_number and hasattr(g_user, 'phone_number'):
                        g_user.phone_number = phone_number
                        g_user.save(update_fields=['phone_number'])
                except Exception:
                    pass
                Profile.objects.update_or_create(user=g_user, defaults={'school': school, 'role': 'parent'})
                guardian = g_user

        # Create the StudentProfile
        sp = StudentProfile.objects.create(user=user, classroom=classroom, section=section, guardian=guardian, **validated_data)
        return sp
    
    def update(self, instance, validated_data):
        # Extract related objects
        classroom_was_provided = 'classroom' in validated_data
        classroom = validated_data.pop('classroom') if classroom_was_provided else None
        
        section_was_provided = 'section' in validated_data
        section = validated_data.pop('section') if section_was_provided else None
        
        guardian_name = validated_data.get('guardian_name', None)
        # Check if guardian was in validated_data (meaning guardian_id was provided in request)
        # This allows us to clear guardian by sending guardian_id as null/empty
        guardian_was_provided = 'guardian' in validated_data
        guardian = validated_data.pop('guardian') if guardian_was_provided else None
        
        # Extract user fields if provided
        username = validated_data.pop('username', None)
        password = validated_data.pop('password', None)
        first_name = validated_data.pop('first_name', None)
        last_name = validated_data.pop('last_name', None)
        email = validated_data.pop('email', None)
        phone_number = validated_data.pop('phone_number', None)
        photo = validated_data.pop('photo', None)
        
        # Update user fields if provided
        if instance.user:
            user_updated = False
            if username is not None:
                import unicodedata
                norm_username = unicodedata.normalize('NFKC', str(username)).strip()
                exists = User.objects.filter(username=norm_username).exclude(pk=instance.user.pk).exists() or \
                         User.objects.filter(username__iexact=norm_username).exclude(pk=instance.user.pk).exists()
                if exists:
                    from rest_framework import serializers as drf_serializers
                    raise drf_serializers.ValidationError({'username': 'This username is already taken.'})
                instance.user.username = norm_username
                user_updated = True
            if first_name is not None:
                instance.user.first_name = first_name
                user_updated = True
            if last_name is not None:
                instance.user.last_name = last_name
                user_updated = True
            if email is not None:
                instance.user.email = email
                user_updated = True
            if phone_number is not None:
                try:
                    instance.user.phone_number = phone_number
                    user_updated = True
                except AttributeError:
                    pass
            if photo is not None and hasattr(instance.user, 'photo'):
                try:
                    instance.user.photo = photo
                    user_updated = True
                except Exception:
                    pass
            if password:
                try:
                    instance.user.set_password(password)
                    user_updated = True
                except Exception:
                    pass
            
            if user_updated:
                instance.user.save()
        
        # If guardian_name provided, set it on student profile immediately
        if guardian_name is not None:
            try:
                instance.guardian_name = guardian_name
            except Exception:
                pass
        # If guardian_name provided, update linked guardian user's name too
        if guardian_name is not None and getattr(instance, 'guardian', None):
            try:
                parts = str(guardian_name).strip().split()
                first = parts[0] if parts else ''
                last = ' '.join(parts[1:]) if len(parts) > 1 else ''
                instance.guardian.first_name = first
                instance.guardian.last_name = last
                instance.guardian.save(update_fields=['first_name', 'last_name'])
            except Exception:
                pass
        
        # Update student profile fields
        if classroom_was_provided:
            instance.classroom = classroom
        if section_was_provided:
            instance.section = section
        # Set guardian if it was explicitly provided in the request (including None to clear it)
        if guardian_was_provided:
            instance.guardian = guardian
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance

class TeacherAssignmentSerializer(serializers.ModelSerializer):
    teacher = SimpleUserSerializer(read_only=True)
    teacher_id = serializers.PrimaryKeyRelatedField(source='teacher', queryset=User.objects.all(), write_only=True)
    classroom = ClassRoomSerializer(read_only=True)
    classroom_id = serializers.PrimaryKeyRelatedField(source='classroom', queryset=ClassRoom.objects.all(), write_only=True)
    section = SectionSerializer(read_only=True)
    section_id = serializers.PrimaryKeyRelatedField(source='section', queryset=Section.objects.all(), write_only=True, allow_null=True, required=False)
    subject = SubjectSerializer(read_only=True)
    subject_id = serializers.PrimaryKeyRelatedField(source='subject', queryset=Subject.objects.all(), write_only=True, allow_null=True)

    class Meta:
        model = TeacherAssignment
        fields = ['id', 'teacher', 'teacher_id', 'subject', 'subject_id', 'classroom', 'classroom_id', 'section', 'section_id']
    
    def create(self, validated_data):
        teacher = validated_data.get('teacher')
        classroom = validated_data.get('classroom')
        subject = validated_data.get('subject')
        # Ensure subject and classroom belong to the same school
        if subject and classroom and subject.school_id != classroom.school_id:
            raise serializers.ValidationError({'subject_id': 'Subject must belong to the same school as classroom.'})
        # Ensure the teacher has a profile in this school with role=teacher
        try:
            school = classroom.school if classroom else (subject.school if subject else None)
            if teacher and school:
                Profile.objects.update_or_create(
                    user=teacher,
                    defaults={'school': school, 'role': 'teacher'}
                )
        except Exception:
            # Do not fail assignment creation due to profile sync issues
            pass
        return super().create(validated_data)
    
    def to_representation(self, instance):
        """Override to ensure context is passed to nested serializers"""
        ret = super().to_representation(instance)
        # Ensure teacher serializer gets the request context for photo URLs
        if instance.teacher:
            teacher_serializer = SimpleUserSerializer(instance.teacher, context=self.context)
            ret['teacher'] = teacher_serializer.data
        return ret

class VirtualClassSerializer(serializers.ModelSerializer):
    teacher_name = serializers.ReadOnlyField(source='teacher.get_full_name')
    subject_name = serializers.ReadOnlyField(source='subject.name')
    classroom_name = serializers.ReadOnlyField(source='classroom.name')
    section_name = serializers.ReadOnlyField(source='section.name')
    
    class Meta:
        model = VirtualClass
        fields = [
            'id', 'school', 'teacher', 'teacher_name', 'classroom', 'classroom_name', 
            'section', 'section_name', 'subject', 'subject_name', 'meeting_id', 
            'is_active', 'started_at', 'ended_at'
        ]
        read_only_fields = ['teacher', 'started_at', 'ended_at', 'meeting_id']
