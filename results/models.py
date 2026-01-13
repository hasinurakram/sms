from django.db import models
from django.conf import settings
from schools.models import School
from academics.models import ClassRoom, Section, Subject, StudentProfile
from decimal import Decimal
from .utils import _round_half_up, _class_group, get_subject_maxima

User = settings.AUTH_USER_MODEL


class Examination(models.Model):
    """Exam/Test definition"""
    EXAM_TYPES = [
        ('half_yearly', 'Half Yearly'),
        ('annual', 'Annual'),
        ('test', 'Class Test'),
        ('terminal', 'Terminal'),
        ('model', 'Model Test'),
    ]
    
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='examinations')
    name = models.CharField(max_length=200)
    exam_type = models.CharField(max_length=20, choices=EXAM_TYPES, default='test')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='examinations')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='examinations')
    exam_date = models.DateField(null=True, blank=True)
    total_marks = models.IntegerField(default=100)
    pass_marks = models.IntegerField(default=33)
    written_max = models.IntegerField(null=True, blank=True)
    mcq_max = models.IntegerField(null=True, blank=True)
    practical_max = models.IntegerField(null=True, blank=True)
    
    class Meta:
        ordering = ['-exam_date', 'name']
        indexes = [
            models.Index(fields=['school', 'classroom']),
            models.Index(fields=['exam_date']),
        ]
    
    def __str__(self):
        return f"{self.name} - {self.classroom.name}"


class Result(models.Model):
    """Individual student result for a subject in an exam"""
    GRADE_CHOICES = [
        ('A+', 'A+ (80-100)'),
        ('A', 'A (70-79)'),
        ('A-', 'A- (60-69)'),
        ('B', 'B (50-59)'),
        ('C', 'C (40-49)'),
        ('D', 'D (33-39)'),
        ('F', 'F (0-32)'),
    ]
    
    examination = models.ForeignKey(Examination, on_delete=models.CASCADE, related_name='results')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='results')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='results')
    
    # Marks breakdown
    written_marks = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    mcq_marks = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    practical_marks = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    total_obtained = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Auto-calculated
    grade = models.CharField(max_length=5, blank=True)
    gpa = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    is_passed = models.BooleanField(default=False)
    
    # Optional
    remarks = models.TextField(blank=True)
    
    class Meta:
        unique_together = ('examination', 'student', 'subject')
        ordering = ['examination', 'student', 'subject']
        indexes = [
            models.Index(fields=['examination', 'student']),
            models.Index(fields=['student']),
        ]
    
    def save(self, *args, **kwargs):
        self.total_obtained = self.written_marks + self.mcq_marks + self.practical_marks
        
        group = _class_group(getattr(self.examination.classroom, "name", None))
        maxima = get_subject_maxima(group, getattr(self.subject, "name", None)) or {}
        
        # Override with exam-level maxima when provided
        ex_w = getattr(self.examination, "written_max", None)
        ex_m = getattr(self.examination, "mcq_max", None)
        ex_p = getattr(self.examination, "practical_max", None)
        wm = int(ex_w) if isinstance(ex_w, int) or (isinstance(ex_w, (str, float)) and str(ex_w).strip()) else int(maxima.get("written", 0))
        mm = int(ex_m) if isinstance(ex_m, int) or (isinstance(ex_m, (str, float)) and str(ex_m).strip()) else int(maxima.get("mcq", 0))
        pm = int(ex_p) if isinstance(ex_p, int) or (isinstance(ex_p, (str, float)) and str(ex_p).strip()) else int(maxima.get("practical", 0))
        denom = Decimal(wm + mm + pm) if (wm or mm or pm) else Decimal(self.examination.total_marks)
        percentage = (self.total_obtained / denom) * 100 if denom > 0 else 0
        
        if percentage >= 80:
            self.grade = 'A+'
            self.gpa = 5.00
        elif percentage >= 70:
            self.grade = 'A'
            self.gpa = 4.00
        elif percentage >= 60:
            self.grade = 'A-'
            self.gpa = 3.50
        elif percentage >= 50:
            self.grade = 'B'
            self.gpa = 3.00
        elif percentage >= 40:
            self.grade = 'C'
            self.gpa = 2.00
        elif percentage >= 33:
            self.grade = 'D'
            self.gpa = 1.00
        else:
            self.grade = 'F'
            self.gpa = 0.00
        # Original pass/fail calculation logic
        if (wm or mm or pm):
            req_written = (wm or 0) > 0
            req_mcq = (mm or 0) > 0
            req_practical = (pm or 0) > 0
            
            # Calculate 1/3 thresholds for each component
            thr_w = Decimal(_round_half_up(Decimal(wm) / Decimal(3))) if req_written else Decimal(0)
            thr_m = Decimal(_round_half_up(Decimal(mm) / Decimal(3))) if req_mcq else Decimal(0)
            thr_p = Decimal(_round_half_up(Decimal(pm) / Decimal(3))) if req_practical else Decimal(0)
            
            # Check if student meets component-wise passing criteria
            ok_w = (self.written_marks >= thr_w) if req_written else True
            ok_m = (self.mcq_marks >= thr_m) if req_mcq else True
            ok_p = (self.practical_marks >= thr_p) if req_practical else True
            
            # Student must pass all component-wise criteria
            self.is_passed = bool(ok_w and ok_m and ok_p)
        else:
            # If no component marks, just check total marks
            threshold = Decimal(self.examination.pass_marks or 0)
            if threshold <= 0 or threshold > denom:
                threshold = Decimal(_round_half_up(denom / Decimal(3)))
            self.is_passed = self.total_obtained >= threshold
        
        if not self.is_passed:
            self.grade = 'F'
            self.gpa = 0.00
        else:
            if self.grade == 'F':
                self.grade = 'D'
                self.gpa = 1.00
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.student.user.get_full_name()} - {self.subject.name} - {self.grade}"


class StudentOverallResult(models.Model):
    """Overall result summary for a student in an exam"""
    examination = models.ForeignKey(Examination, on_delete=models.CASCADE, related_name='overall_results')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='overall_results')
    
    total_marks_obtained = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    total_marks_possible = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    cgpa = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    grade = models.CharField(max_length=5, blank=True)
    
    rank = models.IntegerField(null=True, blank=True)
    is_passed = models.BooleanField(default=False)
    failed_subjects_count = models.IntegerField(default=0)
    
    class Meta:
        unique_together = ('examination', 'student')
        ordering = ['-cgpa', 'student']
        indexes = [
            models.Index(fields=['examination', '-cgpa']),
        ]
    
    def __str__(self):
        return f"{self.student.user.get_full_name()} - CGPA: {self.cgpa}"
