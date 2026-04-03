from rest_framework import viewsets, permissions, status
from users.permissions import AdminOrReadOnly
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.views.decorators.cache import cache_page
from django.db.models import Count, Sum, Q, IntegerField, F
from django.db.models.functions import Cast
from .models import School, Advertisement
from .serializers import SchoolSerializer, AdvertisementSerializer
from academics.models import ClassRoom, StudentProfile, TeacherAssignment, Subject
from users.models import Profile, User
from attendance.models import AttendanceRecord
from fees.models import Payment, FeeStructure, StudentFeeAssignment
from datetime import datetime, timedelta
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

class SchoolViewSet(viewsets.ModelViewSet):
    queryset = School.objects.all()
    serializer_class = SchoolSerializer
    permission_classes = [AdminOrReadOnly]

class AdvertisementViewSet(viewsets.ModelViewSet):
    queryset = Advertisement.objects.select_related('school').all()
    serializer_class = AdvertisementSerializer
    permission_classes = [permissions.AllowAny]  # Adjust as needed
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        school_id = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        if school_id:
            try:
                qs = qs.filter(school_id=int(school_id))
            except Exception:
                pass
        return qs

class AdvertisementBySchool(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, school_id):
        ads = Advertisement.objects.filter(school_id=school_id).order_by('-created_at', '-id')
        serializer = AdvertisementSerializer(ads, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, school_id):
        data = request.data.copy()
        data['school'] = school_id
        serializer = AdvertisementSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AdvertisementBulk(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [JSONParser]

    def put(self, request, *args, **kwargs):
        items = request.data.get('ads') or []
        created = []
        for item in items:
            try:
                school_id = item.get('school')
                if not school_id:
                    continue
                payload = {
                    'school': school_id,
                    'text': item.get('text', ''),
                    'link': item.get('link', ''),
                    'type': (item.get('type') or 'image').lower()
                }
                # Handle media data URL if provided
                media_data_url = item.get('media_data_url')
                if media_data_url:
                    import re, base64
                    from django.core.files.base import ContentFile
                    m = re.match(r'^data:(.+);base64,(.*)$', media_data_url)
                    if m:
                        mime = m.group(1)
                        b64 = m.group(2)
                        ext = (mime.split('/')[-1] or 'bin')
                        payload['media'] = ContentFile(base64.b64decode(b64), name=f"ad_{school_id}_{payload['type']}.{ext}")
                ser = AdvertisementSerializer(data=payload, context={'request': request})
                if ser.is_valid():
                    ser.save()
                    created.append(ser.data)
            except Exception:
                continue
        return Response({'created': created}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@cache_page(60 * 15) # Cache for 15 minutes
def dashboard_stats(request):
    """Returns key stats for the school dashboard."""
    # Try to get school from user profile first
    school_id = request.query_params.get('school_id')
    if school_id is not None:
        try:
            school_id = int(school_id)
        except ValueError:
            return Response({"error": "Invalid school_id"}, status=400)
    elif request.user and request.user.is_authenticated:
        user_profile = Profile.objects.select_related('school').filter(user=request.user).first()
        if user_profile and user_profile.school:
            school_id = user_profile.school.id
    # If still no school_id, error out
    if not school_id:
        return Response({"error": "No school specified"}, status=400)

    # Validate school exists
    try:
        school_obj = School.objects.get(id=school_id)
    except School.DoesNotExist:
        return Response({"error": "School not found"}, status=404)
    
    # Get counts
    students_count = StudentProfile.objects.filter(school_id=school_id).count()
    teachers_count = Profile.objects.filter(school_id=school_id, role='teacher').count()
    parents_count = Profile.objects.filter(school_id=school_id, role='parent').count()
    classes_count = ClassRoom.objects.filter(school_id=school_id).count()
    subjects_count = Subject.objects.filter(school_id=school_id).count()
    
    # Recent attendance stats (last 7 days)
    today = datetime.now().date()
    week_ago = today - timedelta(days=7)
    attendance_qs = AttendanceRecord.objects.filter(
        school_id=school_id,
        date__gte=week_ago
    )
    
    attendance_data = (
        attendance_qs
        .values('date')
        .annotate(
            present=Sum(Cast('present', IntegerField())),
            total=Count('id'),
        )
        .annotate(
            absent=F('total') - F('present')
        )
        .values('date', 'present', 'absent')
        .order_by('date')
    )
    
    # Today's absent breakdown by class
    today_records = AttendanceRecord.objects.filter(
        school_id=school_id, 
        date=today
    ).values('student__classroom__name', 'present')
    
    absent_map = {}
    for r in today_records:
        if not r['present']:
            cname = r['student__classroom__name'] or 'Unknown'
            absent_map[cname] = absent_map.get(cname, 0) + 1
            
    attendance_absent_by_class_today = sorted(
        [{'class_name': k, 'absent': v} for k, v in absent_map.items()],
        key=lambda x: x['class_name']
    )
    
    # Recent fee collections (last 30 days)
    month_ago = today - timedelta(days=30)
    fee_data_qs = Payment.objects.filter(
        student__school_id=school_id,
        payment_date__gte=month_ago
    ).values('payment_date').annotate(
        amount=Sum('amount')
    ).order_by('payment_date')
    
    fee_collection = [{'date': x['payment_date'], 'amount': x['amount']} for x in fee_data_qs]
    
    # Fee Dues Calculation
    # Fetch all active assignments and related data
    assignments = StudentFeeAssignment.objects.filter(
        student__school_id=school_id, 
        is_waived=False
    ).select_related('fee_structure', 'student__classroom')
    
    # Fetch all payments grouped by assignment
    payments = Payment.objects.filter(
        student__school_id=school_id,
        fee_assignment__isnull=False
    ).values('fee_assignment_id').annotate(paid=Sum('amount'))
    
    paid_map = {p['fee_assignment_id']: p['paid'] for p in payments}
    
    tuition_due_total = 0
    exam_due_total = 0
    class_dues_map = {} # {class_name: {tuition_due, exam_due, total_due}}

    # Precompute monthly payment totals per (student, classroom, target_year) group
    monthly_group_assignments = {}
    try:
        for a in assignments:
            try:
                freq = (a.fee_structure.frequency or '').lower()
            except Exception:
                freq = ''
            if freq != 'monthly':
                continue
            if not _is_tuition_in_scope(a):
                continue
            try:
                sid = getattr(getattr(a, 'student', None), 'id', None) or getattr(a, 'student_id', None)
            except Exception:
                sid = None
            try:
                cls = getattr(getattr(a.fee_structure, 'classroom', None), 'id', None) or getattr(a.fee_structure, 'classroom_id', None) or getattr(getattr(a.student, 'classroom', None), 'id', None)
            except Exception:
                cls = None
            gkey = (sid, cls, target_year)
            monthly_group_assignments.setdefault(gkey, []).append(a.id)
    except Exception:
        monthly_group_assignments = {}
    paid_group_map = {}
    try:
        for gkey, ids in monthly_group_assignments.items():
            paid_group_map[gkey] = sum(float(paid_map.get(i, 0) or 0) for i in ids)
    except Exception:
        paid_group_map = {}
    
    # Determine target year (query param or current year)
    try:
        year_param = request.query_params.get('year')
        target_year = int(year_param) if year_param is not None else datetime.now().year
    except Exception:
        target_year = datetime.now().year
    cutoff_date = datetime(target_year, 1, 1).date()
    def _is_target_year(assign):
        # 1) Assigned date in current year
        try:
            if assign.assigned_date and assign.assigned_date.year == target_year:
                return True
        except Exception:
            pass
        # 2) Fee structure academic year equals current year (handles string/bangla digits)
        try:
            ay_raw = getattr(assign.fee_structure, 'academic_year', '') or ''
            ay = str(ay_raw).strip()
            import re
            m = re.search(r'(19|20)\d{2}', ay)
            if m and int(m.group(0)) == target_year:
                return True
            if ay.isdigit() and int(ay) == target_year:
                return True
        except Exception:
            pass
        return False
    
    def _is_tuition_in_scope(assign):
        try:
            freq = (assign.fee_structure.frequency or '').lower()
        except Exception:
            freq = ''
        if freq == 'one_time':
            return False
        # Include tuition if assignment is not in the future relative to target year
        try:
            if assign.assigned_date and assign.assigned_date.year <= target_year:
                return True
        except Exception:
            pass
        # If academic_year is available, include when it is <= target year
        try:
            ay_raw = getattr(assign.fee_structure, 'academic_year', '') or ''
            ay = str(ay_raw).strip()
            import re
            m = re.search(r'(19|20)\d{2}', ay)
            if m and int(m.group(0)) <= target_year:
                return True
            if ay.isdigit() and int(ay) <= target_year:
                return True
        except Exception:
            pass
        # Default: include tuition when year cannot be determined (to avoid missing active dues)
        return True
    
    def _safe_float(val):
        try:
            if val is None: return 0.0
            v = float(val)
            if v != v: return 0.0  # NaN check
            return v
        except Exception:
            return 0.0
    
    def _select_base_amount(assign):
        try:
            fee = getattr(assign, 'fee_structure', None)
            candidates = [
                getattr(assign, 'custom_amount', None),
                getattr(assign, 'amount', None),
                getattr(assign, 'total_amount', None),
                getattr(assign, 'payable_amount', None),
                getattr(assign, 'original_amount', None),
                getattr(fee, 'amount', None),
                getattr(fee, 'default_amount', None),
            ]
            for c in candidates:
                v = _safe_float(c)
                if v > 0:
                    return v
            return _safe_float(getattr(fee, 'amount', None))
        except Exception:
            return 0.0
    
    def _months_in_scope(assign):
        now = datetime.now()
        current_year = now.year
        current_month = now.month
        if target_year > current_year:
            return 0
        end_month = 12 if target_year < current_year else current_month
        try:
            if assign.assigned_date:
                if assign.assigned_date.year > target_year:
                    return 0
                start_month = assign.assigned_date.month if assign.assigned_date.year == target_year else 1
            else:
                start_month = 1
        except Exception:
            start_month = 1
        m = max(0, end_month - start_month + 1)
        return min(m, 12)
    
    seen_monthly_groups = set()
    for a in assignments:
        try:
            freq = (a.fee_structure.frequency or '').lower()
        except Exception:
            freq = ''
        base = _select_base_amount(a)
        discount_pct = _safe_float(getattr(a, 'discount_percentage', 0))
        discount_amt = _safe_float(getattr(a, 'discount_amount', 0))
        monthly_net = max(0.0, base - discount_amt - (base * (discount_pct / 100.0)))
        if freq == 'monthly':
            if not _is_tuition_in_scope(a):
                gross = 0.0
            else:
                try:
                    sid = getattr(getattr(a, 'student', None), 'id', None) or getattr(a, 'student_id', None)
                except Exception:
                    sid = None
                try:
                    cls = getattr(getattr(a.fee_structure, 'classroom', None), 'id', None) or getattr(a.fee_structure, 'classroom_id', None) or getattr(getattr(a.student, 'classroom', None), 'id', None)
                except Exception:
                    cls = None
                gkey = (sid, cls, target_year)
                if gkey in seen_monthly_groups:
                    gross = 0.0
                    paid = 0.0
                else:
                    months = int(_months_in_scope(a))
                    gross = monthly_net * max(0, months)
                    seen_monthly_groups.add(gkey)
                    paid = _safe_float(paid_group_map.get(gkey, 0))
        else:
            gross = monthly_net
        if freq != 'monthly':
            paid = _safe_float(paid_map.get(a.id, 0))
        due = max(0.0, gross - paid)
        
        if due > 0:
            freq = a.fee_structure.frequency
            # Frontend logic: monthly -> tuition, one_time -> exam, others -> tuition
            is_exam = freq == 'one_time'
            
            # Only count dues for target academic year and apply exam scheduling rules
            if is_exam:
                import re
                # Year gating
                now = datetime.now()
                current_year = now.year
                current_month = now.month
                if not _is_target_year(a):
                    continue
                # Identify exam type
                nm = str(getattr(a.fee_structure, 'name', '') or '').lower()
                cat = str(getattr(a.fee_structure, 'category', '') or '').lower()
                text = f"{nm} {cat}"
                is_half = bool(re.search(r'half|mid|অর্ধ', text))
                is_annual = bool(re.search(r'annual|final|বার্ষিক', text))
                # Due date (optional, for other exam types)
                dd = getattr(a.fee_structure, 'due_date', None) or getattr(a, 'due_date', None)
                include_exam = False
                if target_year < current_year:
                    include_exam = True
                elif target_year > current_year:
                    include_exam = False
                else:
                    if is_half:
                        include_exam = current_month >= 5
                    elif is_annual:
                        include_exam = current_month >= 9
                    else:
                        # For other exams, require due_date in target year and due month not in the future
                        if dd and hasattr(dd, 'year') and dd.year == target_year:
                            include_exam = dd.month <= current_month
                        else:
                            include_exam = False
                if not include_exam:
                    continue
                exam_due_total += due
            else:
                if not _is_tuition_in_scope(a):
                    continue
                tuition_due_total += due
            
            # Add to class map
            cname = a.student.classroom.name if a.student.classroom else "Unknown"
            if cname not in class_dues_map:
                class_dues_map[cname] = {'tuition_due': 0, 'exam_due': 0, 'total_due': 0}
            
            if is_exam:
                if _is_target_year(a):
                    # Same include logic as above
                    import re
                    nm2 = str(getattr(a.fee_structure, 'name', '') or '').lower()
                    cat2 = str(getattr(a.fee_structure, 'category', '') or '').lower()
                    text2 = f"{nm2} {cat2}"
                    is_half2 = bool(re.search(r'half|mid|অর্ধ', text2))
                    is_annual2 = bool(re.search(r'annual|final|বার্ষিক', text2))
                    dd2 = getattr(a.fee_structure, 'due_date', None) or getattr(a, 'due_date', None)
                    now2 = datetime.now()
                    cy = now2.year
                    cm = now2.month
                    if target_year < cy:
                        class_dues_map[cname]['exam_due'] += due
                    elif target_year > cy:
                        pass
                    else:
                        if (is_half2 and cm >= 5) or (is_annual2 and cm >= 9):
                            class_dues_map[cname]['exam_due'] += due
                        else:
                            if dd2 and hasattr(dd2, 'year') and dd2.year == target_year and dd2.month <= cm:
                                class_dues_map[cname]['exam_due'] += due
                            else:
                                pass
            else:
                if _is_tuition_in_scope(a):
                    class_dues_map[cname]['tuition_due'] += due
            
            class_dues_map[cname]['total_due'] += due

    fee_dues_summary = {
        'tuition_due_total': tuition_due_total,
        'exam_due_total': exam_due_total,
        'total_due': tuition_due_total + exam_due_total
    }
    
    fee_dues_by_class = sorted(
        [{'class_name': k, **v} for k, v in class_dues_map.items()],
        key=lambda x: x['class_name']
    )
    
    # Class distribution
    class_distribution = StudentProfile.objects.filter(
        school_id=school_id
    ).values('classroom__name').annotate(
        count=Count('id')
    ).order_by('classroom__name')
    
    return Response({
        'school_id': school_id,
        'school_name': school_obj.name,
        'students_count': students_count,
        'teachers_count': teachers_count,
        'parents_count': parents_count,
        'classes_count': classes_count,
        'subjects_count': subjects_count,
        'attendance_data': list(attendance_data),
        'attendance_absent_by_class_today': attendance_absent_by_class_today,
        'fee_collection': fee_collection, # New format
        'fee_data': list(fee_data_qs),    # Keep old format for backward compat if needed
        'fee_dues_summary': fee_dues_summary,
        'dues_year': target_year,
        'fee_dues_by_class': fee_dues_by_class,
        'class_distribution': list(class_distribution)
    })
