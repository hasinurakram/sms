from rest_framework import generics, permissions, status, viewsets
from users.permissions import AdminOrReadOnly, RolePermission
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
            return Response({
                "user": UserSerializer(user, context={'request': request}).data,
                "profile": ProfileSerializer(profile).data
            })
        except Profile.DoesNotExist:
            return Response({
                "user": UserSerializer(user, context={'request': request}).data,
                "message": "Profile does not exist"
            }, status=status.HTTP_404_NOT_FOUND)
    
    def patch(self, request):
        """Update user photo"""
        user = request.user
        
        if 'photo' in request.FILES:
            user.photo = request.FILES['photo']
            user.save()
            return Response({
                "message": "Photo uploaded successfully",
                "user": UserSerializer(user, context={'request': request}).data
            })
        
        return Response({"error": "No photo provided"}, status=status.HTTP_400_BAD_REQUEST)
        


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
                words_to_num = {
                    'one': '1','two': '2','three': '3','four': '4','five': '5','six': '6','seven': '7','eight': '8','nine': '9','ten': '10',
                    'সিক্স': '6','সেভেন': '7','এইট': '8','নাইন': '9','টেন': '10',
                    'ষষ্ঠ': '6','সপ্তম': '7','অষ্টম': '8','নবম': '9','দশম': '10'
                }
                for w, n in words_to_num.items():
                    if w in ql:
                        num = n
                        break
            from academics.models import ClassRoom
            if school_id:
                qs = ClassRoom.objects.filter(school_id=school_id)
            else:
                qs = ClassRoom.objects.all()
            if num:
                cls = qs.filter(name__icontains=num).order_by('id').first()
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
            bn_map = {'ক': 'A', 'খ': 'B', 'গ': 'C', 'ঘ': 'D', 'ঙ': 'E', 'চ': 'F', 'ছ': 'G', 'জ': 'H'}
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
            if any(w in ql for w in ['attendance', 'এটেনড্যান্স', 'উপস্থিতি']):
                if any(w in ql for w in ['monthly', 'মাসিক', 'month', 'মাস']):
                    return 'attendance_monthly'
                return 'attendance_daily'
            if any(w in ql for w in ['fee', 'fees', 'ফি', 'বেতন', 'collection', 'কালেকশন']):
                return 'fees_collection'
            if any(w in ql for w in ['বকেয়া', 'বাকি', 'due', 'বেতন']) or ('fee' in ql and 'due' in ql):
                return 'fees_due'
            if (any(w in ql for w in ['student', 'ছাত্র', 'ছাত্রী', 'শিক্ষার্থী']) or any(w in ql for w in ['teacher', 'শিক্ষক'])) and any(w in ql for w in ['কতজন', 'মোট', 'count', 'সংখ্যা']):
                return 'school_counts'
            if any(w in ql for w in ['roll', 'রোল', 'রোল নাম্বার', 'রোল নম্বর', 'roll number']):
                return 'student_result'
            topper_words = ['১ম', 'প্রথম', 'first', 'topper', 'টপার', 'rank 1', 'র‌্যাংক', 'র‍্যাঙ্ক', 'top']
            if any(w in ql for w in topper_words):
                return 'results_topper'
            if any(w in ql for w in ['result', 'রেজাল্ট', 'পরীক্ষা', 'exam', 'examination']):
                return 'results'
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
            if not et or not cls_id:
                return Response({"error": "exam_type এবং classroom প্রয়োজন"}, status=status.HTTP_400_BAD_REQUEST)
            from results.models import Examination, Result
            exams = Examination.objects.filter(exam_type=et, classroom_id=cls_id)
            if sec_id:
                exams = exams.filter(section_id=sec_id)
            if school_id:
                exams = exams.filter(school_id=school_id)
            if not exams.exists():
                text = f"এই শর্তে কোনো পরীক্ষা পাওয়া যায়নি।"
                try:
                    AssistantLog.objects.create(
                        user=getattr(request, 'user', None),
                        school_id=school_id if school_id else None,
                        query_text=q,
                        intent=it,
                        params={'exam_type': et, 'classroom': cls_id, 'section': sec_id},
                        result_summary=text
                    )
                except Exception:
                    pass
                return Response({"text": text, "rows": []})
            rs = Result.objects.filter(examination__in=list(exams))
            if school_id:
                rs = rs.filter(student__school_id=school_id)
            if sec_id:
                rs = rs.filter(student__section_id=sec_id)
            if cls_id:
                rs = rs.filter(student__classroom_id=cls_id)
            student_count = rs.values_list('student_id', flat=True).distinct().count()
            cls_disp = cls_name or cls_id
            et_disp = bn_exam_label(et)
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
                    params={'exam_type': et, 'classroom': cls_id, 'section': sec_id},
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
            students_count = StudentProfile.objects.filter(school_id=school_id).count()
            teachers_count = Profile.objects.filter(school_id=school_id, role='teacher').count()
            text = f"এই স্কুলে মোট {students_count} জন শিক্ষার্থী ও {teachers_count} জন শিক্ষক রয়েছে।"
            resp = {"text": text, "students_count": students_count, "teachers_count": teachers_count}
            try:
                AssistantLog.objects.create(
                    user=getattr(request, 'user', None),
                    school_id=school_id if school_id else None,
                    query_text=q,
                    intent=it,
                    params={},
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
    permission_classes = [AdminOrReadOnly]
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
    permission_classes = [AdminOrReadOnly]
    filterset_fields = ['school', 'user']
    parser_classes = [MultiPartParser, FormParser]
    
    def get_queryset(self):
        queryset = Profile.objects.select_related('user', 'school').filter(role='teacher')
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)
        return queryset

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
