from rest_framework import generics, permissions, status, viewsets, serializers
from users.permissions import AdminOrReadOnly, RolePermission, TeacherSelfOrAdminChange
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import get_user_model
from django.db.models import Sum, F
from .models import Profile, AdminProfile, ParentProfile, CommitteeProfile, Task, AssistantLog, AssistantMemory
from .serializers import (
    UserSerializer,
    ProfileSerializer,
    UserRegistrationSerializer,
    AdminProfileSerializer,
    ParentProfileSerializer,
    CommitteeProfileSerializer,
    TeacherProfileSerializer,
    TaskSerializer,
)
from .sms_service import send_sms, send_bulk_sms, SMSTemplates
from django.core.files.storage import default_storage
from django.conf import settings
import os
import time
import requests
import re
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import PasswordResetTokenGenerator
import secrets, string, io, datetime, csv

User = get_user_model()

class UsernameAvailabilityView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        if not q:
            return Response({"available": False, "error": "No username provided"}, status=status.HTTP_400_BAD_REQUEST)
        exists = User.objects.filter(username=q).exists()
        suggestions = []
        base = q.lower().replace(' ', '')
        # generate up to 5 suggestions
        i = 1
        while len(suggestions) < 5 and i <= 50:
            candidate = f"{base}{i}"
            if not User.objects.filter(username=candidate).exists():
                suggestions.append(candidate)
            i += 1
        return Response({"available": not exists, "suggestions": suggestions})

class UserRegistrationView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [AdminOrReadOnly]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Create or update profile for the user
        school_id = request.data.get('school')
        role = request.data.get('role', 'student')
        Profile.objects.update_or_create(
            user=user,
            defaults={'school_id': school_id, 'role': role}
        )
        
        return Response({
            "user": UserSerializer(user).data,
            "message": "User registered successfully"
        }, status=status.HTTP_201_CREATED)

class VoiceUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('voice') or request.FILES.get('audio')
        if not file_obj:
            return Response({"success": False, "error": "No voice file provided (expected 'voice' or 'audio')"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            ts = int(time.time())
            name = os.path.basename(getattr(file_obj, 'name', f'voice_message_{ts}.webm'))
            path = f"voice_messages/{ts}_{name}"
            saved_path = default_storage.save(path, file_obj)
            base_url = getattr(settings, 'MEDIA_URL', '/media/')
            rel_url = f"{base_url}{saved_path}"
            site_base = (getattr(settings, 'SITE_BASE_URL', '') or '').rstrip('/')
            if site_base:
                clean_rel = rel_url if rel_url.startswith('/') else f"/{rel_url}"
                absolute_url = f"{site_base}{clean_rel}"
            else:
                try:
                    absolute_url = request.build_absolute_uri(rel_url)
                except Exception:
                    absolute_url = rel_url
            return Response({"success": True, "url": absolute_url, "filename": name}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class WhatsAppSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        token = getattr(settings, 'WHATSAPP_TOKEN', '')
        phone_id = getattr(settings, 'WHATSAPP_PHONE_ID', '')
        base = getattr(settings, 'WHATSAPP_BASE_URL', 'https://graph.facebook.com/v20.0')
        message = (request.data.get('message') or '').strip()
        phones = request.data.get('phone_numbers') or []
        audio_url = request.data.get('audio_url') or None
        audio_file = request.FILES.get('audio') or None
        if isinstance(phones, str):
            try:
                import json
                phones = json.loads(phones)
            except Exception:
                phones = [p.strip() for p in phones.split(',') if p.strip()]
        if not isinstance(phones, list):
            return Response({"success": False, "error": "phone_numbers must be a list"}, status=status.HTTP_400_BAD_REQUEST)
        def _normalize_phone(p):
            d = re.sub(r'\D', '', str(p or ''))
            if not d:
                return None
            if d.startswith('01') and len(d) == 11:
                return f"880{d[1:]}"
            if d.startswith('0'):
                return f"880{d.lstrip('0')}"
            if d.startswith('+'):
                return d[1:]
            return d
        phones = [x for x in map(_normalize_phone, phones) if x]
        results = []
        if not token or not phone_id:
            for p in phones:
                results.append({"to": p, "success": True, "message": "dry_run"})
            return Response({"success": True, "sent": len(phones), "failed": 0, "results": results})
        url = f"{base}/{phone_id}/messages"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        sent = 0
        failed = 0
        media_id = None
        if audio_file:
            try:
                upload_url = f"{base}/{phone_id}/media"
                files = {'file': (getattr(audio_file, 'name', 'voice_message'), audio_file.read(), getattr(audio_file, 'content_type', 'audio/ogg'))}
                data = {'messaging_product': 'whatsapp', 'type': 'audio'}
                r_up = requests.post(upload_url, headers={"Authorization": f"Bearer {token}"}, files=files, data=data, timeout=30)
                if r_up.status_code in (200, 201):
                    media_id = r_up.json().get('id')
                else:
                    media_id = None
            except Exception:
                media_id = None
        for p in phones:
            payload = {"messaging_product": "whatsapp", "to": p}
            if media_id:
                payload["type"] = "audio"
                payload["audio"] = {"id": media_id}
            elif audio_url:
                payload["type"] = "audio"
                payload["audio"] = {"link": audio_url}
            elif message:
                payload["type"] = "text"
                payload["text"] = {"preview_url": True, "body": message}
            else:
                results.append({"to": p, "success": False, "message": "No content"})
                failed += 1
                continue
            try:
                r = requests.post(url, json=payload, headers=headers, timeout=15)
                if r.status_code in (200, 201):
                    sent += 1
                    results.append({"to": p, "success": True})
                else:
                    failed += 1
                    results.append({"to": p, "success": False, "status": r.status_code, "error": r.text})
            except Exception as e:
                failed += 1
                results.append({"to": p, "success": False, "error": str(e)})
        return Response({"success": failed == 0, "sent": sent, "failed": failed, "results": results})

class TelegramSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
        message = (request.data.get('message') or '').strip()
        chat_ids = request.data.get('chat_ids') or []
        audio_url = request.data.get('audio_url') or None
        voice_file = request.FILES.get('voice') or request.FILES.get('audio') or None
        if isinstance(chat_ids, str):
            try:
                import json
                chat_ids = json.loads(chat_ids)
            except Exception:
                chat_ids = [c.strip() for c in chat_ids.split(',') if c.strip()]
        if not isinstance(chat_ids, list):
            return Response({"success": False, "error": "chat_ids must be a list"}, status=status.HTTP_400_BAD_REQUEST)
        results = []
        if not token:
            for cid in chat_ids:
                results.append({"chat_id": cid, "success": True, "message": "dry_run"})
            return Response({"success": True, "sent": len(chat_ids), "failed": 0, "results": results})
        base = "https://api.telegram.org"
        sent = 0
        failed = 0
        for cid in chat_ids:
            try:
                if voice_file:
                    name = getattr(voice_file, 'name', 'voice_message')
                    ctype = getattr(voice_file, 'content_type', 'audio/ogg')
                    ext = os.path.splitext(name)[1].lower()
                    if ext in ('.ogg', '.opus'):
                        resp = requests.post(f"{base}/bot{token}/sendVoice", files={'voice': (name, voice_file.read(), ctype)}, data={"chat_id": cid}, timeout=30)
                    else:
                        resp = requests.post(f"{base}/bot{token}/sendAudio", files={'audio': (name, voice_file.read(), ctype)}, data={"chat_id": cid}, timeout=30)
                elif audio_url:
                    ext = os.path.splitext(str(audio_url).split('?')[0])[1].lower()
                    if ext in ('.ogg', '.opus'):
                        resp = requests.post(f"{base}/bot{token}/sendVoice", json={"chat_id": cid, "voice": audio_url}, timeout=15)
                    else:
                        resp = requests.post(f"{base}/bot{token}/sendAudio", json={"chat_id": cid, "audio": audio_url}, timeout=15)
                else:
                    resp = requests.post(f"{base}/bot{token}/sendMessage", json={"chat_id": cid, "text": message}, timeout=15)
                if resp.status_code == 200 and resp.json().get('ok'):
                    sent += 1
                    results.append({"chat_id": cid, "success": True})
                else:
                    failed += 1
                    results.append({"chat_id": cid, "success": False, "status": resp.status_code, "error": resp.text})
            except Exception as e:
                failed += 1
                results.append({"chat_id": cid, "success": False, "error": str(e)})
        return Response({"success": failed == 0, "sent": sent, "failed": failed, "results": results})

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return Profile.objects.get(user=self.request.user)

class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def get(self, request):
        user = request.user
        try:
            profile = Profile.objects.get(user=user)
            user_data = UserSerializer(user, context={'request': request}).data
            prof_data = ProfileSerializer(profile).data
            if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
                prof_data['role'] = 'admin'
            return Response({
                "user": user_data,
                "profile": prof_data
            })
        except Profile.DoesNotExist:
            return Response({
                "user": UserSerializer(user, context={'request': request}).data,
                "message": "Profile does not exist"
            }, status=status.HTTP_404_NOT_FOUND)
    
    def patch(self, request):
        """Update user fields and/or photo"""
        user = request.user
        updated = False
        # Photo upload
        if 'photo' in request.FILES:
            user.photo = request.FILES['photo']
            updated = True
        # Basic fields
        username = (request.data.get('username') or '').strip()
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        email = request.data.get('email')
        phone_number = request.data.get('phone_number')
        if username:
            exists = User.objects.filter(username__iexact=username).exclude(pk=user.pk).exists()
            if exists:
                return Response({"error": "Username is already taken.", "field": "username"}, status=status.HTTP_400_BAD_REQUEST)
            user.username = username
            updated = True
        if first_name is not None:
            user.first_name = first_name
            updated = True
        if last_name is not None:
            user.last_name = last_name
            updated = True
        if email is not None:
            user.email = email
            updated = True
        if phone_number is not None and hasattr(user, 'phone_number'):
            try:
                user.phone_number = phone_number
                updated = True
            except Exception:
                pass
        if updated:
            user.save()
            return Response({
                "message": "User updated successfully",
                "user": UserSerializer(user, context={'request': request}).data
            })
        return Response({"error": "No updatable fields provided"}, status=status.HTTP_400_BAD_REQUEST)
        


class CreateProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        """Create a profile for the current user"""
        user = request.user
        
        # Check if profile already exists
        if hasattr(user, 'profile'):
            return Response({
                "message": "Profile already exists",
                "user": UserSerializer(user, context={'request': request}).data,
                "profile": ProfileSerializer(user.profile).data
            })
            
        # Create profile with default role
        profile = Profile.objects.create(
            user=user,
            role=request.data.get('role', 'student')
        )
        
        # Update user information
        if 'first_name' in request.data:
            user.first_name = request.data['first_name']
        if 'last_name' in request.data:
            user.last_name = request.data['last_name']
        if 'email' in request.data:
            user.email = request.data['email']
        user.save()
        
        return Response({
            "message": "Profile created successfully",
            "user": UserSerializer(user, context={'request': request}).data,
            "profile": ProfileSerializer(profile).data
        }, status=status.HTTP_201_CREATED)

class VerifyPasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        pwd = (request.data.get('password') or '').strip()
        if not pwd:
            return Response({"valid": False, "error": "Password required"}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.check_password(pwd):
            return Response({"valid": True}, status=status.HTTP_200_OK)
        return Response({"valid": False, "error": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED)

class SoftwareAssistantView(APIView):
    permission_classes = [RolePermission]
    def get(self, request):
        q = (request.query_params.get('q') or request.query_params.get('query') or '').strip()
        school_id = request.query_params.get('school')
        profile = getattr(request.user, 'profile', None)
        if not school_id and profile and getattr(profile, 'school_id', None):
            school_id = profile.school_id
        classroom_id = request.query_params.get('classroom')
        section_id = request.query_params.get('section')
        exam_type = (request.query_params.get('exam_type') or '').strip()
        date = request.query_params.get('date')
        month = request.query_params.get('month')
        ql = q.lower()
        def pick_exam_type():
            t = (exam_type or '').lower()
            if t:
                return t
            m = [
                ('annual', ['annual', 'বার্ষিক']),
                ('half_yearly', ['half', 'half_yearly', 'অর্ধ', 'অর্ধবার্ষিক']),
                ('test', ['test', 'টেস্ট']),
                ('terminal', ['terminal', 'টার্মিনাল']),
                ('model', ['model', 'মডেল'])
            ]
            for key, words in m:
                for w in words:
                    if w in ql:
                        return key
            return ''
        def resolve_classroom():
            if classroom_id:
                return classroom_id, None
            import re
            num = None
            m = re.search(r'(class|ক্লাস|শ্রেণি)\s*([0-9]+)', ql)
            if m:
                num = m.group(2)
            if not num:
                m_alt = re.search(r'([0-9০-৯]+)\s*(?:ষ্ঠ|তম|th|য়)?\s*(class|ক্লাস|শ্রেণি)', ql)
                if m_alt:
                    bn2en = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'}
                    num = ''.join(bn2en.get(ch, ch) for ch in m_alt.group(1))
            if not num:
                words_to_num = {
                    'one': '1','two': '2','three': '3','four': '4','five': '5','six': '6','seven': '7','eight': '8','nine': '9','ten': '10',
                    'সিক্স': '6','সেভেন': '7','এইট': '8','নাইন': '9','টেন': '10',
                    'ষষ্ঠ': '6','সপ্তম': '7','অষ্টম': '8','নবম': '9','দশম': '10',
                    'প্রথম': '1', 'দ্বিতীয়': '2', 'তৃতীয়': '3', 'চতুর্থ': '4', 'পঞ্চম': '5',
                    'একাদশ': '11', 'দ্বাদশ': '12'
                }
                for w, n in words_to_num.items():
                    if w in ql:
                        num = n
                        break
            if not num:
                m_any = re.search(r'([0-9০-৯]+)', ql)
                if m_any:
                    bn2en = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'}
                    num = ''.join(bn2en.get(ch, ch) for ch in m_any.group(1))
            from academics.models import ClassRoom
            if school_id:
                qs = ClassRoom.objects.filter(school_id=school_id)
            else:
                qs = ClassRoom.objects.all()
            if num:
                from django.db.models import Q
                digit_to_bn = {
                    '1': 'প্রথম', '2': 'দ্বিতীয়', '3': 'তৃতীয়', '4': 'চতুর্থ', '5': 'পঞ্চম',
                    '6': 'ষষ্ঠ', '7': 'সপ্তম', '8': 'অষ্টম', '9': 'নবম', '10': 'দশম',
                    '11': 'একাদশ', '12': 'দ্বাদশ'
                }
                digit_to_roman = {
                    '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V',
                    '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X'
                }
                digit_to_en = {
                    '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
                    '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten',
                    '11': 'eleven', '12': 'twelve'
                }
                digit_to_bn_translit = {
                    '6': 'সিক্স', '7': 'সেভেন', '8': 'এইট', '9': 'নাইন', '10': 'টেন'
                }
                candidates = [num]
                if num in digit_to_bn:
                    candidates.append(digit_to_bn[num])
                if num in digit_to_roman:
                    candidates.append(digit_to_roman[num])
                if num in digit_to_en:
                    candidates.append(digit_to_en[num])
                if num in digit_to_bn_translit:
                    candidates.append(digit_to_bn_translit[num])
                
                q_obj = Q()
                for c in candidates:
                    q_obj |= Q(name__icontains=c)
                
                cls = qs.filter(q_obj).order_by('id').first()
                if cls:
                    return str(cls.id), cls.name
            cls = qs.order_by('id').first()
            if cls:
                return str(cls.id), cls.name
            return None, None
        def resolve_section():
            if section_id:
                return section_id, None
            import re
            val = None
            m0 = re.search(r'(class|ক্লাস|শ্রেণি)\s*([0-9০-৯]+)\s*([a-zA-Zঅ-হ])', ql)
            if m0:
                val = m0.group(3)
            m1 = re.search(r'(section|সেকশন|শাখা)\s*([a-zA-Zঅ-হ]+)', ql)
            if m1:
                val = m1.group(2)
            if not val:
                m2 = re.search(r'([a-zA-Zঅ-হ]+)\s*(section|সেকশন|শাখা)', ql)
                if m2:
                    val = m2.group(1)
            if not val:
                m3 = re.search(r'\(([a-zA-Zঅ-হ]+)\)', ql)
                if m3:
                    val = m3.group(1)
            if not val:
                return None, None
            bn_map = {'ক': 'A', 'খ': 'B', 'গ': 'C', 'ঘ': 'D', 'ঙ': 'E', 'চ': 'F', 'ছ': 'G', 'জ': 'H', 'এ': 'A'}
            candidates = [val.strip()]
            if val.strip() in bn_map:
                candidates.append(bn_map[val.strip()])
            if val.strip().isalpha():
                candidates.append(val.strip().upper())
            target_classroom_id = None
            if classroom_id:
                target_classroom_id = classroom_id
            else:
                cid, _ = resolve_classroom()
                if cid:
                    target_classroom_id = cid
            from academics.models import Section
            if school_id:
                qs = Section.objects.filter(classroom__school_id=school_id)
            else:
                qs = Section.objects.all()
            if target_classroom_id:
                qs = qs.filter(classroom_id=target_classroom_id)
            sec = None
            for v in candidates:
                sec = qs.filter(name__iexact=v).order_by('id').first() or qs.filter(name__icontains=v).order_by('id').first()
                if sec:
                    break
            if sec:
                return str(sec.id), sec.name
            return None, None
        def bn_exam_label(t):
            d = {'annual': 'Annual', 'half_yearly': 'Half Yearly', 'test': 'Test', 'terminal': 'Terminal', 'model': 'Model'}
            return d.get(t, t or '')
        def intent():
            # Basic greetings and chat
            if any(w in ql for w in ['hello', 'hi', 'salam', 'সালাম', 'আদাব', 'হাই', 'হ্যালো', 'hey', 'start', 'শুরু']):
                return 'greeting'
            if any(w in ql for w in ['kemon', 'kmn', 'how are', 'কেমন', 'খবর', 'obostha']):
                 return 'chat_status'
            if any(w in ql for w in ['love', 'like', 'pachondo', 'পছন্দ', 'ভালোবাসি', 'valobashi', 'prem', 'সুন্দর', 'nice']):
                 return 'chat_affection'
            if any(w in ql for w in ['thanks', 'thank', 'dhonnobad', 'ধন্যবাদ', 'shukriya']):
                 return 'chat_thanks'
            if any(w in ql for w in ['smart', 'intelligent', 'buddhiman', 'বুদ্ধিমান', 'ভালো', 'good', 'best', 'great']):
                 return 'chat_compliment'
            if any(w in ql for w in ['ki koro', 'what are you doing', 'ki korcho']):
                 return 'chat_activity'
            if any(w in ql for w in ['bye', 'goodbye', 'allah hafez', 'বিদায়', 'আল্লাহ হাফেজ']):
                 return 'chat_bye'

            if any(w in ql for w in ['blood', 'রক্ত', 'ব্লাড']) and any(w in ql for w in ['count', 'কতজন', 'সংখ্যা', 'how many', 'total', 'মোট']):
                return 'blood_group_count'
            if any(w in ql for w in ['blood', 'রক্ত', 'ব্লাড']) and any(w in ql for w in ['most', 'max', 'highest', 'বেশি', 'সর্বোচ্চ', 'সবচেয়ে বেশি', 'majority']):
                return 'blood_group_max'
            if any(w in ql for w in ['blood', 'রক্ত', 'ব্লাড']) and any(w in ql for w in ['name', 'নাম', 'list', 'তালিকা', 'দাও', 'dao', 'give']):
                return 'blood_group_list'
            if any(w in ql for w in ['attendance', 'এটেনড্যান্স', 'উপস্থিতি']):
                if any(w in ql for w in ['monthly', 'মাসিক', 'month', 'মাস']):
                    return 'attendance_monthly'
                return 'attendance_daily'
            if any(w in ql for w in ['fee', 'fees', 'ফি', 'বেতন', 'collection', 'কালেকশন']):
                return 'fees_collection'
            if any(w in ql for w in ['বকেয়া', 'বাকি', 'due', 'বেতন']) or ('fee' in ql and 'due' in ql):
                return 'fees_due'
            entity_tokens = ['student', 'students', 'স্টুডেন্ট', 'স্টুডেন্টস', 'ছাত্র', 'ছাত্রী', 'ছাত্রছাত্রী', 'শিক্ষার্থী', 'teacher', 'শিক্ষক']
            count_tokens = ['কতজন', 'কয়জন', 'কয়জন', 'মোট', 'count', 'সংখ্যা', 'how many', 'total', 'কত', 'কতো', 'কতগুলো', 'কতগুলি', 'কয়টি', 'কয়টি']
            try:
                from users.models import AssistantMemory
                mem, _ = AssistantMemory.objects.get_or_create(school_id=school_id or 0, key='synonyms')
                syn = dict(mem.data or {})
                sc = dict(syn.get('school_counts') or {})
                e_extra = list(sc.get('entity') or [])
                c_extra = list(sc.get('count') or [])
                entity_tokens = list(dict.fromkeys(entity_tokens + e_extra))
                count_tokens = list(dict.fromkeys(count_tokens + c_extra))
            except Exception:
                pass
            has_entity = any(w in ql for w in entity_tokens)
            has_count = any(w in ql for w in count_tokens) or (('জন' in ql) and any(w in ql for w in ['কত','কতো','কয়','কয়']))
            has_results_words = any(w in ql for w in ['result', 'রেজাল্ট', 'পরীক্ষা', 'exam', 'examination'])
            if has_entity and has_count and not has_results_words:
                try:
                    from users.models import AssistantMemory
                    mem, _ = AssistantMemory.objects.get_or_create(school_id=school_id or 0, key='synonyms')
                    syn = dict(mem.data or {})
                    sc = dict(syn.get('school_counts') or {})
                    e_list = list(sc.get('entity') or [])
                    c_list = list(sc.get('count') or [])
                    matched_e = [w for w in entity_tokens if w in ql]
                    matched_c = [w for w in count_tokens if w in ql]
                    e_new = list(dict.fromkeys(e_list + matched_e))
                    c_new = list(dict.fromkeys(c_list + matched_c))
                    sc['entity'] = e_new
                    sc['count'] = c_new
                    syn['school_counts'] = sc
                    mem.data = syn
                    mem.save(update_fields=['data'])
                except Exception:
                    pass
                return 'school_counts'
            if any(w in ql for w in ['roll', 'রোল', 'রোল নাম্বার', 'রোল নম্বর', 'roll number']):
                import re
                m_roll = re.search(r'(roll|রোল|রোল নাম্বার|রোল নম্বর)\s*([0-9০-৯]+)', ql)
                if m_roll:
                    return 'student_result'
            topper_words = ['১ম', 'প্রথম', 'first', 'topper', 'টপার', 'rank 1', 'র‌্যাংক', 'র‍্যাঙ্ক', 'top']
            if any(w in ql for w in topper_words):
                return 'results_topper'
            rank_words = ['তম', 'rank', 'র‌্যাংক', 'র‍্যাঙ্ক', 'স্থান', 'position', 'nth', 'কে']
            has_number = any(ch.isdigit() for ch in ql) or any(d in ql for d in ['০','১','২','৩','৪','৫','৬','৭','৮','৯'])
            if any(w in ql for w in rank_words) and has_number:
                return 'results_rank'
            if (('মেনু' in ql or 'menu' in ql) and any(w in ql for w in ['স্কুল', 'school'])) or any(w in ql for w in ['স্কুল মেনু', 'school menu']):
                return 'school_menu'
            if any(w in ql for w in ['result', 'রেজাল্ট', 'পরীক্ষা', 'exam', 'examination']):
                if any(w in ql for w in ['year', 'বছর', 'সাল']):
                    return 'results_years'
                # If counting students with results asked
                count_words = ['কতজন','কয়জন','কয়জন','মোট','count','সংখ্যা','how many','total','কত','কতো','কতগুলো','কতগুলি','কয়টি','কয়টি']
                student_words = ['student','students','স্টুডেন্ট','শিক্ষার্থী','ছাত্র','ছাত্রী','ছাত্রছাত্রী']
                detail_words = ['আনো','নিয়ে আস','এখানে','দেখাও','show','details','detail','result card','কার্ড']
                has_count = any(w in ql for w in count_words) and any(w in ql for w in student_words)
                has_detail = any(w in ql for w in detail_words)
                list_words = ['কোন', 'কোন কোন', 'তালিকা', 'list', 'কি কি', 'which']
                if any(w in ql for w in list_words):
                    return 'results_exams_list'
                if has_detail and has_count:
                    return 'results_student_count_details'
                if any(w in ql for w in count_words) and any(w in ql for w in student_words):
                    return 'results_student_count'
                if any(w in ql for w in detail_words):
                    return 'results_student_details'
                return 'results'
            if any(w in ql for w in ['sms', 'message', 'এসএমএস', 'মেসেজ']) and any(w in ql for w in ['send', 'pathao', 'dao', 'দাও', 'পাঠাও']):
                return 'action_send_sms'
            if (any(w in ql for w in ['student', 'ছাত্র', 'ছাত্রী', 'শিক্ষার্থী']) or any(w in ql for w in ['admission', 'ভর্তি'])) and any(w in ql for w in ['add', 'create', 'new', 'নতুন', 'করো']):
                return 'action_add_student'
            return 'unknown'
        def latest_exam_for_class(cls_id, sec_id):
            from results.models import Examination
            exams = Examination.objects.all()
            if school_id:
                exams = exams.filter(school_id=school_id)
            if cls_id:
                exams = exams.filter(classroom_id=cls_id)
            if sec_id:
                exams = exams.filter(section_id=sec_id)
            ex = exams.order_by('-exam_date', '-id').first()
            if ex:
                return ex
            return None
        it = intent()
        if it == 'blood_group_count':
            bg_map_items = [
                ('ab positive', 'AB+'), ('ab negative', 'AB-'),
                ('a positive', 'A+'), ('a negative', 'A-'),
                ('b positive', 'B+'), ('b negative', 'B-'),
                ('o positive', 'O+'), ('o negative', 'O-'),
                ('এবি পজেটিভ', 'AB+'), ('এবি নেগেটিভ', 'AB-'),
                ('এ পজেটিভ', 'A+'), ('এ নেগেটিভ', 'A-'),
                ('বি পজেটিভ', 'B+'), ('বি নেগেটিভ', 'B-'),
                ('ও পজেটিভ', 'O+'), ('ও নেগেটিভ', 'O-'),
                ('ab+', 'AB+'), ('ab-', 'AB-'),
                ('a+', 'A+'), ('a-', 'A-'),
                ('b+', 'B+'), ('b-', 'B-'),
                ('o+', 'O+'), ('o-', 'O-')
            ]
            bg = None
            for k, v in bg_map_items:
                if k in ql:
                    bg = v
                    break
            
            if not bg:
                 return Response({"text": "রক্তের গ্রুপ বুঝতে পারিনি।"}, status=status.HTTP_200_OK)

            from academics.models import StudentProfile
            
            qs_profile = Profile.objects.filter(blood_group=bg)
            qs_student = StudentProfile.objects.filter(blood_group=bg)
            
            if school_id:
                qs_profile = qs_profile.filter(school_id=school_id)
                qs_student = qs_student.filter(school_id=school_id)
            
            user_ids = set(qs_profile.values_list('user_id', flat=True))
            student_user_ids = set(qs_student.values_list('user_id', flat=True))
            all_user_ids = user_ids.union(student_user_ids)
            
            count = len(all_user_ids)
            
            profiles = Profile.objects.filter(user_id__in=all_user_ids)
            role_counts = {}
            user_role_map = {}
            
            for p in profiles:
                r = p.role
                role_counts[r] = role_counts.get(r, 0) + 1
                user_role_map[p.user.id] = r
            
            # Ensure students from StudentProfile are counted as students if not in Profile
            for uid in student_user_ids:
                if uid not in user_role_map:
                    role_counts['student'] = role_counts.get('student', 0) + 1
                    user_role_map[uid] = 'student'
            
            text = f"{bg} রক্তের গ্রুপের মোট {count} জন পাওয়া গেছে।"
            details = []
            role_map = {'student': 'শিক্ষার্থী', 'teacher': 'শিক্ষক', 'admin': 'অ্যাডমিন', 'parent': 'অভিভাবক', 'committee': 'কমিটি'}
            
            for role, cnt in role_counts.items():
                if cnt > 0:
                    details.append(f"{role_map.get(role, role)}: {cnt}")
            
            if details:
                text += " (" + ", ".join(details) + ")"
            
            # Generate detailed list with mobile numbers
            users_list = []
            users_objs = User.objects.filter(id__in=all_user_ids).values('id', 'first_name', 'last_name', 'username', 'phone_number')
            
            for u in users_objs:
                uid = u['id']
                full_name = f"{u['first_name']} {u['last_name']}".strip() or u['username']
                phone = u['phone_number']
                role_key = user_role_map.get(uid, 'unknown')
                role_display = role_map.get(role_key, role_key)
                
                users_list.append({
                    'name': full_name,
                    'phone': phone,
                    'role': role_display
                })
            
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    params={'blood_group': bg},
                    result_summary=text
                )
            except Exception:
                pass
            return Response({"text": text, "users_list": users_list})

        if it == 'blood_group_max':
            from academics.models import StudentProfile
            
            bgs = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
            counts = {}
            
            for bg in bgs:
                qs_profile = Profile.objects.filter(blood_group=bg)
                qs_student = StudentProfile.objects.filter(blood_group=bg)
                
                if school_id:
                    qs_profile = qs_profile.filter(school_id=school_id)
                    qs_student = qs_student.filter(school_id=school_id)
                
                user_ids = set(qs_profile.values_list('user_id', flat=True))
                student_user_ids = set(qs_student.values_list('user_id', flat=True))
                all_user_ids = user_ids.union(student_user_ids)
                
                counts[bg] = len(all_user_ids)
            
            if not counts or all(c == 0 for c in counts.values()):
                 return Response({"text": "কোনো রক্তের গ্রুপের তথ্য পাওয়া যায়নি।"}, status=status.HTTP_200_OK)

            max_bg = max(counts, key=counts.get)
            max_count = counts[max_bg]
            
            text = f"সবচেয়ে বেশি ব্যবহারকারী আছেন {max_bg} রক্ত গ্রুপের ({max_count} জন)।"
            
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    result_summary=text
                )
            except Exception:
                pass
            return Response({"text": text})

        if it == 'blood_group_list':
            bg_map_items = [
                ('ab positive', 'AB+'), ('ab negative', 'AB-'),
                ('a positive', 'A+'), ('a negative', 'A-'),
                ('b positive', 'B+'), ('b negative', 'B-'),
                ('o positive', 'O+'), ('o negative', 'O-'),
                ('এবি পজেটিভ', 'AB+'), ('এবি নেগেটিভ', 'AB-'),
                ('এ পজেটিভ', 'A+'), ('এ নেগেটিভ', 'A-'),
                ('বি পজেটিভ', 'B+'), ('বি নেগেটিভ', 'B-'),
                ('ও পজেটিভ', 'O+'), ('ও নেগেটিভ', 'O-'),
                ('ab+', 'AB+'), ('ab-', 'AB-'),
                ('a+', 'A+'), ('a-', 'A-'),
                ('b+', 'B+'), ('b-', 'B-'),
                ('o+', 'O+'), ('o-', 'O-')
            ]
            bg = None
            for k, v in bg_map_items:
                if k in ql:
                    bg = v
                    break
            if not bg:
                return Response({"text": "রক্তের গ্রুপ বুঝতে পারিনি।"}, status=status.HTTP_200_OK)
            from academics.models import StudentProfile
            qs_profile = Profile.objects.filter(blood_group=bg)
            qs_student = StudentProfile.objects.filter(blood_group=bg)
            if school_id:
                qs_profile = qs_profile.filter(school_id=school_id)
                qs_student = qs_student.filter(school_id=school_id)
            user_ids = set(qs_profile.values_list('user_id', flat=True))
            student_user_ids = set(qs_student.values_list('user_id', flat=True))
            all_user_ids = user_ids.union(student_user_ids)
            role_map = {'student': 'শিক্ষার্থী', 'teacher': 'শিক্ষক', 'admin': 'অ্যাডমিন', 'parent': 'অভিভাবক', 'committee': 'কমিটি'}
            profiles = Profile.objects.filter(user_id__in=all_user_ids)
            user_role_map = {}
            for p in profiles:
                user_role_map[p.user.id] = p.role
            for uid in student_user_ids:
                if uid not in user_role_map:
                    user_role_map[uid] = 'student'
            want_teachers = any(w in ql for w in ['teacher', 'শিক্ষক', 'টিচার'])
            users_objs = User.objects.filter(id__in=all_user_ids).values('id', 'first_name', 'last_name', 'username', 'phone_number')
            users_list = []
            for u in users_objs:
                uid = u['id']
                role_key = user_role_map.get(uid, 'unknown')
                if want_teachers and role_key != 'teacher':
                    continue
                full_name = f"{u['first_name']} {u['last_name']}".strip() or u['username']
                users_list.append({
                    'name': full_name,
                    'phone': u['phone_number'],
                    'role': role_map.get(role_key, role_key)
                })
            count = len(users_list) if want_teachers else len(all_user_ids)
            if want_teachers:
                text = f"{bg} রক্তের গ্রুপের শিক্ষকদের নামের তালিকা ({count} জন):"
            else:
                text = f"{bg} রক্তের গ্রুপের নামের তালিকা ({count} জন):"
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    params={'blood_group': bg, 'teachers_only': want_teachers},
                    result_summary=text
                )
            except Exception:
                pass
            return Response({"text": text, "users_list": users_list})
        # Removed duplicate basic 'school_counts' handler in favor of enhanced handler below

        if it == 'attendance_daily':
            from attendance.models import AttendanceRecord
            import datetime
            today = datetime.date.today()
            
            qs = AttendanceRecord.objects.filter(date=today)
            if school_id:
                qs = qs.filter(school_id=school_id)
            
            total_p = qs.filter(present=True).count()
            total_a = qs.filter(present=False).count()
            
            if total_p + total_a == 0:
                 return Response({"text": "আজকের হাজিরা এখনো এন্ট্রি করা হয়নি।"}, status=status.HTTP_200_OK)
            
            text = f"আজকের উপস্থিতি: {total_p} জন, অনুপস্থিত: {total_a} জন।"
            return Response({"text": text}, status=status.HTTP_200_OK)

        if it == 'fees_due':
            from fees.models import FeeSlip
            from django.db.models import Sum
            
            qs = FeeSlip.objects.filter(status__in=['unpaid', 'partial'])
            if school_id:
                qs = qs.filter(school_id=school_id)
            
            # Simple iteration to handle partial payments safely
            total_due = 0
            count = 0
            slips = qs.only('amount', 'amount_paid')
            for s in slips:
                total_due += (s.amount - s.amount_paid)
                count += 1
            
            student_count = qs.values('student').distinct().count()
            
            text = f"মোট বকেয়া: {total_due} টাকা ({student_count} জন শিক্ষার্থীর)।"
            return Response({"text": text}, status=status.HTTP_200_OK)

        if it == 'fees_collection':
            from fees.models import Payment
            import datetime
            today = datetime.date.today()
            
            qs = Payment.objects.filter(payment_date=today, payment_status='completed')
            if school_id:
                qs = qs.filter(student__school_id=school_id)
                
            total = qs.aggregate(Sum('amount'))['amount__sum'] or 0
            
            text = f"আজকের মোট আদায়: {total} টাকা।"
            return Response({"text": text}, status=status.HTTP_200_OK)
            
        if it == 'results_topper':
            cls_id, cls_name = resolve_classroom()
            sec_id, sec_name = resolve_section()
            et = pick_exam_type()
            if not cls_id:
                return Response({"text": "কোন ক্লাসের টপার খুঁজছেন? ক্লাসের নাম উল্লেখ করুন (যেমন: ক্লাস সিক্স)।"}, status=status.HTTP_200_OK)
            from results.models import Examination, Result
            from django.db.models import Sum
            exams = Examination.objects.all()
            if school_id:
                exams = exams.filter(school_id=school_id)
            exams = exams.filter(classroom_id=cls_id)
            if sec_id:
                exams = exams.filter(section_id=sec_id)
            if et:
                exams = exams.filter(exam_type=et)
            ex = exams.order_by('-exam_date', '-id').first()
            if not ex:
                return Response({"text": "কোনো পরীক্ষা পাওয়া যায়নি।"}, status=status.HTTP_200_OK)
            top = Result.objects.filter(examination=ex).values('student').annotate(total=Sum('total_obtained')).order_by('-total')[:1]
            if not top:
                return Response({"text": "ফলাফল পাওয়া যায়নি।"}, status=status.HTTP_200_OK)
            topper_st_id = top[0]['student']
            max_marks = top[0]['total']
            from academics.models import StudentProfile
            try:
                st = StudentProfile.objects.get(id=topper_st_id)
                nm = st.user.get_full_name() or st.user.username
                text = f"{ex.name}-এ টপার: {nm} (রোল {st.roll_number}), প্রাপ্ত নম্বর: {max_marks}।"
            except Exception:
                text = f"টপার আইডি {topper_st_id} এর তথ্য পাওয়া যায়নি।"
            return Response({"text": text}, status=status.HTTP_200_OK)

        if it == 'results_rank':
            import re
            def normalize_digits(s):
                m = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'}
                return ''.join(m.get(ch, ch) for ch in s)
            pos = None
            mpos = re.search(r'([0-9০-৯]+)\s*(তম|th)', ql)
            if mpos:
                pos = int(normalize_digits(mpos.group(1)))
            if not pos:
                mpos2 = re.search(r'(rank|র‌্যাংক|র‍্যাঙ্ক)\s*([0-9০-৯]+)', ql)
                if mpos2:
                    pos = int(normalize_digits(mpos2.group(2)))
            if not pos:
                mpos3 = re.search(r'([0-9০-৯]+)\s*(number|নম্বর|স্থান|position)', ql)
                if mpos3:
                    pos = int(normalize_digits(mpos3.group(1)))
            cls_id, cls_name = resolve_classroom()
            sec_id, sec_name = resolve_section()
            et = pick_exam_type()
            from results.models import Examination, Result
            from django.db.models import Sum
            if not cls_id:
                return Response({"text": "কোন ক্লাস উল্লেখ নেই। উদাহরণ: ক্লাস সেভেন ক।"}, status=status.HTTP_200_OK)
            exams = Examination.objects.all()
            if school_id:
                exams = exams.filter(school_id=school_id)
            exams = exams.filter(classroom_id=cls_id)
            if sec_id:
                exams = exams.filter(section_id=sec_id)
            if et:
                exams = exams.filter(exam_type=et)
            if date:
                try:
                    exams = exams.filter(exam_date=date)
                except Exception:
                    pass
            if month:
                try:
                    # month format YYYY-MM
                    y, mth = month.split('-')
                    exams = exams.filter(exam_date__year=int(y), exam_date__month=int(mth))
                except Exception:
                    pass
            ex = exams.order_by('-exam_date', '-id').first()
            if not ex:
                return Response({"text": "কোনো পরীক্ষা পাওয়া যায়নি।"}, status=status.HTTP_200_OK)
            agg = Result.objects.filter(examination=ex).values('student').annotate(total=Sum('total_obtained')).order_by('-total', 'student')
            if not agg:
                return Response({"text": "এই পরীক্ষার কোনো ফলাফল পাওয়া যায়নি।"}, status=status.HTTP_200_OK)
            if not pos or pos < 1 or pos > len(agg):
                return Response({"text": f"উল্লেখিত র‍্যাঙ্কের কোনো শিক্ষার্থী নেই। মোট {len(agg)} জনের ফল প্রকাশিত।"}, status=status.HTTP_200_OK)
            target = agg[pos-1]
            from academics.models import StudentProfile
            try:
                st = StudentProfile.objects.get(id=target['student'])
                nm = st.user.get_full_name() or st.user.username
                text = f"{ex.name}-এর {pos} তম: {nm} (রোল {st.roll_number}), মোট নম্বর {target['total']}।"
            except Exception:
                text = f"{ex.name}-এর {pos} তম শিক্ষার্থীর তথ্য পাওয়া যায়নি।"
            return Response({"text": text}, status=status.HTTP_200_OK)

        if it == 'action_send_sms':
            return Response({"text": "এসএমএস পাঠাতে হলে বাম পাশের মেনু থেকে 'SMS Panel'-এ যান। সেখানে আপনি নির্দিষ্ট ক্লাস বা বকেয়া শিক্ষার্থীদের মেসেজ পাঠাতে পারবেন।"}, status=status.HTTP_200_OK)

        if it == 'action_add_student':
            return Response({"text": "নতুন ছাত্র ভর্তি করতে হলে ড্যাশবোর্ডের 'Admission' মেনুতে ক্লিক করুন অথবা 'Students' পেজে গিয়ে 'Add Student' বাটন চাপুন।"}, status=status.HTTP_200_OK)

        if it == 'greeting':
            return Response({"text": "হ্যালো! আমি আপনাকে কীভাবে সাহায্য করতে পারি? পরীক্ষার ফলাফল, বকেয়া বেতন, বা অন্য কোনো তথ্য জানতে চাইতে পারেন।"}, status=status.HTTP_200_OK)
        
        if it == 'chat_status':
            return Response({"text": "আমি ভালো আছি, ধন্যবাদ! আপনি কেমন আছেন? আপনার কি কোনো সাহায্য প্রয়োজন?"}, status=status.HTTP_200_OK)
        
        if it == 'chat_affection':
            return Response({"text": "ধন্যবাদ! আমিও আপনাদের সবাইকে খুব পছন্দ করি। আপনাদের সাহায্য করতে পেরে আমি আনন্দিত।"}, status=status.HTTP_200_OK)
        
        if it == 'chat_compliment':
            return Response({"text": "অনেক ধন্যবাদ! আমি সবসময় চেষ্টা করি আপনাদের সেরা সেবা দিতে।"}, status=status.HTTP_200_OK)
            
        if it == 'chat_thanks':
            return Response({"text": "আপনাকেও ধন্যবাদ! আরো কোনো সাহায্য লাগলে জানাবেন।"}, status=status.HTTP_200_OK)
            
        if it == 'chat_activity':
            return Response({"text": "আমি এখন আপনার প্রশ্নের উত্তর দেওয়ার জন্য প্রস্তুত। আপনি কি কোনো নির্দিষ্ট তথ্য খুঁজছেন?"}, status=status.HTTP_200_OK)
            
        if it == 'chat_bye':
            return Response({"text": "আল্লাহ হাফেজ! আবার কথা হবে। ভালো থাকবেন।"}, status=status.HTTP_200_OK)

        if it == 'school_menu':
            items = [
                'ড্যাশবোর্ড','শ্রেণি','শিক্ষক','ছাত্র-ছাত্রী','বিষয়/সাবজেক্ট','হাজিরা','রেজাল্ট','রেজাল্ট কার্ড','Rank List','আইডি কার্ড','সার্টিফিকেট','প্রবেশপত্র','পরীক্ষা','ফি','ফি পরিশোধ','রিসিট বই','সফটওয়ার এ্যাসিসটেন্ট','এসএমএস','অভিভাবক','কমিটি','এডমিন','প্রোফাইল'
            ]
            n = len(items)
            ask_count = any(w in ql for w in ['কয়টি','কত','সংখ্যা','কতগুলো','কতগুলি','how many','count','total','মোট'])
            ask_list = any(w in ql for w in ['তালিকা','list','নাম','কি কি','options','items','অপশন','অপসন','ওপসন'])
            if ask_count and not ask_list:
                text = f"স্কুল মেনুতে মোট {n}টি অপশন আছে।"
                resp = {"text": text, "total_menu_items": n}
            elif ask_list and not ask_count:
                text = f"স্কুল মেনুর অপশনগুলো: {', '.join(items)}."
                resp = {"text": text, "items": items, "total_menu_items": n}
            else:
                text = f"স্কুল মেনুতে মোট {n}টি অপশন আছে। প্রধানগুলো: {', '.join(items[:6])}…"
                resp = {"text": text, "items": items, "total_menu_items": n}
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    result_summary=resp.get('text')
                )
            except Exception:
                pass
            return Response(resp)

        if it == 'student_result':
            import re
            def normalize_digits(s):
                m = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'}
                return ''.join(m.get(ch, ch) for ch in s)
            roll = None
            m = re.search(r'(roll|রোল|রোল নাম্বার|রোল নম্বর)\s*([0-9০-৯]+)', ql)
            if m:
                roll = normalize_digits(m.group(2))
            cls_id, cls_name = resolve_classroom()
            sec_id, sec_name = resolve_section()
            et = pick_exam_type()
            from academics.models import StudentProfile
            def find_student():
                base = StudentProfile.objects.all()
                if school_id:
                    base = base.filter(school_id=school_id)
                # Ordered fallbacks: most specific to least specific
                candidates = [
                    {'classroom_id': cls_id, 'section_id': sec_id, 'roll_number': roll},
                    {'classroom_id': cls_id, 'roll_number': roll},
                    {'section_id': sec_id, 'roll_number': roll},
                    {'roll_number': roll},
                    {'classroom_id': cls_id, 'section_id': sec_id},
                    {'classroom_id': cls_id},
                ]
                for flt in candidates:
                    qs = base
                    if flt.get('classroom_id'):
                        qs = qs.filter(classroom_id=flt['classroom_id'])
                    if flt.get('section_id'):
                        qs = qs.filter(section_id=flt['section_id'])
                    if flt.get('roll_number') is not None:
                        qs = qs.filter(roll_number=flt['roll_number'])
                    st = qs.select_related('user','classroom','section').order_by('id').first()
                    if st:
                        return st
                return None
            student = find_student()
            if not student:
                return Response({"text": "শিক্ষার্থী পাওয়া যায়নি।"}, status=status.HTTP_200_OK)
            from results.models import Examination, Result
            exams = Examination.objects.filter(classroom_id=student.classroom_id)
            if school_id:
                exams = exams.filter(school_id=school_id)
            if student.section_id:
                exams = exams.filter(section_id=student.section_id)
            if et:
                exams = exams.filter(exam_type=et)
            ex = exams.order_by('-exam_date','-id').first()
            if not ex:
                exams2 = Examination.objects.filter(classroom_id=student.classroom_id)
                if school_id:
                    exams2 = exams2.filter(school_id=school_id)
                if et:
                    exams2 = exams2.filter(exam_type=et)
                ex = exams2.order_by('-exam_date','-id').first()
            if not ex:
                fallback_order = ['annual','half_yearly','terminal','model','test']
                for et2 in fallback_order:
                    exams3 = Examination.objects.filter(classroom_id=student.classroom_id)
                    if school_id:
                        exams3 = exams3.filter(school_id=school_id)
                    if student.section_id:
                        exams3 = exams3.filter(section_id=student.section_id)
                    exams3 = exams3.filter(exam_type=et2)
                    ex2 = exams3.order_by('-exam_date','-id').first()
                    if ex2:
                        ex = ex2
                        et = et2
                        break
            if not ex:
                exams4 = Examination.objects.filter(classroom_id=student.classroom_id)
                if school_id:
                    exams4 = exams4.filter(school_id=school_id)
                ex = exams4.order_by('-exam_date','-id').first()
            if not ex:
                return Response({"text": "প্রাসঙ্গিক পরীক্ষা পাওয়া যায়নি।"}, status=status.HTTP_200_OK)
            rs = Result.objects.filter(examination=ex, student=student).select_related('subject')
            if not rs.exists():
                rs_any = Result.objects.filter(student=student).select_related('examination','subject').order_by('-examination__exam_date','-examination__id')
                if rs_any.exists():
                    ex = rs_any[0].examination
                    try:
                        et = getattr(ex, 'exam_type', et)
                    except Exception:
                        pass
                    rs = Result.objects.filter(examination=ex, student=student).select_related('subject')
                else:
                    return Response({"text": "রেজাল্ট পাওয়া যায়নি।"}, status=status.HTTP_200_OK)
            total_obtained = sum(float(r.total_obtained) for r in rs)
            total_possible = 0
            try:
                from results.utils import _class_group, get_subject_maxima
                cg = _class_group(getattr(ex.classroom, "name", None))
            except Exception:
                cg = None
            subjects = []
            for r in rs:
                tm = None
                try:
                    from results.utils import get_subject_maxima
                    maxima = get_subject_maxima(cg, getattr(r.subject, "name", None))
                    if maxima:
                        tm = int(maxima.get("written", 0)) + int(maxima.get("mcq", 0)) + int(maxima.get("practical", 0))
                except Exception:
                    tm = None
                total_possible += (tm if tm else ex.total_marks)
                subjects.append({
                    "subject": getattr(r.subject, 'name', ''),
                    "obtained": float(r.total_obtained),
                    "grade": r.grade,
                    "gpa": float(r.gpa),
                    "passed": bool(r.is_passed),
                })
            percentage = (total_obtained / total_possible * 100) if total_possible > 0 else 0
            avg_gpa = sum(float(r.gpa) for r in rs) / rs.count()
            is_passed = all(r.is_passed for r in rs)
            if avg_gpa >= 5.0:
                grade = 'A+'
            elif avg_gpa >= 4.0:
                grade = 'A'
            elif avg_gpa >= 3.5:
                grade = 'A-'
            elif avg_gpa >= 3.0:
                grade = 'B'
            elif avg_gpa >= 2.0:
                grade = 'C'
            elif avg_gpa >= 1.0:
                grade = 'D'
            else:
                grade = 'F'
            name = f"{student.user.first_name} {student.user.last_name}".strip() or student.user.username
            exam_disp = ex.name or bn_exam_label(et)
            cls_disp = student.classroom.name if student.classroom else (cls_name or cls_id)
            sec_disp = student.section.name if student.section else ''
            text = f"{cls_disp}{(' ('+sec_disp+')') if sec_disp else ''}-এর {exam_disp}-এ {name} (রোল {student.roll_number}) এর রেজাল্ট: শতাংশ {round(percentage,2)}%, GPA {round(avg_gpa,2)}, গ্রেড {grade}, {'পাস' if is_passed else 'ফেল'}।"
            resp = {
                "text": text,
                "student": {"id": student.id, "name": name, "roll": student.roll_number, "class": cls_disp, "section": sec_disp},
                "exam": {"id": ex.id, "name": exam_disp},
                "summary": {"total_obtained": round(total_obtained,2), "total_possible": round(total_possible,2), "percentage": round(percentage,2), "gpa": round(avg_gpa,2), "grade": grade, "is_passed": is_passed},
                "subjects": subjects
            }
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    params={'classroom': student.classroom_id, 'roll': student.roll_number, 'exam_id': ex.id},
                    result_summary=text
                )
            except Exception:
                pass
            return Response(resp)
        if it == 'results_topper':
            cls_id, cls_name = resolve_classroom()
            sec_id, sec_name = resolve_section()
            ex = latest_exam_for_class(cls_id, sec_id)
            if not ex and not exam_type:
                return Response({"error": "exam_type বা সর্বশেষ পরীক্ষা পাওয়া যায়নি"}, status=status.HTTP_400_BAD_REQUEST)
            from results.models import Result, Examination
            target_exam_ids = []
            if ex:
                target_exam_ids = [ex.id]
            else:
                et = pick_exam_type()
                exams = Examination.objects.all()
                if school_id:
                    exams = exams.filter(school_id=school_id)
                if cls_id:
                    exams = exams.filter(classroom_id=cls_id)
                if sec_id:
                    exams = exams.filter(section_id=sec_id)
                if et:
                    exams = exams.filter(exam_type=et)
                target_exam_ids = list(exams.values_list('id', flat=True))
            if not target_exam_ids:
                return Response({"text": "কোনো পরীক্ষা পাওয়া যায়নি।"}, status=status.HTTP_200_OK)
            from academics.models import StudentProfile
            students = StudentProfile.objects.all()
            if school_id:
                students = students.filter(school_id=school_id)
            if cls_id:
                students = students.filter(classroom_id=cls_id)
            if sec_id:
                students = students.filter(section_id=sec_id)
            stu_list = list(students)
            if not stu_list:
                return Response({"text": "এই শ্রেণিতে কোনো শিক্ষার্থী পাওয়া যায়নি।"}, status=status.HTTP_200_OK)
            rs = Result.objects.filter(examination_id__in=target_exam_ids, student__in=stu_list)
            by_student = {}
            for r in rs.select_related('examination', 'subject', 'student__user'):
                sid = r.student_id
                if sid not in by_student:
                    by_student[sid] = []
                by_student[sid].append(r)
            rows = []
            for st in stu_list:
                srs = by_student.get(st.id) or []
                if not srs:
                    continue
                total_obtained = sum(float(r.total_obtained) for r in srs)
                total_possible = 0
                for r in srs:
                    total_possible += (r.examination.total_marks or 0)
                avg_gpa = sum(float(r.gpa) for r in srs) / len(srs)
                percentage = (total_obtained / total_possible * 100) if total_possible > 0 else 0
                failed_subjects_count = sum(1 for r in srs if not r.is_passed)
                rows.append({
                    'student': st,
                    'avg_gpa': avg_gpa,
                    'percentage': percentage,
                    'failed_subjects_count': failed_subjects_count
                })
            if not rows:
                fallback_order = ['annual','half_yearly','terminal','model','test']
                for et2 in fallback_order:
                    exams2 = Examination.objects.all()
                    if school_id:
                        exams2 = exams2.filter(school_id=school_id)
                    if cls_id:
                        exams2 = exams2.filter(classroom_id=cls_id)
                    if sec_id:
                        exams2 = exams2.filter(section_id=sec_id)
                    exams2 = exams2.filter(exam_type=et2)
                    ids2 = list(exams2.values_list('id', flat=True))
                    if not ids2:
                        continue
                    rs2 = Result.objects.filter(examination_id__in=ids2, student__in=stu_list)
                    by_student2 = {}
                    for r in rs2.select_related('examination', 'subject', 'student__user'):
                        sid = r.student_id
                        by_student2.setdefault(sid, []).append(r)
                    rows2 = []
                    for st in stu_list:
                        srs = by_student2.get(st.id) or []
                        if not srs:
                            continue
                        total_obtained = sum(float(r.total_obtained) for r in srs)
                        total_possible = sum((r.examination.total_marks or 0) for r in srs)
                        avg_gpa = sum(float(r.gpa) for r in srs) / len(srs)
                        percentage = (total_obtained / total_possible * 100) if total_possible > 0 else 0
                        failed_subjects_count = sum(1 for r in srs if not r.is_passed)
                        rows2.append({
                            'student': st,
                            'avg_gpa': avg_gpa,
                            'percentage': percentage,
                            'failed_subjects_count': failed_subjects_count,
                            'exam_type': et2
                        })
                    if rows2:
                        rows = rows2
                        exam_type = et2
                        break
            if not rows:
                return Response({"text": "রেজাল্ট পাওয়া যায়নি।"}, status=status.HTTP_200_OK)
            rows.sort(key=lambda x: (x.get('failed_subjects_count', 0), -(float(x.get('avg_gpa') or 0)), -(float(x.get('percentage') or 0))))
            topper = rows[0]
            name = f"{topper['student'].user.first_name} {topper['student'].user.last_name}".strip() or topper['student'].user.username
            cls_disp = cls_name or cls_id or ''
            sec_disp = sec_name or ''
            exam_disp = getattr(ex, 'name', '') or bn_exam_label(exam_type or pick_exam_type())
            if sec_disp:
                text = f"{cls_disp} ({sec_disp})-এ {exam_disp}-এর ১ম হয়েছে {name}।"
            else:
                text = f"{cls_disp}-এ {exam_disp}-এর ১ম হয়েছে {name}।"
            resp = {"text": text, "topper": {"student_id": topper['student'].id, "name": name, "gpa": round(topper['avg_gpa'],2), "percentage": round(topper['percentage'],2)}}
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    params={'classroom': cls_id, 'section': sec_id},
                    result_summary=text
                )
                mem, _ = AssistantMemory.objects.get_or_create(school_id=school_id or 0, key='topper_cache')
                data = dict(mem.data or {})
                k = f"{cls_id or ''}:{sec_id or ''}"
                data[k] = resp['topper']
                mem.data = data
                mem.save(update_fields=['data'])
            except Exception:
                pass
            return Response(resp)
        if it == 'results':
            et = pick_exam_type()
            cls_id, cls_name = resolve_classroom()
            sec_id, sec_name = resolve_section()
            from results.models import Examination, Result
            target_exam = None
            if et:
                exams = Examination.objects.filter(exam_type=et)
                if cls_id:
                    exams = exams.filter(classroom_id=cls_id)
                if sec_id:
                    exams = exams.filter(section_id=sec_id)
                if school_id:
                    exams = exams.filter(school_id=school_id)
                target_exam = exams.order_by('-exam_date', '-id').first()
            else:
                target_exam = latest_exam_for_class(cls_id, sec_id)
                if not target_exam:
                    fallback_order = ['annual','half_yearly','terminal','model','test']
                    for et2 in fallback_order:
                        exams2 = Examination.objects.all()
                        if school_id:
                            exams2 = exams2.filter(school_id=school_id)
                        if cls_id:
                            exams2 = exams2.filter(classroom_id=cls_id)
                        if sec_id:
                            exams2 = exams2.filter(section_id=sec_id)
                        exams2 = exams2.filter(exam_type=et2)
                        target_exam = exams2.order_by('-exam_date', '-id').first()
                        if target_exam:
                            et = et2
                            break
            if not target_exam:
                text = "কোনো পরীক্ষা পাওয়া যায়নি।"
                try:
                    AssistantLog.objects.create(
                        user=getattr(request, 'user', None),
                        school_id=school_id if school_id else None,
                        query_text=q,
                        intent=it,
                        params={'exam_type': et or '', 'classroom': cls_id, 'section': sec_id},
                        result_summary=text
                    )
                except Exception:
                    pass
                return Response({"text": text, "rows": []})
            rs = Result.objects.filter(examination=target_exam)
            if school_id:
                rs = rs.filter(student__school_id=school_id)
            if sec_id:
                rs = rs.filter(student__section_id=sec_id)
            if cls_id:
                rs = rs.filter(student__classroom_id=cls_id)
            student_count = rs.values_list('student_id', flat=True).distinct().count()
            cls_disp = cls_name or cls_id or ''
            et_disp = getattr(target_exam, 'name', '') or bn_exam_label(et)
            if sec_name:
                text = f"{cls_disp}-এর {et_disp} Exam ({sec_name})-এ মোট {student_count} জন শিক্ষার্থী অংশগ্রহণ করেছে।"
            else:
                text = f"{cls_disp}-এর {et_disp} Exam-এ মোট {student_count} জন শিক্ষার্থী অংশগ্রহণ করেছে।"
            resp = {"text": text, "total_students": student_count}
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    params={'exam_id': target_exam.id, 'exam_type': et or '', 'classroom': cls_id, 'section': sec_id},
                    result_summary=text
                )
                mem, _ = AssistantMemory.objects.get_or_create(school_id=school_id or 0, key='intent_counts')
                data = dict(mem.data or {})
                data[it] = int(data.get(it, 0)) + 1
                mem.data = data
                mem.save(update_fields=['data'])
            except Exception:
                pass
            return Response(resp)
        if it == 'results_student_count':
            from results.models import Examination, Result
            et = pick_exam_type()
            # Avoid auto-fallback classroom unless explicitly asked
            import re
            has_class_tokens = bool(re.search(r'(class|ক্লাস|শ্রেণি)', ql))
            has_section_tokens = bool(re.search(r'(section|সেকশন|শাখা|\([a-zA-Zঅ-হ]+\))', ql))
            cls_id, cls_name = resolve_classroom()
            sec_id, sec_name = resolve_section()
            explicit_cls = bool(classroom_id)
            explicit_sec = bool(section_id)
            if not (explicit_cls or has_class_tokens):
                cls_id, cls_name = None, None
            if not (explicit_sec or has_section_tokens):
                sec_id, sec_name = None, None
            def base_exams():
                qs = Examination.objects.all()
                if school_id:
                    qs = qs.filter(school_id=school_id)
                if cls_id:
                    qs = qs.filter(classroom_id=cls_id)
                if sec_id:
                    qs = qs.filter(section_id=sec_id)
                if et:
                    qs = qs.filter(exam_type=et)
                return qs
            exams = base_exams()
            ids = []
            # Apply date/month with graceful fallback
            if date:
                try:
                    # exact date
                    ids = list(exams.filter(exam_date=date).values_list('id', flat=True))
                except Exception:
                    ids = []
                if not ids:
                    # fallback to same month of date
                    try:
                        import datetime as dt
                        y, m = dt.date.fromisoformat(str(date)).year, dt.date.fromisoformat(str(date)).month
                        ids = list(exams.filter(exam_date__year=int(y), exam_date__month=int(m)).values_list('id', flat=True))
                    except Exception:
                        ids = []
                if not ids:
                    # fallback to same year
                    try:
                        import datetime as dt
                        y = dt.date.fromisoformat(str(date)).year
                        ids = list(exams.filter(exam_date__year=int(y)).values_list('id', flat=True))
                    except Exception:
                        ids = []
            elif month:
                try:
                    y, mth = month.split('-')
                    ids = list(exams.filter(exam_date__year=int(y), exam_date__month=int(mth)).values_list('id', flat=True))
                except Exception:
                    ids = []
                if not ids:
                    # fallback to year
                    try:
                        y = int((month.split('-')[0]))
                        ids = list(exams.filter(exam_date__year=y).values_list('id', flat=True))
                    except Exception:
                        ids = []
            else:
                # no date/month provided: use latest exams (recent first)
                latest = exams.order_by('-exam_date', '-id')[:10]
                ids = [e.id for e in latest]
                if not ids:
                    ids = list(exams.values_list('id', flat=True))
            if not ids:
                # last resort: drop exam_type constraint if set
                if et:
                    exams2 = base_exams().exclude(exam_type=et)
                    latest2 = exams2.order_by('-exam_date', '-id')[:10]
                    ids = [e.id for e in latest2]
                    if not ids:
                        ids = list(exams2.values_list('id', flat=True))
            if not ids and (cls_id or sec_id):
                # widen search by removing classroom/section constraints
                qs_wide = Examination.objects.all()
                if school_id:
                    qs_wide = qs_wide.filter(school_id=school_id)
                if et:
                    qs_wide = qs_wide.filter(exam_type=et)
                latest3 = qs_wide.order_by('-exam_date', '-id')[:10]
                ids = [e.id for e in latest3]
                if not ids:
                    ids = list(qs_wide.values_list('id', flat=True))
            if not ids:
                return Response({"text": "কোনো পরীক্ষা পাওয়া যায়নি।", "students_with_results": 0})
            rs = Result.objects.filter(examination_id__in=ids)
            if school_id:
                rs = rs.filter(student__school_id=school_id)
            if cls_id:
                rs = rs.filter(student__classroom_id=cls_id)
            if sec_id:
                rs = rs.filter(student__section_id=sec_id)
            total_students = rs.values_list('student_id', flat=True).distinct().count()
            cls_disp = cls_name or cls_id or ''
            sec_disp = sec_name or ''
            parts = []
            if cls_disp:
                parts.append(cls_disp)
            if sec_disp:
                parts.append(f"({sec_disp})")
            hdr = ' '.join([p for p in parts if p]).strip()
            if hdr:
                text = f"{hdr}-এর মোট {total_students} জন শিক্ষার্থীর রেজাল্ট ইনপুট দেওয়া হয়েছে।"
            else:
                text = f"মোট {total_students} জন শিক্ষার্থীর রেজাল্ট ইনপুট দেওয়া হয়েছে।"
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    params={'exam_type': et or '', 'classroom': cls_id, 'section': sec_id, 'date': date, 'month': month},
                    result_summary=text
                )
            except Exception:
                pass
            return Response({"text": text, "students_with_results": total_students})
        if it == 'results_student_details':
            from results.models import Examination, Result
            et = pick_exam_type()
            import re
            has_class_tokens = bool(re.search(r'(class|ক্লাস|শ্রেণি)', ql))
            has_section_tokens = bool(re.search(r'(section|সেকশন|শাখা|\([a-zA-Zঅ-হ]+\))', ql))
            cls_id, cls_name = resolve_classroom()
            sec_id, sec_name = resolve_section()
            explicit_cls = bool(classroom_id)
            explicit_sec = bool(section_id)
            if not (explicit_cls or has_class_tokens):
                cls_id, cls_name = None, None
            if not (explicit_sec or has_section_tokens):
                sec_id, sec_name = None, None
            def base_exams():
                qs = Examination.objects.all()
                if school_id:
                    qs = qs.filter(school_id=school_id)
                if cls_id:
                    qs = qs.filter(classroom_id=cls_id)
                if sec_id:
                    qs = qs.filter(section_id=sec_id)
                if et:
                    qs = qs.filter(exam_type=et)
                return qs
            exams = base_exams()
            ids = []
            if date:
                try:
                    ids = list(exams.filter(exam_date=date).values_list('id', flat=True))
                except Exception:
                    ids = []
                if not ids:
                    try:
                        import datetime as dt
                        y, m = dt.date.fromisoformat(str(date)).year, dt.date.fromisoformat(str(date)).month
                        ids = list(exams.filter(exam_date__year=int(y), exam_date__month=int(m)).values_list('id', flat=True))
                    except Exception:
                        ids = []
                if not ids:
                    try:
                        import datetime as dt
                        y = dt.date.fromisoformat(str(date)).year
                        ids = list(exams.filter(exam_date__year=int(y)).values_list('id', flat=True))
                    except Exception:
                        ids = []
            elif month:
                try:
                    y, mth = month.split('-')
                    ids = list(exams.filter(exam_date__year=int(y), exam_date__month=int(mth)).values_list('id', flat=True))
                except Exception:
                    ids = []
                if not ids:
                    try:
                        y = int((month.split('-')[0]))
                        ids = list(exams.filter(exam_date__year=y).values_list('id', flat=True))
                    except Exception:
                        ids = []
            else:
                latest = exams.order_by('-exam_date', '-id')[:10]
                ids = [e.id for e in latest]
                if not ids:
                    ids = list(exams.values_list('id', flat=True))
            if not ids and et:
                exams2 = base_exams().exclude(exam_type=et)
                latest2 = exams2.order_by('-exam_date', '-id')[:10]
                ids = [e.id for e in latest2]
                if not ids:
                    ids = list(exams2.values_list('id', flat=True))
            if not ids and (cls_id or sec_id):
                qs_wide = Examination.objects.all()
                if school_id:
                    qs_wide = qs_wide.filter(school_id=school_id)
                if et:
                    qs_wide = qs_wide.filter(exam_type=et)
                latest3 = qs_wide.order_by('-exam_date', '-id')[:10]
                ids = [e.id for e in latest3]
                if not ids:
                    ids = list(qs_wide.values_list('id', flat=True))
            if not ids:
                return Response({"text": "কোনো পরীক্ষা পাওয়া যায়নি।"})
            rs = Result.objects.filter(examination_id__in=ids)
            if school_id:
                rs = rs.filter(student__school_id=school_id)
            if cls_id:
                rs = rs.filter(student__classroom_id=cls_id)
            if sec_id:
                rs = rs.filter(student__section_id=sec_id)
            stu_ids = list(rs.values_list('student_id', flat=True).distinct())[:1]
            if not stu_ids:
                return Response({"text": "রেজাল্ট পাওয়া যায়নি।"})
            sid = stu_ids[0]
            rs_one = Result.objects.filter(examination_id__in=ids, student_id=sid).select_related('subject', 'student__user', 'examination', 'student__classroom', 'student__section')
            if not rs_one.exists():
                return Response({"text": "এই শিক্ষার্থীর বিস্তারিত রেজাল্ট পাওয়া যায়নি।"})
            st = rs_one[0].student
            name = (st.user.get_full_name() or st.user.username or '').strip()
            subjects = []
            for r in rs_one:
                subjects.append({
                    "subject": getattr(r.subject, "name", ""),
                    "obtained": float(r.total_obtained),
                    "grade": r.grade,
                    "gpa": float(r.gpa),
                    "passed": bool(r.is_passed)
                })
            cls_disp = getattr(st.classroom, 'name', '') or ''
            sec_disp = getattr(st.section, 'name', '') or ''
            text = f"{name} ({'রোল ' + str(st.roll_number) if st.roll_number else ''})"
            if cls_disp:
                text += f", {cls_disp}"
                if sec_disp:
                    text += f" ({sec_disp})"
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    params={'student_id': sid, 'exam_ids': ids},
                    result_summary=text
                )
            except Exception:
                pass
            return Response({"text": text, "student": {"id": sid, "name": name, "roll": st.roll_number, "class": cls_disp, "section": sec_disp}, "subjects": subjects})
        if it == 'results_student_count_details':
            from results.models import Examination, Result
            et = pick_exam_type()
            import re
            has_class_tokens = bool(re.search(r'(class|ক্লাস|শ্রেণি)', ql))
            has_section_tokens = bool(re.search(r'(section|সেকশন|শাখা|\([a-zA-Zঅ-হ]+\))', ql))
            cls_id, cls_name = resolve_classroom()
            sec_id, sec_name = resolve_section()
            explicit_cls = bool(classroom_id)
            explicit_sec = bool(section_id)
            if not (explicit_cls or has_class_tokens):
                cls_id, cls_name = None, None
            if not (explicit_sec or has_section_tokens):
                sec_id, sec_name = None, None
            def base_exams():
                qs = Examination.objects.all()
                if school_id:
                    qs = qs.filter(school_id=school_id)
                if cls_id:
                    qs = qs.filter(classroom_id=cls_id)
                if sec_id:
                    qs = qs.filter(section_id=sec_id)
                if et:
                    qs = qs.filter(exam_type=et)
                return qs
            exams = base_exams()
            ids = []
            if date:
                try:
                    ids = list(exams.filter(exam_date=date).values_list('id', flat=True))
                except Exception:
                    ids = []
                if not ids:
                    try:
                        import datetime as dt
                        y, m = dt.date.fromisoformat(str(date)).year, dt.date.fromisoformat(str(date)).month
                        ids = list(exams.filter(exam_date__year=int(y), exam_date__month=int(m)).values_list('id', flat=True))
                    except Exception:
                        ids = []
                if not ids:
                    try:
                        import datetime as dt
                        y = dt.date.fromisoformat(str(date)).year
                        ids = list(exams.filter(exam_date__year=int(y)).values_list('id', flat=True))
                    except Exception:
                        ids = []
            elif month:
                try:
                    y, mth = month.split('-')
                    ids = list(exams.filter(exam_date__year=int(y), exam_date__month=int(mth)).values_list('id', flat=True))
                except Exception:
                    ids = []
                if not ids:
                    try:
                        y = int((month.split('-')[0]))
                        ids = list(exams.filter(exam_date__year=y).values_list('id', flat=True))
                    except Exception:
                        ids = []
            else:
                latest = exams.order_by('-exam_date', '-id')[:10]
                ids = [e.id for e in latest]
                if not ids:
                    ids = list(exams.values_list('id', flat=True))
            if not ids and et:
                exams2 = base_exams().exclude(exam_type=et)
                latest2 = exams2.order_by('-exam_date', '-id')[:10]
                ids = [e.id for e in latest2]
                if not ids:
                    ids = list(exams2.values_list('id', flat=True))
            if not ids and (cls_id or sec_id):
                qs_wide = Examination.objects.all()
                if school_id:
                    qs_wide = qs_wide.filter(school_id=school_id)
                if et:
                    qs_wide = qs_wide.filter(exam_type=et)
                latest3 = qs_wide.order_by('-exam_date', '-id')[:10]
                ids = [e.id for e in latest3]
                if not ids:
                    ids = list(qs_wide.values_list('id', flat=True))
            if not ids:
                # fallback: use any results in school
                rs_any = Result.objects.all()
                if school_id:
                    rs_any = rs_any.filter(student__school_id=school_id)
                if cls_id:
                    rs_any = rs_any.filter(student__classroom_id=cls_id)
                if sec_id:
                    rs_any = rs_any.filter(student__section_id=sec_id)
                stu_ids_any = list(rs_any.values_list('student_id', flat=True).distinct())
                total_students_any = len(stu_ids_any)
                if total_students_any == 0:
                    return Response({"text": "কোনো পরীক্ষা পাওয়া যায়নি।", "students_with_results": 0})
                # Pick one student and show details
                sid_any = stu_ids_any[0]
                rs_one_any = rs_any.filter(student_id=sid_any).select_related('subject', 'student__user', 'student__classroom', 'student__section')[:8]
                name_any = ''
                cls_disp_any = ''
                sec_disp_any = ''
                subjects_any = []
                if rs_one_any:
                    st_any = rs_one_any[0].student
                    name_any = (st_any.user.get_full_name() or st_any.user.username or '').strip()
                    cls_disp_any = getattr(st_any.classroom, 'name', '') or ''
                    sec_disp_any = getattr(st_any.section, 'name', '') or ''
                    for r in rs_one_any:
                        subjects_any.append({
                            "subject": getattr(r.subject, "name", ""),
                            "obtained": float(r.total_obtained),
                            "grade": r.grade,
                            "gpa": float(r.gpa),
                            "passed": bool(r.is_passed)
                        })
                text_any = f"মোট {total_students_any} জন শিক্ষার্থীর রেজাল্ট ইনপুট দেওয়া হয়েছে।"
                resp_any = {"text": text_any, "students_with_results": total_students_any}
                if subjects_any:
                    resp_any["student"] = {"name": name_any, "roll": getattr(st_any, 'roll_number', None), "class": cls_disp_any, "section": sec_disp_any}
                    resp_any["subjects"] = subjects_any
                return Response(resp_any)
            rs = Result.objects.filter(examination_id__in=ids)
            if school_id:
                rs = rs.filter(student__school_id=school_id)
            if cls_id:
                rs = rs.filter(student__classroom_id=cls_id)
            if sec_id:
                rs = rs.filter(student__section_id=sec_id)
            total_students = rs.values_list('student_id', flat=True).distinct().count()
            stu_ids = list(rs.values_list('student_id', flat=True).distinct())[:1]
            subjects = []
            name = ''
            roll = None
            cls_disp = ''
            sec_disp = ''
            if stu_ids:
                sid = stu_ids[0]
                rs_one = Result.objects.filter(examination_id__in=ids, student_id=sid).select_related('subject', 'student__user', 'student__classroom', 'student__section')
                if rs_one.exists():
                    st = rs_one[0].student
                    name = (st.user.get_full_name() or st.user.username or '').strip()
                    roll = getattr(st, 'roll_number', None)
                    cls_disp = getattr(st.classroom, 'name', '') or ''
                    sec_disp = getattr(st.section, 'name', '') or ''
                    for r in rs_one:
                        subjects.append({
                            "subject": getattr(r.subject, "name", ""),
                            "obtained": float(r.total_obtained),
                            "grade": r.grade,
                            "gpa": float(r.gpa),
                            "passed": bool(r.is_passed)
                        })
            text = f"মোট {total_students} জন শিক্ষার্থীর রেজাল্ট ইনপুট দেওয়া হয়েছে।"
            resp = {"text": text, "students_with_results": total_students}
            if subjects:
                resp["student"] = {"name": name, "roll": roll, "class": cls_disp, "section": sec_disp}
                resp["subjects"] = subjects
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    params={'exam_type': et or '', 'classroom': cls_id, 'section': sec_id, 'date': date, 'month': month},
                    result_summary=text
                )
            except Exception:
                pass
            return Response(resp)
        if it == 'results_years':
            from results.models import Examination
            qs = Examination.objects.all()
            if school_id:
                qs = qs.filter(school_id=school_id)
            qs = qs.exclude(exam_date__isnull=True)
            if date:
                qs = qs.filter(exam_date=date)
            if month:
                try:
                    y, mth = month.split('-')
                    qs = qs.filter(exam_date__year=int(y), exam_date__month=int(mth))
                except Exception:
                    pass
                raw_years = list(qs.values_list('exam_date__year', flat=True))
                years = sorted(int(y) for y in set(raw_years) if y is not None)
                if not years:
                    text = "এই স্কুলে কোনো বছরের পরীক্ষা পাওয়া যায়নি।"
                    return Response({"text": text, "years": []})
                text = f"এই স্কুলে যেসব বছরে পরীক্ষা নেওয়া হয়েছে: {', '.join(str(y) for y in years)}।"
                try:
                    AssistantLog.objects.create(
                        user=getattr(request, 'user', None),
                        school_id=school_id if school_id else None,
                        query_text=q,
                        intent=it,
                        result_summary=text
                    )
                except Exception:
                    pass
                return Response({"text": text, "years": years})
        if it == 'results_exams_list':
            from results.models import Examination, Result
            from django.db.models import Count
            et = pick_exam_type()
            import re
            has_class_tokens = bool(re.search(r'(class|ক্লাস|শ্রেণি)', ql))
            has_section_tokens = bool(re.search(r'(section|সেকশন|শাখা|\([a-zA-Zঅ-হ]+\))', ql))
            cls_id, cls_name = resolve_classroom()
            sec_id, sec_name = resolve_section()
            explicit_cls = bool(classroom_id)
            explicit_sec = bool(section_id)
            if not (explicit_cls or has_class_tokens):
                cls_id, cls_name = None, None
            if not (explicit_sec or has_section_tokens):
                sec_id, sec_name = None, None
            exams = Examination.objects.all()
            if school_id:
                exams = exams.filter(school_id=school_id)
            if cls_id:
                exams = exams.filter(classroom_id=cls_id)
            if sec_id:
                exams = exams.filter(section_id=sec_id)
            if et:
                exams = exams.filter(exam_type=et)
            # Narrow by date/month if provided (with graceful fallback)
            ids = []
            if date:
                try:
                    ids = list(exams.filter(exam_date=date).values_list('id', flat=True))
                except Exception:
                    ids = []
                if not ids:
                    try:
                        import datetime as dt
                        y, m = dt.date.fromisoformat(str(date)).year, dt.date.fromisoformat(str(date)).month
                        ids = list(exams.filter(exam_date__year=int(y), exam_date__month=int(m)).values_list('id', flat=True))
                    except Exception:
                        ids = []
                if not ids:
                    try:
                        import datetime as dt
                        y = dt.date.fromisoformat(str(date)).year
                        ids = list(exams.filter(exam_date__year=int(y)).values_list('id', flat=True))
                    except Exception:
                        ids = []
            elif month:
                try:
                    y, mth = month.split('-')
                    ids = list(exams.filter(exam_date__year=int(y), exam_date__month=int(mth)).values_list('id', flat=True))
                except Exception:
                    ids = []
                if not ids:
                    try:
                        y = int((month.split('-')[0]))
                        ids = list(exams.filter(exam_date__year=y).values_list('id', flat=True))
                    except Exception:
                        ids = []
            else:
                ids = list(exams.values_list('id', flat=True))
            if not ids and et:
                exams2 = Examination.objects.all()
                if school_id:
                    exams2 = exams2.filter(school_id=school_id)
                if cls_id:
                    exams2 = exams2.filter(classroom_id=cls_id)
                if sec_id:
                    exams2 = exams2.filter(section_id=sec_id)
                exams2 = exams2.exclude(exam_type=et)
                ids = list(exams2.values_list('id', flat=True))
            if not ids:
                return Response({"text": "কোনো পরীক্ষা পাওয়া যায়নি।", "exams": []})
            # Only those with results
            rs_qs = Result.objects.filter(examination_id__in=ids)
            if school_id:
                rs_qs = rs_qs.filter(student__school_id=school_id)
            if cls_id:
                rs_qs = rs_qs.filter(student__classroom_id=cls_id)
            if sec_id:
                rs_qs = rs_qs.filter(student__section_id=sec_id)
            counts = list(rs_qs.values('examination_id').annotate(results_count=Count('id'), students_count=Count('student_id', distinct=True)))
            count_map = {c['examination_id']: c for c in counts if c['results_count'] > 0}
            exam_ids_with_results = list(count_map.keys())
            if not exam_ids_with_results:
                return Response({"text": "এই শর্তে কোনো পরীক্ষার রেজাল্ট পাওয়া যায়নি।", "exams": []})
            ex_list = list(Examination.objects.filter(id__in=exam_ids_with_results).select_related('classroom', 'section').values('id','name','exam_type','exam_date','classroom__name','section__name'))
            # Build response
            def fmt_date(d):
                try:
                    return d.strftime('%Y-%m-%d') if d else ''
                except Exception:
                    return ''
            exams_out = []
            for e in ex_list:
                c = count_map.get(e['id']) or {'results_count': 0, 'students_count': 0}
                exams_out.append({
                    "id": e['id'],
                    "name": e['name'],
                    "type": e['exam_type'],
                    "date": fmt_date(e['exam_date']),
                    "class": e['classroom__name'] or '',
                    "section": e['section__name'] or '',
                    "results_count": int(c['results_count']),
                    "students_count": int(c['students_count'])
                })
            cls_disp = cls_name or cls_id or ''
            sec_disp = sec_name or ''
            prefix = (cls_disp + (f" ({sec_disp})" if sec_disp else '')).strip()
            if prefix:
                text = f"{prefix}-এর যে পরীক্ষাগুলোর রেজাল্ট ইনপুট দেওয়া আছে:"
            else:
                text = "যে পরীক্ষাগুলোর রেজাল্ট ইনপুট দেওয়া আছে:"
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    params={'exam_type': et or '', 'classroom': cls_id, 'section': sec_id, 'date': date, 'month': month},
                    result_summary=text
                )
            except Exception:
                pass
            return Response({"text": text, "exams": exams_out})
        if it == 'attendance_daily':
            if not school_id:
                return Response({"error": "school প্রয়োজন"}, status=status.HTTP_400_BAD_REQUEST)
            if not date:
                return Response({"error": "date প্রয়োজন"}, status=status.HTTP_400_BAD_REQUEST)
            from academics.models import StudentProfile
            from attendance.models import AttendanceRecord
            students = StudentProfile.objects.filter(classroom__school_id=school_id)
            cls_id, _ = resolve_classroom()
            sec_id, _ = resolve_section()
            if cls_id:
                students = students.filter(classroom_id=cls_id)
            if sec_id:
                students = students.filter(section_id=sec_id)
            ids = list(students.values_list('id', flat=True))
            recs = AttendanceRecord.objects.filter(school_id=school_id, date=date, student_id__in=ids)
            present = recs.filter(present=True).count()
            absent = recs.filter(present=False).count()
            total = len(ids)
            percentage = round((present / total * 100), 2) if total > 0 else 0
            resp = {"text": f"তারিখ {date}-এ উপস্থিতি {percentage}%। উপস্থিত {present}, অনুপস্থিত {absent}, মোট {total}।", "present": present, "absent": absent, "total": total, "percentage": percentage}
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    params={'date': date, 'classroom': cls_id, 'section': sec_id},
                    result_summary=resp['text']
                )
            except Exception:
                pass
            return Response(resp)
        if it == 'attendance_monthly':
            if not school_id or not month:
                return Response({"error": "school এবং month প্রয়োজন"}, status=status.HTTP_400_BAD_REQUEST)
            from datetime import datetime
            y, m = None, None
            try:
                y, m = map(int, month.split('-'))
            except Exception:
                return Response({"error": "month ফরম্যাট YYYY-MM"}, status=status.HTTP_400_BAD_REQUEST)
            from academics.models import StudentProfile
            from attendance.models import AttendanceRecord
            cls_id, _ = resolve_classroom()
            sec_id, _ = resolve_section()
            students = StudentProfile.objects.filter(classroom__school_id=school_id)
            if cls_id:
                students = students.filter(classroom_id=cls_id)
            if sec_id:
                students = students.filter(section_id=sec_id)
            ids = list(students.values_list('id', flat=True))
            import datetime as dt
            start_date = dt.date(y, m, 1)
            end_date = dt.date(y + 1, 1, 1) if m == 12 else dt.date(y, m + 1, 1)
            recs = AttendanceRecord.objects.filter(school_id=school_id, student_id__in=ids, date__gte=start_date, date__lt=end_date)
            present = recs.filter(present=True).count()
            absent = recs.filter(present=False).count()
            total_marked = present + absent
            percentage = round((present / total_marked * 100), 2) if total_marked > 0 else 0
            resp = {"text": f"{month} মাসে উপস্থিতি {percentage}%। উপস্থিত {present}, অনুপস্থিত {absent}, মোট {total_marked}।", "present": present, "absent": absent, "total_days_marked": total_marked, "percentage": percentage}
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    params={'month': month, 'classroom': cls_id, 'section': sec_id},
                    result_summary=resp['text']
                )
                mem, _ = AssistantMemory.objects.get_or_create(school_id=school_id or 0, key='intent_counts')
                data = dict(mem.data or {})
                data[it] = int(data.get(it, 0)) + 1
                mem.data = data
                mem.save(update_fields=['data'])
            except Exception:
                pass
            return Response(resp)
        if it == 'fees_collection':
            if not school_id:
                return Response({"error": "school প্রয়োজন"}, status=status.HTTP_400_BAD_REQUEST)
            from fees.models import FeeSlip, Payment
            cls_id, _ = resolve_classroom()
            y, m = None, None
            if month:
                try:
                    y, m = map(int, month.split('-'))
                except Exception:
                    y, m = None, None
            slips = FeeSlip.objects.filter(school_id=school_id)
            if cls_id:
                slips = slips.filter(classroom_id=cls_id)
            if y and m:
                slips = slips.filter(year=y, month=m)
            total_expected = slips.aggregate(a=Sum('amount'))['a'] or 0
            payments = Payment.objects.filter(student__school_id=school_id)
            if cls_id:
                payments = payments.filter(student__classroom_id=cls_id)
            if y and m:
                import datetime as dt
                start_date = dt.date(y, m, 1)
                end_date = dt.date(y + 1, 1, 1) if m == 12 else dt.date(y, m + 1, 1)
                payments = payments.filter(payment_date__gte=start_date, payment_date__lt=end_date, payment_status='completed')
            collected = payments.aggregate(a=Sum('amount'))['a'] or 0
            pending = float(total_expected) - float(collected)
            pct = round((float(collected) / float(total_expected) * 100), 2) if float(total_expected) > 0 else 0
            msg = f"ফি কালেকশন: মোট দাবী {total_expected}, আদায় {collected}, বাকি {pending}, শতাংশ {pct}%।"
            resp = {"text": msg, "total_expected": total_expected, "total_collected": collected, "total_pending": pending, "collection_percentage": pct}
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    params={'month': month, 'classroom': cls_id},
                    result_summary=msg
                )
                if school_id:
                    mem, _ = AssistantMemory.objects.get_or_create(school_id=school_id, key='intent_counts')
                    data = dict(mem.data or {})
                    data[it] = int(data.get(it, 0)) + 1
                    mem.data = data
                    mem.save(update_fields=['data'])
            except Exception:
                pass
            return Response(resp)
        if it == 'fees_due':
            if not school_id:
                return Response({"error": "school প্রয়োজন"}, status=status.HTTP_400_BAD_REQUEST)
            from fees.models import FeeSlip, Payment
            import datetime as dt
            y, m = None, None
            if month:
                try:
                    y, m = map(int, month.split('-'))
                except Exception:
                    y, m = None, None
            else:
                today = dt.date.today()
                y, m = today.year, today.month
            slips = FeeSlip.objects.filter(school_id=school_id, year=y, month=m)
            total_due = slips.aggregate(a=Sum(F('amount') - F('amount_paid')))['a'] or 0
            msg = f"{y}-{m:02d} মাসে মোট বকেয়া {total_due} টাকা।"
            resp = {"text": msg, "month": f"{y}-{m:02d}", "total_due": float(total_due)}
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    params={'month': f"{y}-{m:02d}"},
                    result_summary=msg
                )
                if school_id:
                    mem, _ = AssistantMemory.objects.get_or_create(school_id=school_id, key='intent_counts')
                    data = dict(mem.data or {})
                    data[it] = int(data.get(it, 0)) + 1
                    mem.data = data
                    mem.save(update_fields=['data'])
            except Exception:
                pass
            return Response(resp)
        if it == 'school_counts':
            if not school_id:
                return Response({"error": "school প্রয়োজন"}, status=status.HTTP_400_BAD_REQUEST)
            from academics.models import StudentProfile
            try:
                from users.models import AssistantMemory
                mem, _ = AssistantMemory.objects.get_or_create(school_id=school_id or 0, key='cache')
                cache = dict(mem.data or {})
            except Exception:
                cache = {}
            
            cls_id, cls_name = resolve_classroom()
            sec_id, sec_name = resolve_section()
            cache_key = f"school_counts|{school_id or ''}|{cls_id or ''}|{sec_id or ''}"
            cached = cache.get(cache_key)
            if cached:
                import time
                now = int(time.time())
                if isinstance(cached, dict) and 'value' in cached and 'ts' in cached and 'ttl' in cached:
                    if (now - int(cached['ts'])) <= int(cached['ttl']):
                        return Response(cached['value'])
                else:
                    return Response(cached)
            
            qs_students = StudentProfile.objects.filter(school_id=school_id)
            if cls_id:
                qs_students = qs_students.filter(classroom_id=cls_id)
            if sec_id:
                qs_students = qs_students.filter(section_id=sec_id)
                
            students_count = qs_students.count()
            
            # Teachers are usually not assigned to a single class in Profile model directly in a simple way 
            # (unless we check assignments, but let's keep it simple for now or just return total teachers if no class specified)
            
            if cls_id:
                # If specific class requested, we focus on students
                cls_disp = cls_name or cls_id
                if sec_name:
                    text = f"{cls_disp} ({sec_name})-এ মোট {students_count} জন শিক্ষার্থী রয়েছে।"
                else:
                    text = f"{cls_disp}-এ মোট {students_count} জন শিক্ষার্থী রয়েছে।"
            else:
                teachers_count = Profile.objects.filter(school_id=school_id, role='teacher').count()
                text = f"এই স্কুলে মোট {students_count} জন শিক্ষার্থী ও {teachers_count} জন শিক্ষক রয়েছে।"
            
            resp = {"text": text, "students_count": students_count}
            if not cls_id:
                resp["teachers_count"] = teachers_count
                
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    params={'classroom': cls_id, 'section': sec_id},
                    result_summary=text
                )
                mem, _ = AssistantMemory.objects.get_or_create(school_id=school_id or 0, key='intent_counts')
                data = dict(mem.data or {})
                data[it] = int(data.get(it, 0)) + 1
                mem.data = data
                mem.save(update_fields=['data'])
                try:
                    mem2, _ = AssistantMemory.objects.get_or_create(school_id=school_id or 0, key='cache')
                    cdata = dict(mem2.data or {})
                    import time
                    now = int(time.time())
                    ttl = 900
                    try:
                        cfg, _ = AssistantMemory.objects.get_or_create(school_id=school_id or 0, key='cache_config')
                        cfg_data = dict(cfg.data or {})
                        ttl = int(cfg_data.get('school_counts_ttl', ttl))
                    except Exception:
                        pass
                    cdata[cache_key] = {"value": resp, "ts": now, "ttl": ttl}
                    mem2.data = cdata
                    mem2.save(update_fields=['data'])
                except Exception:
                    pass
            except Exception:
                pass
            return Response(resp)
        try:
            AssistantLog.objects.create(
                user=getattr(request, 'user', None),
                school_id=school_id if school_id else None,
                query_text=q,
                intent='unknown',
                params={'raw': True},
                result_summary="unparsed"
            )
        except Exception:
            pass
        try:
            from users.models import AssistantMemory
            mem, _ = AssistantMemory.objects.get_or_create(school_id=school_id or 0, key='unknown_queries')
            arr = list(mem.data or [])
            arr.append({"q": q})
            if len(arr) > 200:
                arr = arr[-200:]
            mem.data = arr
            mem.save(update_fields=['data'])
        except Exception:
            pass
        return Response({"text": "অনুরোধটি বুঝতে পারিনি। অনুগ্রহ করে ফলাফল, উপস্থিতি বা ফি সম্পর্কিত প্রশ্ন করুন।"}, status=status.HTTP_200_OK)

# ---- Role ViewSets (dev-open) ----
class AdminProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.select_related('user', 'school').filter(role='admin')
    serializer_class = AdminProfileSerializer
    permission_classes = [AdminOrReadOnly]
    filterset_fields = ['school']
    parser_classes = [MultiPartParser, FormParser]
    
    def get_queryset(self):
        queryset = Profile.objects.select_related('user', 'school').filter(role='admin')
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        return queryset

class ParentProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.select_related('user', 'school').filter(role='parent')
    serializer_class = ParentProfileSerializer
    permission_classes = [RolePermission]
    filterset_fields = ['school']
    parser_classes = [MultiPartParser, FormParser]
    
    def get_queryset(self):
        queryset = Profile.objects.select_related('user', 'school').filter(role='parent')
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        return queryset

class CommitteeProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.select_related('user', 'school').filter(role='committee')
    serializer_class = CommitteeProfileSerializer
    permission_classes = [AdminOrReadOnly]
    filterset_fields = ['school']
    parser_classes = [MultiPartParser, FormParser]
    
    def get_queryset(self):
        queryset = Profile.objects.select_related('user', 'school').filter(role='committee')
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        return queryset

class TeacherProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.select_related('user', 'school').filter(role='teacher')
    serializer_class = TeacherProfileSerializer
    permission_classes = [TeacherSelfOrAdminChange]
    filterset_fields = ['school', 'user']
    parser_classes = [MultiPartParser, FormParser]
    
    def get_queryset(self):
        queryset = Profile.objects.select_related('user', 'school').filter(role='teacher')
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        return queryset
    
    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except serializers.ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # Surface clean error instead of 500
            msg = str(e)
            return Response({'detail': msg or 'Unable to create teacher profile'}, status=status.HTTP_400_BAD_REQUEST)

class TaskViewSet(viewsets.ModelViewSet):
    """ViewSet for managing committee tasks"""
    queryset = Task.objects.select_related('assigned_to', 'school', 'created_by').all()
    serializer_class = TaskSerializer
    permission_classes = [AdminOrReadOnly]
    filterset_fields = ['school', 'assigned_to', 'status', 'priority']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by school if provided
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        # Filter by assigned user if provided
        assigned_to = self.request.query_params.get('assigned_to')
        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)
        return queryset


# ---- SMS API Views ----
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_sms_view(request):
    """Send SMS to a single recipient"""
    phone_number = request.data.get('phone_number')
    message = request.data.get('message')
    
    if not phone_number or not message:
        return Response(
            {"error": "phone_number and message are required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    success, result_message = send_sms(phone_number, message)
    
    if success:
        return Response({
            "success": True,
            "message": result_message
        })
    else:
        return Response({
            "success": False,
            "error": result_message
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_bulk_sms_view(request):
    """Send SMS to multiple recipients"""
    phone_numbers = request.data.get('phone_numbers', [])
    message = request.data.get('message')
    
    if not phone_numbers or not message:
        return Response(
            {"error": "phone_numbers (array) and message are required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    results = send_bulk_sms(phone_numbers, message)
    
    success_count = sum(1 for r in results if r['success'])
    fail_count = len(results) - success_count
    
    return Response({
        "success": True,
        "total": len(results),
        "sent": success_count,
        "failed": fail_count,
        "results": results
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_template_sms_view(request):
    """Send SMS using predefined templates"""
    template_name = request.data.get('template')
    template_data = request.data.get('data', {})
    phone_number = request.data.get('phone_number')
    
    if not template_name or not phone_number:
        return Response(
            {"error": "template and phone_number are required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get template message
    templates = {
        'admission': SMSTemplates.admission_confirmation,
        'result': SMSTemplates.result_published,
        'fee_reminder': SMSTemplates.fee_reminder,
        'attendance': SMSTemplates.attendance_alert,
        'exam_schedule': SMSTemplates.exam_schedule,
        'meeting': SMSTemplates.meeting_invitation,
    }
    
    template_func = templates.get(template_name)
    if not template_func:
        return Response(
            {"error": f"Template '{template_name}' not found"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        message = template_func(**template_data)
        success, result_message = send_sms(phone_number, message)
        
        if success:
            return Response({
                "success": True,
                "message": result_message,
                "sms_content": message
            })
        else:
            return Response({
                "success": False,
                "error": result_message
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except TypeError as e:
        return Response({
            "error": f"Invalid template data: {str(e)}"
        }, status=status.HTTP_400_BAD_REQUEST)


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = (request.data.get('username') or request.data.get('email') or '').strip()
        # Always respond with generic message to avoid account enumeration
        resp = {"message": "If the account exists, a reset link will be sent."}
        if not identifier:
            return Response(resp)
        try:
            user = None
            if '@' in identifier:
                user = User.objects.filter(email__iexact=identifier).first()
            if not user:
                user = User.objects.filter(username__iexact=identifier).first()
            if user:
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = PasswordResetTokenGenerator().make_token(user)
                base = getattr(settings, 'SITE_BASE_URL', '').rstrip('/') or 'http://localhost:3000'
                reset_url = f"{base}/reset-password/{uid}/{token}"
                if getattr(settings, 'DEBUG', False):
                    resp['debug_reset_url'] = reset_url
        except Exception:
            pass
        return Response(resp)


class ResetPasswordConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uidb64 = (request.data.get('uid') or request.data.get('uidb64') or '').strip()
        token = (request.data.get('token') or '').strip()
        new_password = (request.data.get('new_password') or '').strip()
        confirm_password = (request.data.get('confirm_password') or '').strip()
        if not uidb64 or not token or not new_password:
            return Response({"success": False, "error": "Invalid request."}, status=status.HTTP_400_BAD_REQUEST)
        if new_password != confirm_password:
            return Response({"success": False, "error": "Passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except Exception:
            return Response({"success": False, "error": "Invalid reset link."}, status=status.HTTP_400_BAD_REQUEST)
        if not PasswordResetTokenGenerator().check_token(user, token):
            return Response({"success": False, "error": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.save()
        return Response({"success": True, "message": "Password has been reset successfully."})


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = (request.data.get('old_password') or '').strip()
        new_password = (request.data.get('new_password') or '').strip()
        confirm_password = (request.data.get('confirm_password') or '').strip()
        if not old_password or not new_password:
            return Response({"success": False, "error": "Old and new password required."}, status=status.HTTP_400_BAD_REQUEST)
        if new_password != confirm_password:
            return Response({"success": False, "error": "Passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)
        if not user.check_password(old_password):
            return Response({"success": False, "error": "Old password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.save()
        return Response({"success": True, "message": "Password changed successfully."})


class ExportSchoolCredentialsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            school_id = int(request.data.get('school') or request.query_params.get('school') or 0)
        except Exception:
            school_id = 0
        confirm_reset = str(request.data.get('reset') or request.query_params.get('reset') or '').lower() in ['1', 'true', 'yes', 'y']
        out_format = str(request.data.get('format') or request.query_params.get('format') or '').lower()
        if not school_id:
            return Response({"success": False, "error": "school is required"}, status=status.HTTP_400_BAD_REQUEST)
        # Authorization: allow superusers OR school admins
        user = request.user
        is_super = getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False)
        is_school_admin = False
        try:
            prof = getattr(user, 'profile', None)
            is_school_admin = prof and prof.role == 'admin' and (prof.school_id == school_id or prof.school_id is None)
        except Exception:
            is_school_admin = False
        if not (is_super or is_school_admin):
            return Response({"success": False, "error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        from .models import Profile
        qs = Profile.objects.select_related('user').filter(school_id=school_id)
        if not qs.exists():
            return Response({"success": False, "error": "No users found for this school"}, status=status.HTTP_404_NOT_FOUND)
        rows = []
        if confirm_reset:
            alphabet = string.ascii_letters + string.digits
        for p in qs:
            u = p.user
            pwd = None
            if confirm_reset:
                pwd = ''.join(secrets.choice(alphabet) for _ in range(10))
                try:
                    u.set_password(pwd)
                    u.save(update_fields=['password'])
                except Exception:
                    continue
            try:
                mobile = getattr(p, 'mobile_number', None) or getattr(p, 'phone_number', None) or getattr(u, 'phone_number', None) or getattr(u, 'mobile_number', None)
            except Exception:
                mobile = None
            try:
                email = getattr(u, 'email', None) or getattr(p, 'email', None)
            except Exception:
                email = None
            rows.append({
                "username": u.username,
                "role": p.role,
                "password": pwd if confirm_reset else None,
                "name": f"{u.first_name} {u.last_name}".strip() or u.username,
                "mobile": mobile or '',
                "email": email or ''
            })
        # If JSON format requested, return structured data (no file)
        if out_format == 'json':
            return Response({"success": True, "count": len(rows), "rows": rows, "reset_applied": bool(confirm_reset)})
        # Build CSV (UTF-8 with BOM) with Bangla headers for better readability in Windows/Excel
        sio = io.StringIO(newline='')
        # Write BOM explicitly to ensure Windows Notepad/Excel detect UTF-8
        sio.write('\ufeff')
        writer = csv.writer(sio)
        writer.writerow(["নাম", "ইউজারনেম", "রোল", "মোবাইল", "ইমেইল", "পাসওয়ার্ড"])
        for r in rows:
            writer.writerow([r.get('name',''), r.get('username',''), r.get('role',''), r.get('mobile',''), r.get('email',''), r.get('password') or ''])
        content = sio.getvalue().encode('utf-8')
        # Save to storage
        ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"exports/credentials_school_{school_id}_{ts}.csv"
        saved_path = default_storage.save(filename, io.BytesIO(content))
        base_url = getattr(settings, 'MEDIA_URL', '/media/')
        url = f"{base_url}{saved_path}"
        site_base = (getattr(settings, 'SITE_BASE_URL', '') or '').rstrip('/')
        if site_base:
            if not url.startswith('/'):
                url = '/' + url
            url = f"{site_base}{url}"
        return Response({"success": True, "count": len(rows), "file_url": url, "reset_applied": bool(confirm_reset)})

class AutoRuleSuggestionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        school_id = request.query_params.get('school')
        try:
            mem_unknown, _ = AssistantMemory.objects.get_or_create(school_id=school_id or 0, key='unknown_queries')
            unknown = list(mem_unknown.data or [])
        except Exception:
            unknown = []
        try:
            mem_syn, _ = AssistantMemory.objects.get_or_create(school_id=school_id or 0, key='synonyms')
            syn = dict(mem_syn.data or {})
            sc = dict(syn.get('school_counts') or {})
        except Exception:
            syn = {}
            sc = {}
        existing_entity = set(sc.get('entity') or [])
        existing_count = set(sc.get('count') or [])
        existing_class = set(sc.get('class') or [])
        existing_period = set(sc.get('period') or [])
        base_entity = {'student','students','স্টুডেন্ট','স্টুডেন্টস','ছাত্র','ছাত্রী','ছাত্রছাত্রী','শিক্ষার্থী','teacher','শিক্ষক'}
        base_count = {'কতজন','কয়জন','কয়জন','মোট','count','সংখ্যা','how many','total','কত','কতো','কতগুলো','কতগুলি','কয়টি','কয়টি'}
        base_class = {'class','ক্লাস','শ্রেণি'}
        base_period = {'monthly','মাসিক','month','মাস'}
        freq_entity = {}
        freq_count = {}
        freq_class = {}
        freq_period = {}
        for item in unknown[-200:]:
            q = (item.get('q') or '').lower()
            for t in base_entity:
                if t in q:
                    freq_entity[t] = freq_entity.get(t, 0) + 1
            for t in base_count:
                if t in q:
                    freq_count[t] = freq_count.get(t, 0) + 1
            for t in base_class:
                if t in q:
                    freq_class[t] = freq_class.get(t, 0) + 1
            for t in base_period:
                if t in q:
                    freq_period[t] = freq_period.get(t, 0) + 1
        suggest_entity = [t for t, c in sorted(freq_entity.items(), key=lambda x: -x[1]) if t not in existing_entity][:10]
        suggest_count = [t for t, c in sorted(freq_count.items(), key=lambda x: -x[1]) if t not in existing_count][:10]
        suggest_class = [t for t, c in sorted(freq_class.items(), key=lambda x: -x[1]) if t not in existing_class][:10]
        suggest_period = [t for t, c in sorted(freq_period.items(), key=lambda x: -x[1]) if t not in existing_period][:10]
        return Response({
            "intent": "school_counts",
            "unknown_total": len(unknown),
            "suggestions": {
                "entity": suggest_entity,
                "count": suggest_count,
                "class": suggest_class,
                "period": suggest_period
            }
        })
    def post(self, request):
        school_id = request.data.get('school') or request.query_params.get('school')
        payload = request.data or {}
        intent_key = (payload.get('intent') or 'school_counts')
        entity = list(payload.get('entity') or [])
        count = list(payload.get('count') or [])
        cls = list(payload.get('class') or [])
        period = list(payload.get('period') or [])
        mem_syn, _ = AssistantMemory.objects.get_or_create(school_id=school_id or 0, key='synonyms')
        syn = dict(mem_syn.data or {})
        sc = dict(syn.get(intent_key) or {})
        sc['entity'] = list(dict.fromkeys(list(sc.get('entity') or []) + entity))
        sc['count'] = list(dict.fromkeys(list(sc.get('count') or []) + count))
        sc['class'] = list(dict.fromkeys(list(sc.get('class') or []) + cls))
        sc['period'] = list(dict.fromkeys(list(sc.get('period') or []) + period))
        syn[intent_key] = sc
        mem_syn.data = syn
        mem_syn.save(update_fields=['data'])
        return Response({"status": "updated", "synonyms": syn.get(intent_key)})
