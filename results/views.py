from rest_framework import viewsets, filters, status, pagination
from rest_framework.decorators import action
from rest_framework.response import Response
from users.permissions import AdminOrReadOnly, RolePermission, SubjectResultWritePermission
from django.http import HttpResponse
from .utils import _class_group, get_subject_maxima, SECTION_MAXIMA
from .models import Examination, Result, StudentOverallResult
from .serializers import ExaminationSerializer, ResultSerializer, StudentOverallResultSerializer
import csv
from decimal import Decimal


class ResultPagination(pagination.PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 500


class ExaminationViewSet(viewsets.ModelViewSet):
    queryset = Examination.objects.select_related('school', 'classroom', 'section').all()
    serializer_class = ExaminationSerializer
    permission_classes = [RolePermission]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']
    
    @action(detail=True, methods=['post'], permission_classes=[SubjectResultWritePermission])
    def bulk_results(self, request, pk=None):
        """Create or update results in bulk for an examination"""
        examination = self.get_object()
        user = request.user
        prof = getattr(user, 'profile', None)
        is_admin = bool(getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False) or (prof and getattr(prof, 'role', None) in ('admin','super_admin')))
        if not is_admin:
            from academics.models import TeacherAssignment
            allow_subjects = set(TeacherAssignment.objects.filter(
                teacher=user,
                classroom_id=examination.classroom_id,
                section_id=examination.section_id
            ).values_list('subject_id', flat=True))
            incoming = request.data.get('results', [])
            for item in incoming:
                sid = item.get('subject_id') or item.get('subject')
                if sid and int(sid) not in allow_subjects:
                    return Response(
                        {"detail": "এই সাবজেক্টে রেজাল্ট ইনপুট দেবার জন্য আপনি অনুমোদিত নন। দয়া করে আপনার প্রতিষ্ঠানের প্রধান শিক্ষক অথবা এ্যাডমিনের সাথে যোগাযোগ করুন।"},
                        status=status.HTTP_403_FORBIDDEN
                    )
        results_data = request.data.get('results', [])
        
        if not results_data:
            return Response(
                {"detail": "No results data provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created = 0
        updated = 0
        errors = []
        
        from academics.models import StudentProfile, Subject
        from django.db import transaction
        
        # Keep writes short to avoid long-held locks on SQLite
        with transaction.atomic():
            for idx, result_item in enumerate(results_data):
                try:
                    student_id = result_item.get('student_id')
                    subject_id = result_item.get('subject_id')
                    
                    if not student_id or not subject_id:
                        errors.append({
                            'index': idx,
                            'error': 'student_id and subject_id are required'
                        })
                        continue
                    
                    try:
                        student = StudentProfile.objects.get(id=student_id)
                        if student.classroom_id != examination.classroom_id:
                            errors.append({
                                'index': idx,
                                'error': f'Student does not belong to class {examination.classroom.name}'
                            })
                            continue
                    except StudentProfile.DoesNotExist:
                        errors.append({
                            'index': idx,
                            'error': f'Student with id {student_id} not found'
                        })
                        continue
                    
                    try:
                        subject = Subject.objects.get(id=subject_id)
                    except Subject.DoesNotExist:
                        errors.append({
                            'index': idx,
                            'error': f'Subject with id {subject_id} not found'
                        })
                        continue
                    
                    result, is_created = Result.objects.update_or_create(
                        examination=examination,
                        student=student,
                        subject=subject,
                        defaults={
                            'written_marks': result_item.get('written_marks', 0),
                            'mcq_marks': result_item.get('mcq_marks', 0),
                            'practical_marks': result_item.get('practical_marks', 0),
                            'remarks': result_item.get('remarks', '')
                        }
                    )
                    
                    if is_created:
                        created += 1
                    else:
                        updated += 1
                except Exception as e:
                    errors.append({
                        'index': idx,
                        'error': str(e)
                    })
        
        # Calculate overall results for affected students outside the atomic block
        affected_students = set()
        for result_item in results_data:
            sid = result_item.get('student_id')
            if sid:
                affected_students.add(sid)
        for sid in affected_students:
            try:
                student = StudentProfile.objects.get(id=sid)
                self._calculate_overall_result(examination, student)
            except Exception as e:
                errors.append({
                    'student_id': sid,
                    'error': f'Failed to calculate overall result: {str(e)}'
                })
        
        return Response({
            'message': 'Bulk result creation completed',
            'created': created,
            'updated': updated,
            'errors': errors
        })

    @action(detail=True, methods=['post'], permission_classes=[RolePermission])
    def recalculate(self, request, pk=None):
        examination = self.get_object()
        qs = Result.objects.filter(examination=examination)
        total = qs.count()
        updated = 0
        for r in qs.iterator():
            try:
                r.save()
                updated += 1
            except Exception:
                pass
        return Response({
            'message': 'Recalculation completed',
            'exam_id': examination.id,
            'processed': total,
            'updated': updated
        })
    
    def _calculate_overall_result(self, examination, student):
        """Calculate and save overall result for a student in an examination"""
        # Get all results for this student in this examination
        student_results = Result.objects.filter(
            examination=examination,
            student=student
        )
        
        if not student_results.exists():
            return
        
        def _subject_total_max(classroom_name, subject_name):
            g = _class_group(classroom_name)
            if not g:
                return None
            m = get_subject_maxima(g, subject_name)
            if not m:
                return None
            return int(m.get("written", 0)) + int(m.get("mcq", 0)) + int(m.get("practical", 0))
        total_obtained = sum(r.total_obtained for r in student_results)
        total_possible_list = []
        for r in student_results:
            tm = _subject_total_max(getattr(r.examination.classroom, "name", None), getattr(r.subject, "name", None))
            if tm and tm > 0:
                total_possible_list.append(Decimal(tm))
            else:
                total_possible_list.append(Decimal(r.examination.total_marks))
        total_possible = sum(total_possible_list)
        percentage = (total_obtained / total_possible * 100) if total_possible > 0 else 0
        
        # Calculate CGPA (average of all subject GPAs)
        cgpa = sum(r.gpa for r in student_results) / student_results.count()
        
        # Determine overall grade based on CGPA
        if cgpa >= 5.0:
            grade = 'A+'
        elif cgpa >= 4.0:
            grade = 'A'
        elif cgpa >= 3.5:
            grade = 'A-'
        elif cgpa >= 3.0:
            grade = 'B'
        elif cgpa >= 2.0:
            grade = 'C'
        elif cgpa >= 1.0:
            grade = 'D'
        else:
            grade = 'F'
        
        # Check if passed (all subjects must be passed)
        is_passed = all(r.is_passed for r in student_results)
        failed_subjects_count = sum(1 for r in student_results if not r.is_passed)
        
        # Create or update overall result
        overall_result, created = StudentOverallResult.objects.update_or_create(
            examination=examination,
            student=student,
            defaults={
                'total_marks_obtained': total_obtained,
                'total_marks_possible': total_possible,
                'percentage': percentage,
                'cgpa': cgpa,
                'grade': grade,
                'is_passed': is_passed,
                'failed_subjects_count': failed_subjects_count
            }
        )
        
        # Calculate ranks for all students in this examination
        self._calculate_ranks(examination)
    
    def _calculate_ranks(self, examination):
        """Calculate and assign ranks to all students in an examination"""
        all_overall = list(StudentOverallResult.objects.filter(examination=examination).select_related('student'))
        rankable = []
        for o in all_overall:
            fail_count = Result.objects.filter(examination=examination, student=o.student, is_passed=False).count()
            rankable.append((fail_count, float(o.cgpa), float(o.percentage), o))
        rankable.sort(key=lambda x: (x[0], -x[1], -x[2]))
        for idx, (_, _, _, o) in enumerate(rankable, start=1):
            o.rank = idx
            o.save(update_fields=['rank'])


class ResultViewSet(viewsets.ModelViewSet):
    queryset = Result.objects.select_related('examination', 'student__user', 'subject').all()
    serializer_class = ResultSerializer
    permission_classes = [SubjectResultWritePermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['student__user__first_name', 'student__user__last_name', 'student__roll_number']
    ordering_fields = ['student', 'subject', 'examination']
    ordering = ['student', 'subject']
    pagination_class = ResultPagination
    
    def get_queryset(self):
        """Filter results by examination and/or student"""
        qs = super().get_queryset()
        
        # Filter by examination if provided
        exam_id = self.request.query_params.get('examination')
        if exam_id:
            qs = qs.filter(examination_id=exam_id)
        
        # Filter by student if provided
        student_id = self.request.query_params.get('student')
        if student_id:
            qs = qs.filter(student_id=student_id)
        
        # Filter by school if provided (via examination's school)
        school_id = self.request.query_params.get('school')
        if school_id:
            qs = qs.filter(examination__school_id=school_id)
        
        return qs
    
    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """Export results to CSV"""
        exam_id = request.query_params.get('examination')
        
        qs = self.filter_queryset(self.get_queryset())
        
        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = 'attachment; filename="results_export.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Serial', 'Roll Number', 'Student Name', 'Subject', 'Written', 'MCQ', 'Practical', 'Total', 'Grade', 'GPA', 'Status'])
        
        for idx, result in enumerate(qs, start=1):
            student = result.student
            student_name = f"{student.user.first_name} {student.user.last_name}".strip() or student.user.username
            status_text = 'Passed' if result.is_passed else 'Failed'
            
            writer.writerow([
                idx,
                student.roll_number or '',
                student_name,
                result.subject.name,
                result.written_marks,
                result.mcq_marks,
                result.practical_marks,
                result.total_obtained,
                result.grade,
                result.gpa,
                status_text
            ])
        
        return response


class StudentOverallResultViewSet(viewsets.ModelViewSet):
    queryset = StudentOverallResult.objects.select_related('examination', 'student__user').all()
    serializer_class = StudentOverallResultSerializer
    permission_classes = [RolePermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['student__user__first_name', 'student__user__last_name']
    ordering_fields = ['cgpa', 'rank', 'percentage']
    ordering = ['-cgpa']
    pagination_class = ResultPagination

    def get_queryset(self):
        qs = super().get_queryset()
        exam_id = self.request.query_params.get('examination')
        if exam_id:
            qs = qs.filter(examination_id=exam_id)
        school_id = self.request.query_params.get('school')
        if school_id:
            qs = qs.filter(examination__school_id=school_id)
        student_id = self.request.query_params.get('student')
        if student_id:
            qs = qs.filter(student_id=student_id)
        return qs.select_related('examination', 'examination__classroom', 'examination__section', 'student__user')
    
    @action(detail=False, methods=['get'])
    def dashboard_result_summary(self, request):
        """
        Get result summary (pass/fail/absent) for dashboard.
        Optimized to avoid N+1 queries.
        """
        school_id = request.query_params.get('school')
        exam_type = request.query_params.get('exam_type')
        year = request.query_params.get('year')
        
        if not school_id or not exam_type:
            return Response(
                {"detail": "school and exam_type are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            year = int(year) if year else None
        except ValueError:
            year = None
        if year is None:
            base_qs = Examination.objects.filter(school_id=school_id, exam_type__iexact=exam_type)
            latest_year = None
            for e in base_qs.values('exam_date', 'name'):
                d = e.get('exam_date')
                if d:
                    y = d.year
                    latest_year = y if latest_year is None or y > latest_year else latest_year
                n = e.get('name') or ''
                import re
                m = re.search(r'(19|20)\d{2}', n)
                if m:
                    y2 = int(m.group(0))
                    latest_year = y2 if latest_year is None or y2 > latest_year else latest_year
            year = latest_year or datetime.now().year

        # 1. Find Examinations
        # Logic matches frontend: filter by type, then check year in date or name
        from django.db.models import Q
        from academics.models import StudentProfile, ClassRoom, Section
        
        exams = Examination.objects.filter(school_id=school_id)
        
        # Filter by exam type (normalized)
        # Note: Frontend normalizeExamType logic is complex. 
        # Here we assume the frontend sends the "normalized" key like 'annual', 'half_yearly'
        # OR we rely on the exact match in DB if the DB stores normalized values.
        # DB choices: half_yearly, annual, test, terminal, model.
        # If frontend sends 'annual', we match 'annual'.
        
        # Refined exam filtering
        exams = exams.filter(exam_type__iexact=exam_type)
        
        # Filter by year (approximate)
        # We check exam_date year OR name containing year
        exams = exams.filter(
            Q(exam_date__year=year) | 
            Q(name__icontains=str(year))
        )
        
        exam_ids = set(exams.values_list('id', flat=True))
        
        # Also need to know pass marks per exam
        exam_pass_marks = {e.id: e.pass_marks for e in exams}
        exam_names = {e.id: e.name.lower() for e in exams}
        
        # 2. Get All Students for the school
        # We need their class/section info
        students = StudentProfile.objects.filter(
            school_id=school_id
        ).select_related('classroom', 'section')
        
        sections_by_classroom = {}
        for s in students:
            cid = s.classroom_id
            sid = s.section_id
            if cid not in sections_by_classroom:
                sections_by_classroom[cid] = set()
            sections_by_classroom[cid].add(sid)
        
        # 3. Get All Results for these exams
        results = Result.objects.filter(
            examination_id__in=exam_ids
        ).select_related('subject', 'examination', 'student')
        
        planned_groups = set()
        for e in exams:
            if e.section_id:
                planned_groups.add((e.classroom_id, e.section_id))
            else:
                for sid in sections_by_classroom.get(e.classroom_id, {None}):
                    planned_groups.add((e.classroom_id, sid))
        
        # 4. Process in memory
        
        # Map: student_id -> list of results
        student_results = {}
        # Track active groups (class_id, section_id) that have at least one result
        active_groups = set()
        
        for r in results:
            sid = r.student_id
            if sid not in student_results:
                student_results[sid] = []
            student_results[sid].append(r)
            
            # Track active group (where results actually exist)
            if r.student:
                active_groups.add((r.student.classroom_id, r.student.section_id))
            
        # Helper for Bangla Combined
        def is_bangla(name):
            n = (name or '').lower()
            return ('bangla' in n or 'বাংলা' in n)
            
        def is_bangla_first(name):
            n = (name or '').lower()
            return is_bangla(n) and ('1st' in n or 'first' in n or '১ম' in n or 'প্রথম' in n)
            
        def is_bangla_second(name):
            n = (name or '').lower()
            return is_bangla(n) and ('2nd' in n or 'second' in n or '২য়' in n or 'দ্বিত' in n)
            
        summary_data = {} # class_section_key -> stats
        
        for student in students:
            if (student.classroom_id, student.section_id) not in planned_groups:
                continue
            if (student.classroom_id, student.section_id) not in active_groups:
                continue

            # Determine Class/Section key
            c_name = student.classroom.name if student.classroom else "Unknown"
            s_name = student.section.name if student.section else "" # Section can be null
            key = f"{c_name} ({s_name})" if s_name else c_name
            
            if key not in summary_data:
                summary_data[key] = {
                    'classLabel': key,
                    'total': 0,
                    'absent': 0,
                    'allPassed': 0,
                    'failBuckets': {}
                }
            
            stats = summary_data[key]
            stats['total'] += 1
            
            s_results = student_results.get(student.id, [])
            
            if not s_results:
                # Only count as absent if at least one student in this class/section has results
                # (This is guaranteed by the loop filter above, but keeping safety check)
                if (student.classroom_id, student.section_id) in active_groups:
                    stats['absent'] += 1
                continue
                
            # Calculate failures
            failed_count = 0
            
            # Check for Class 9/10 Combined Bangla
            is_9_10 = '9' in c_name or '10' in c_name or 'nine' in c_name.lower() or 'ten' in c_name.lower() or 'নবম' in c_name or 'দশম' in c_name
            
            bangla_passed_combined = False
            if is_9_10:
                # Find Bangla 1st and 2nd results
                b_results = [r for r in s_results if is_bangla(r.subject.name if r.subject else "")]
                if b_results:
                    sum_cq = sum(float(r.written_marks) for r in b_results)
                    sum_mcq = sum(float(r.mcq_marks) for r in b_results)
                    # Use pass marks from first bangla exam found or default 33
                    pm = 33
                    for r in b_results:
                        if r.examination_id in exam_pass_marks:
                            pm = exam_pass_marks[r.examination_id]
                            break
                    if sum_cq >= pm and sum_mcq >= pm:
                        bangla_passed_combined = True
            
            for r in s_results:
                # If subject is Bangla and we passed combined, skip check
                subj_name = r.subject.name if r.subject else ""
                if is_9_10 and bangla_passed_combined and is_bangla(subj_name):
                    continue
                    
                if not r.is_passed:
                    failed_count += 1
            
            if failed_count == 0:
                stats['allPassed'] += 1
            else:
                stats['failBuckets'][failed_count] = stats['failBuckets'].get(failed_count, 0) + 1
                
        # Format for frontend
        response_list = []
        for key in sorted(summary_data.keys()):
            data = summary_data[key]
            # Convert failBuckets to map-like object if needed, or keep as dict
            # Frontend expects map or object. JSON will be object.
            response_list.append(data)
            
        return Response(response_list)

    @action(detail=False, methods=['get'])
    def combined_by_exam_type(self, request):
        """Get combined overall result for a student across all examinations of a specific type"""
        student_id = request.query_params.get('student')
        exam_type = request.query_params.get('exam_type')
        classroom_id = request.query_params.get('classroom')
        section_id = request.query_params.get('section')
        
        if not student_id or not exam_type or not classroom_id:
            return Response(
                {"detail": "student, exam_type, and classroom parameters are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from academics.models import StudentProfile
        
        try:
            student = StudentProfile.objects.get(id=student_id)
        except StudentProfile.DoesNotExist:
            return Response(
                {"detail": "Student not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get all examinations of this type for this classroom
        examinations = Examination.objects.filter(
            exam_type=exam_type,
            classroom_id=classroom_id
        )
        
        if not examinations.exists():
            return Response(
                {"detail": "No examinations found for this type and classroom"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get all results for this student across all these examinations
        results = Result.objects.filter(
            examination__in=examinations,
            student=student
        ).select_related('examination', 'subject')
        
        if not results.exists():
            return Response(
                {"detail": "No results found for this student"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Calculate combined totals
        def _class_group(n):
            x = (n or "").lower()
            if "ষষ্ঠ" in x or "six" in x or " 6" in x or x.startswith("6") or "সপ্তম" in x or "seven" in x or " 7" in x or x.startswith("7") or "অষ্টম" in x or "eight" in x or " 8" in x or x.startswith("8"):
                return "six_to_eight"
            if "নবম" in x or "nine" in x or " 9" in x or x.startswith("9") or "দশম" in x or "ten" in x or " 10" in x or x.startswith("10"):
                return "nine_ten"
            return None
        SECTION_MAXIMA = {
            "six_to_eight": {
                "bangla first paper": {"written": 70, "mcq": 30, "practical": 0},
                "বাংলা প্রথম পত্র": {"written": 70, "mcq": 30, "practical": 0},
                "bangla second paper": {"written": 35, "mcq": 15, "practical": 0},
                "বাংলা দ্বিতীয় পত্র": {"written": 35, "mcq": 15, "practical": 0},
                "english first paper": {"written": 100, "mcq": 0, "practical": 0},
                "ইংরেজি প্রথম পত্র": {"written": 100, "mcq": 0, "practical": 0},
                "english second paper": {"written": 50, "mcq": 0, "practical": 0},
                "ইংরেজি দ্বিতীয় পত্র": {"written": 50, "mcq": 0, "practical": 0},
                "mathematics": {"written": 70, "mcq": 30, "practical": 0},
                "গণিত": {"written": 70, "mcq": 30, "practical": 0},
                "science": {"written": 70, "mcq": 30, "practical": 0},
                "বিজ্ঞান": {"written": 70, "mcq": 30, "practical": 0},
                "বাংলাদেশ ও বিশ্বপরিচয়": {"written": 70, "mcq": 30, "practical": 0},
                "বাংলাদেশ ও বিশ্বপরিয়": {"written": 70, "mcq": 30, "practical": 0},
                "ict": {"written": 10, "mcq": 15, "practical": 25},
                "আইসিটি": {"written": 10, "mcq": 15, "practical": 25},
                "ধর্ম": {"written": 70, "mcq": 30, "practical": 0},
                "religion": {"written": 70, "mcq": 30, "practical": 0},
                "কৃষি": {"written": 50, "mcq": 25, "practical": 25},
                "agriculture": {"written": 50, "mcq": 25, "practical": 25},
            },
            "nine_ten": {
                "bangla 1+2": {"written": 140, "mcq": 60, "practical": 0},
                "বাংলা ১+২": {"written": 140, "mcq": 60, "practical": 0},
                "english 1+2": {"written": 200, "mcq": 0, "practical": 0},
                "ইংরেজি ১+২": {"written": 200, "mcq": 0, "practical": 0},
                "mathematics": {"written": 70, "mcq": 30, "practical": 0},
                "গণিত": {"written": 70, "mcq": 30, "practical": 0},
                "science": {"written": 70, "mcq": 30, "practical": 0},
                "বিজ্ঞান": {"written": 70, "mcq": 30, "practical": 0},
                "বাংলাদেশ ও বিশ্বপরিচয়": {"written": 70, "mcq": 30, "practical": 0},
                "বাংলাদেশ ও বিশ্বপরিয়": {"written": 70, "mcq": 30, "practical": 0},
                "ict": {"written": 10, "mcq": 15, "practical": 25},
                "আইসিটি": {"written": 10, "mcq": 15, "practical": 25},
                "ধর্ম": {"written": 70, "mcq": 30, "practical": 0},
                "religion": {"written": 70, "mcq": 30, "practical": 0},
                "কৃষি": {"written": 50, "mcq": 25, "practical": 25},
                "agriculture": {"written": 50, "mcq": 25, "practical": 25},
                "পদার্থ": {"written": 50, "mcq": 25, "practical": 25},
                "রসায়ন": {"written": 50, "mcq": 25, "practical": 25},
                "জীববিজ্ঞান": {"written": 50, "mcq": 25, "practical": 25},
                "উচ্চতর গণিত": {"written": 50, "mcq": 25, "practical": 25},
                "ইতিহাস": {"written": 70, "mcq": 30, "practical": 0},
                "ব্যবসায় উদ্যোগ": {"written": 70, "mcq": 30, "practical": 0},
                "ভূগোল": {"written": 70, "mcq": 30, "practical": 0},
                "ব্যবসায় শিক্ষা": {"written": 70, "mcq": 30, "practical": 0},
                "পৌরনীতি": {"written": 70, "mcq": 30, "practical": 0},
                "ফিন্যান্স": {"written": 70, "mcq": 30, "practical": 0},
            },
        }
        def _subject_total_max(classroom_name, subject_name):
            g = _class_group(classroom_name)
            if not g:
                return None
            s = (subject_name or "").strip().lower()
            m = SECTION_MAXIMA.get(g, {}).get(s)
            if not m:
                return None
            return int(m.get("written", 0)) + int(m.get("mcq", 0)) + int(m.get("practical", 0))
        total_obtained = sum(float(r.total_obtained) for r in results)
        total_possible = 0
        for r in results:
            tm = _subject_total_max(getattr(r.examination.classroom, "name", None), getattr(r.subject, "name", None))
            total_possible += (tm if tm else r.examination.total_marks)
        avg_gpa = sum(float(r.gpa) for r in results) / results.count()
        percentage = (total_obtained / total_possible * 100) if total_possible > 0 else 0
        is_passed = all(r.is_passed for r in results)
        
        # Determine grade based on CGPA
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
        
        # Calculate rank by comparing with other students in the same classroom
        # Get all students in this classroom
        from academics.models import StudentProfile
        all_students = StudentProfile.objects.filter(classroom_id=classroom_id)
        
        # Enforce section-based ranking:
        # If the student belongs to a section, rank is calculated ONLY within that section.
        if student.section_id:
            all_students = all_students.filter(section_id=student.section_id)
        elif section_id:
            all_students = all_students.filter(section_id=section_id)
        
        student_results = []
        for s in all_students:
            s_results = Result.objects.filter(
                examination__in=examinations,
                student=s
            )
            if s_results.exists():
                s_total_obtained = sum(float(r.total_obtained) for r in s_results)
                s_total_possible = 0
                for r in s_results:
                    tm = _subject_total_max(getattr(r.examination.classroom, "name", None), getattr(r.subject, "name", None))
                    s_total_possible += (tm if tm else r.examination.total_marks)
                s_avg_gpa = sum(float(r.gpa) for r in s_results) / s_results.count()
                s_percentage = (s_total_obtained / s_total_possible * 100) if s_total_possible > 0 else 0
                s_fail = sum(1 for r in s_results if not r.is_passed)
                
                student_results.append({
                    'student_id': s.id,
                    'cgpa': s_avg_gpa,
                    'percentage': s_percentage,
                    'fail_count': s_fail
                })
        
        student_results.sort(key=lambda x: (x['fail_count'], -x['cgpa'], -x['percentage']))
        
        # Find rank
        rank = None
        for idx, sr in enumerate(student_results, start=1):
            if sr['student_id'] == student.id:
                rank = idx
                break
        
        return Response({
            'student': student.id,
            'exam_type': exam_type,
            'classroom': classroom_id,
            'total_marks_obtained': round(total_obtained, 2),
            'total_marks_possible': round(total_possible, 2),
            'percentage': round(percentage, 2),
            'cgpa': round(avg_gpa, 2),
            'grade': grade,
            'is_passed': is_passed,
            'rank': rank,
            'total_students': len(student_results)
        })

    @action(detail=False, methods=['get'])
    def combined_rank_list_by_exam_type(self, request):
        exam_type = request.query_params.get('exam_type')
        classroom_id = request.query_params.get('classroom')
        section_id = request.query_params.get('section')

        if not exam_type or not classroom_id:
            return Response(
                {"detail": "exam_type and classroom parameters are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        from academics.models import StudentProfile

        examinations = Examination.objects.filter(
            exam_type=exam_type,
            classroom_id=classroom_id
        )

        if not examinations.exists():
            return Response([], status=status.HTTP_200_OK)

        students = StudentProfile.objects.filter(classroom_id=classroom_id).select_related('user', 'classroom', 'section')
        if section_id:
            students = students.filter(section_id=section_id)

        student_list = list(students)
        if not student_list:
            return Response([], status=status.HTTP_200_OK)

        results = Result.objects.filter(
            examination__in=examinations,
            student__in=student_list
        ).select_related('examination', 'examination__classroom', 'subject', 'student__user', 'student__classroom', 'student__section')

        by_student = {}
        for r in results:
            sid = r.student_id
            if sid not in by_student:
                by_student[sid] = []
            by_student[sid].append(r)

        rows = []
        for st in student_list:
            s_results = by_student.get(st.id) or []
            if not s_results:
                continue

            total_obtained = sum(float(r.total_obtained) for r in s_results)
            total_possible = 0
            for r in s_results:
                tm = None
                try:
                    cg = _class_group(getattr(r.examination.classroom, "name", None))
                    maxima = get_subject_maxima(cg, getattr(r.subject, "name", None))
                    if maxima:
                        tm = int(maxima.get("written", 0)) + int(maxima.get("mcq", 0)) + int(maxima.get("practical", 0))
                except Exception:
                    tm = None
                total_possible += (tm if tm else r.examination.total_marks)

            avg_gpa = sum(float(r.gpa) for r in s_results) / len(s_results)
            percentage = (total_obtained / total_possible * 100) if total_possible > 0 else 0
            is_passed = all(r.is_passed for r in s_results)
            failed_subjects_count = sum(1 for r in s_results if not r.is_passed)

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

            rows.append({
                'student': {
                    'id': st.id,
                    'roll_number': st.roll_number,
                    'group': st.group,
                    'user': {
                        'id': st.user_id,
                        'username': getattr(st.user, 'username', ''),
                        'first_name': getattr(st.user, 'first_name', ''),
                        'last_name': getattr(st.user, 'last_name', '')
                    },
                    'classroom': {'id': st.classroom_id, 'name': st.classroom.name if st.classroom else None},
                    'section': {'id': st.section_id, 'name': st.section.name if st.section else None},
                },
                'exam_type': exam_type,
                'classroom': classroom_id,
                'total_marks_obtained': round(total_obtained, 2),
                'total_marks_possible': round(total_possible, 2),
                'percentage': round(percentage, 2),
                'cgpa': round(avg_gpa, 2),
                'grade': grade,
                'is_passed': is_passed,
                'failed_subjects_count': failed_subjects_count,
            })

        rows.sort(key=lambda x: (x.get('failed_subjects_count', 0), -(float(x.get('cgpa') or 0)), -(float(x.get('percentage') or 0))))
        for idx, row in enumerate(rows, start=1):
            row['rank'] = idx

        return Response(rows)
    
    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """Export overall results to CSV"""
        qs = self.filter_queryset(self.get_queryset())
        
        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = 'attachment; filename="overall_results_export.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Rank', 'Roll Number', 'Student Name', 'Total Obtained', 'Total Possible', 'Percentage', 'CGPA', 'Grade', 'Status'])
        
        for result in qs:
            student = result.student
            student_name = f"{student.user.first_name} {student.user.last_name}".strip() or student.user.username
            status_text = 'Passed' if result.is_passed else 'Failed'
            
            writer.writerow([
                result.rank or '',
                student.roll_number or '',
                student_name,
                result.total_marks_obtained,
                result.total_marks_possible,
                result.percentage,
                result.cgpa,
                result.grade,
                status_text
            ])
        
        return response
