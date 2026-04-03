from rest_framework import serializers
from django.contrib.auth import get_user_model
import unicodedata
from schools.models import School
from .models import Profile, AdminProfile, ParentProfile, CommitteeProfile, Task, AssistantLog, AssistantMemory
from academics.models import StudentProfile

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    mobile_number = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_superuser', 'is_staff', 'photo', 'photo_url', 'phone_number', 'mobile_number', 'educational_qualification']
        read_only_fields = ['id', 'photo_url', 'mobile_number', 'is_superuser', 'is_staff']
    
    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None
    
    def get_mobile_number(self, obj):
        """Return phone_number as mobile_number for consistency"""
        return getattr(obj, 'phone_number', None)

class ProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Profile
        fields = ['id', 'user', 'school', 'role', 'blood_group', 'occupation', 'income']
        read_only_fields = ['id']

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'confirm_password', 'first_name', 'last_name']
    
    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords don't match")
        # Normalize username
        if 'username' in data:
            data['username'] = unicodedata.normalize('NFKC', data['username']).strip()
        return data
    
    def create(self, validated_data):
        validated_data.pop('confirm_password')
        user = User.objects.create_user(**validated_data)
        return user

# ---- Role-specific profile serializers ----
class BaseRoleProfileSerializer(serializers.ModelSerializer):
    designation = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        # If username provided, enforce uniqueness and provide suggestions if taken
        username = data.get('username')
        if username:
            # Normalize unicode and trim
            norm_username = unicodedata.normalize('NFKC', username).strip()
            data['username'] = norm_username
            # Case-insensitive check to be safer across collations
            if User.objects.filter(username=norm_username).exists() or User.objects.filter(username__iexact=norm_username).exists():
                # Build suggestions based on first/last names or the provided username
                first = (data.get('first_name') or '').strip()
                last = (data.get('last_name') or '').strip()
                first = unicodedata.normalize('NFKC', first)
                last = unicodedata.normalize('NFKC', last)
                base_candidates = []
                if first or last:
                    base_candidates.append((first + last).lower().replace(' ', ''))
                    base_candidates.append((first[:1] + last).lower())
                    base_candidates.append((first + (last[:1] or '')).lower())
                base_candidates.append(norm_username.lower().replace(' ', ''))
                suggestions = []
                for base in base_candidates:
                    for i in range(1, 100):
                        candidate = f"{base}{i if i>1 else ''}"
                        if not User.objects.filter(username=candidate).exists() and not User.objects.filter(username__iexact=candidate).exists():
                            suggestions.append(candidate)
                            if len(suggestions) >= 5:
                                break
                    if len(suggestions) >= 5:
                        break
                raise serializers.ValidationError({
                    'username': "This username is already taken.",
                    'suggestions': suggestions or None
                })
        return data
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(source='user', queryset=User.objects.all(), write_only=True, required=False)
    school_id = serializers.PrimaryKeyRelatedField(source='school', queryset=School.objects.all(), write_only=True)
    # Optional user creation fields
    username = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False)
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    phone_number = serializers.CharField(write_only=True, required=False, allow_blank=True)
    educational_qualification = serializers.CharField(write_only=True, required=False, allow_blank=True)
    photo = serializers.ImageField(write_only=True, required=False)

    def validate_photo(self, value):
        if value:
            # Check file size (5MB limit)
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("Image size should not exceed 5MB.")
            # Check file extension
            import os
            ext = os.path.splitext(value.name)[1].lower()
            if ext not in ['.jpg', '.jpeg', '.png', '.webp', '.gif']:
                raise serializers.ValidationError("Unsupported file extension. Allowed: JPG, PNG, WEBP, GIF.")
        return value

    role_value = None  # override in subclasses

    class Meta:
        model = Profile
        fields = ['id', 'user', 'user_id', 'username', 'password', 'first_name', 'last_name', 'email', 'phone_number', 'educational_qualification', 'photo', 'school', 'school_id', 'role', 'designation', 'blood_group', 'occupation', 'income']
        read_only_fields = ['id', 'role', 'school']

    def _ensure_user(self, validated_data):
        user = validated_data.get('user')
        username = validated_data.get('username')
        password = validated_data.get('password')
        first_name = validated_data.get('first_name', '')
        last_name = validated_data.get('last_name', '')
        email = validated_data.get('email', '')
        phone_number = validated_data.get('phone_number', '')
        educational_qualification = validated_data.get('educational_qualification', '')
        if user:
            return user
        # auto-generate if missing
        if not username:
            # Normalize name pieces to build a safe base
            first_name = unicodedata.normalize('NFKC', (first_name or '').strip())
            last_name = unicodedata.normalize('NFKC', (last_name or '').strip())
            base = (first_name or 'user').lower().replace(' ', '') or 'user'
            suffix = str(User.objects.count() + 1)
            username = f"{base}{suffix}"
            orig = username
            idx = 1
            while User.objects.filter(username=username).exists() or User.objects.filter(username__iexact=username).exists():
                idx += 1
                username = f"{orig}{idx}"
        else:
            # Normalize provided username
            username = unicodedata.normalize('NFKC', username).strip()
        # Final guard before create
        if User.objects.filter(username=username).exists() or User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError({'username': 'This username is already taken.'})
        if not password:
            import secrets, string
            alphabet = string.ascii_letters + string.digits
            password = ''.join(secrets.choice(alphabet) for _ in range(10))
        try:
            user = User.objects.create_user(
                username=username,
                password=password,
                first_name=first_name or '',
                last_name=last_name or '',
                email=email or ''
            )
        except Exception as e:
            from django.db import IntegrityError
            if isinstance(e, IntegrityError):
                # Surface a clean validation error instead of 500
                raise serializers.ValidationError({'username': 'This username is already taken.'})
            raise
        if phone_number and hasattr(user, 'phone_number'):
            try:
                user.phone_number = phone_number
                user.save(update_fields=['phone_number'])
            except Exception:
                pass
        if educational_qualification and hasattr(user, 'educational_qualification'):
            try:
                user.educational_qualification = educational_qualification
                user.save(update_fields=['educational_qualification'])
            except Exception:
                pass
        return user

    def create(self, validated_data):
        role = self.role_value or 'student'
        school = validated_data.pop('school', None)
        if not school:
            try:
                sid = (getattr(self, 'initial_data', {}) or {}).get('school') or (getattr(self, 'initial_data', {}) or {}).get('school_id')
            except Exception:
                sid = None
            if not sid:
                raise serializers.ValidationError({'school': 'This field is required.'})
            try:
                school = School.objects.get(pk=sid)
            except School.DoesNotExist:
                raise serializers.ValidationError({'school': 'Invalid school.'})
            validated_data['school'] = school
        photo = validated_data.pop('photo', None)
        designation = validated_data.pop('designation', '')
        user = self._ensure_user(validated_data)
        # Pop user from validated_data so it doesn't cause issues in update_or_create
        validated_data.pop('user', None)
        # If user already exists, update fields if provided
        user_updated = False
        username = validated_data.pop('username', None)
        password = validated_data.pop('password', None)
        first_name = validated_data.pop('first_name', None)
        last_name = validated_data.pop('last_name', None)
        email = validated_data.pop('email', None)
        phone_number = validated_data.pop('phone_number', None)
        educational_qualification = validated_data.pop('educational_qualification', None)
        
        if username is not None:
            norm_username = unicodedata.normalize('NFKC', str(username)).strip()
            if User.objects.filter(username=norm_username).exclude(pk=user.pk).exists() or \
               User.objects.filter(username__iexact=norm_username).exclude(pk=user.pk).exists():
                raise serializers.ValidationError({'username': 'This username is already taken.'})
            user.username = norm_username
            user_updated = True
        if password:
            user.set_password(password)
            user_updated = True
        if first_name is not None:
            user.first_name = first_name
            user_updated = True
        if last_name is not None:
            user.last_name = last_name
            user_updated = True
        if email is not None:
            user.email = email
            user_updated = True
        if phone_number is not None:
            user.phone_number = phone_number
            user_updated = True
        if educational_qualification is not None:
            user.educational_qualification = educational_qualification
            user_updated = True
        if photo and hasattr(user, 'photo'):
            try:
                user.photo = photo
                user_updated = True
            except Exception:
                pass
        
        if user_updated:
            user.save()
            
        profile, _ = Profile.objects.update_or_create(
            user=user,
            defaults={k: v for k, v in {
                'school': school,
                'role': role,
                'designation': designation,
                'blood_group': validated_data.get('blood_group') if 'blood_group' in validated_data else None,
                'occupation': validated_data.get('occupation') if 'occupation' in validated_data else None,
                'income': validated_data.get('income') if 'income' in validated_data else None,
            }.items() if v is not None}
        )
        return profile

    def update(self, instance, validated_data):
        # Extract user fields
        username = validated_data.pop('username', None)
        password = validated_data.pop('password', None)
        first_name = validated_data.pop('first_name', None)
        last_name = validated_data.pop('last_name', None)
        email = validated_data.pop('email', None)
        phone_number = validated_data.pop('phone_number', None)
        educational_qualification = validated_data.pop('educational_qualification', None)
        photo = validated_data.pop('photo', None)
        
        # Update user fields
        user = instance.user
        user_updated = False
        if username is not None:
            # Normalize and check uniqueness
            norm_username = unicodedata.normalize('NFKC', str(username)).strip()
            if User.objects.filter(username=norm_username).exclude(pk=user.pk).exists() or \
               User.objects.filter(username__iexact=norm_username).exclude(pk=user.pk).exists():
                raise serializers.ValidationError({'username': 'This username is already taken.'})
            user.username = norm_username
            user_updated = True
        if password:
            user.set_password(password)
            user_updated = True
        if first_name is not None:
            user.first_name = first_name
            user_updated = True
        if last_name is not None:
            user.last_name = last_name
            user_updated = True
        if email is not None:
            user.email = email
            user_updated = True
        if phone_number is not None:
            user.phone_number = phone_number
            user_updated = True
        if educational_qualification is not None:
            user.educational_qualification = educational_qualification
            user_updated = True
        if photo is not None:
            user.photo = photo
            user_updated = True
        
        if user_updated:
            user.save()
        
        # Update profile fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        return instance

class AdminProfileSerializer(BaseRoleProfileSerializer):
    role_value = 'admin'

class ParentProfileSerializer(BaseRoleProfileSerializer):
    role_value = 'parent'
    children = serializers.SerializerMethodField()

    class Meta(BaseRoleProfileSerializer.Meta):
        fields = BaseRoleProfileSerializer.Meta.fields + ['children']

    def get_children(self, obj: Profile):
        # Return lightweight child info for this parent in the same school
        students = StudentProfile.objects.select_related('user', 'classroom', 'section') \
            .filter(guardian=obj.user, school=obj.school)
        result = []
        for sp in students:
            user = sp.user
            name = (f"{user.first_name} {user.last_name}".strip()) or user.username
            result.append({
                'id': sp.id,
                'name': name,
                'roll_number': sp.roll_number,
                'class': sp.classroom.name if sp.classroom else None,
                'section': sp.section.name if sp.section else None,
            })
        return result

class CommitteeProfileSerializer(BaseRoleProfileSerializer):
    role_value = 'committee'
    tasks_count = serializers.SerializerMethodField()

    class Meta(BaseRoleProfileSerializer.Meta):
        fields = BaseRoleProfileSerializer.Meta.fields + ['tasks_count']

    def get_tasks_count(self, obj: Profile):
        """Return the count of tasks assigned to this committee member"""
        return Task.objects.filter(assigned_to=obj.user, school=obj.school).count()

class TeacherProfileSerializer(BaseRoleProfileSerializer):
    role_value = 'teacher'

class TaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source='assigned_to',
        queryset=User.objects.all(),
        write_only=True
    )
    school_id = serializers.PrimaryKeyRelatedField(
        source='school',
        queryset=School.objects.all(),
        write_only=True
    )

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'assigned_to', 'assigned_to_id',
            'assigned_to_name', 'school', 'school_id', 'status', 'priority',
            'due_date', 'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'assigned_to', 'school']

    def get_assigned_to_name(self, obj):
        user = obj.assigned_to
        name = f"{user.first_name} {user.last_name}".strip()
        return name or user.username

    def get_created_by_name(self, obj):
        if obj.created_by:
            name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return name or obj.created_by.username
        return None

    def create(self, validated_data):
        # Set created_by from request context
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['created_by'] = request.user
        return super().create(validated_data)

class AssistantLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistantLog
        fields = ['id', 'user', 'school', 'query_text', 'intent', 'params', 'result_summary', 'created_at']
        read_only_fields = ['id', 'created_at']

class AssistantMemorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistantMemory
        fields = ['id', 'school', 'key', 'data', 'updated_at']
        read_only_fields = ['id', 'updated_at']
