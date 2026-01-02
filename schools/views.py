from rest_framework import viewsets, permissions
from users.permissions import AdminOrReadOnly
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Count, Sum, Q, IntegerField, F
from django.db.models.functions import Cast
from .models import School
from .serializers import SchoolSerializer
from academics.models import ClassRoom, StudentProfile, TeacherAssignment, Subject
from users.models import Profile, User
from attendance.models import AttendanceRecord
from fees.models import Payment, FeeStructure, StudentFeeAssignment
from datetime import datetime, timedelta

class SchoolViewSet(viewsets.ModelViewSet):
    queryset = School.objects.all()
    serializer_class = SchoolSerializer
    permission_classes = [AdminOrReadOnly]

@api_view(['GET'])
@permission_classes([permissions.AllowAny])  # TEMP: dev-only open access
def dashboard_stats(request):
    """
    Get statistics for dashboard
    """
    # Determine school id from query param; if missing and user is authenticated, fall back to profile
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
    
    for a in assignments:
        # Calculate gross payable
        base = a.custom_amount if a.custom_amount is not None else a.fee_structure.amount
        if a.discount_percentage > 0:
            discount = base * (a.discount_percentage / 100)
            gross = base - discount
        else:
            gross = base
            
        paid = paid_map.get(a.id, 0)
        due = max(0, gross - paid)
        
        if due > 0:
            freq = a.fee_structure.frequency
            # Frontend logic: monthly -> tuition, one_time -> exam, others -> tuition
            is_exam = freq == 'one_time'
            
            if is_exam:
                exam_due_total += due
            else:
                tuition_due_total += due
            
            # Add to class map
            cname = a.student.classroom.name if a.student.classroom else "Unknown"
            if cname not in class_dues_map:
                class_dues_map[cname] = {'tuition_due': 0, 'exam_due': 0, 'total_due': 0}
            
            if is_exam:
                class_dues_map[cname]['exam_due'] += due
            else:
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
        'fee_dues_by_class': fee_dues_by_class,
        'class_distribution': list(class_distribution)
    })
