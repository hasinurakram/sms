from django.db import models
from django.conf import settings
from schools.models import School

# Use the project's custom user model
User = settings.AUTH_USER_MODEL

class ClassRoom(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='classrooms')
    name = models.CharField(max_length=100)  # e.g., Grade 1
    description = models.TextField(blank=True, null=True)
    class Meta:
        unique_together = ('school', 'name')
        ordering = ['name']
        indexes = [
            models.Index(fields=['school', 'name']),
            models.Index(fields=['school']),
        ]

    def __str__(self):
        return f"{self.school.name} - {self.name}"

class Section(models.Model):
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='sections')
    name = models.CharField(max_length=50)  # e.g., A, B

    class Meta:
        unique_together = ('classroom', 'name')

    def __str__(self):
        return f"{self.classroom.name} - {self.name}"

class Subject(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='subjects')
    classrooms = models.ManyToManyField(ClassRoom, related_name='subjects', blank=True)
    sections = models.ManyToManyField(Section, related_name='subjects', blank=True)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        unique_together = ('school', 'name')
        indexes = [
            models.Index(fields=['school', 'name']),
            models.Index(fields=['school']),
        ]

    def __str__(self):
        return self.name

class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='students')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    roll_number = models.CharField(max_length=50, blank=True, null=True)
    group = models.CharField(max_length=20, blank=True, null=True, choices=[
        ('science', 'Science'),
        ('arts', 'Arts'),
        ('commerce', 'Commerce'),
    ])
    blood_group = models.CharField(max_length=10, choices=[
        ('A+', 'A+'),
        ('A-', 'A-'),
        ('B+', 'B+'),
        ('B-', 'B-'),
        ('AB+', 'AB+'),
        ('AB-', 'AB-'),
        ('O+', 'O+'),
        ('O-', 'O-'),
    ], blank=True, null=True)
    gender = models.CharField(max_length=10, choices=[
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ], blank=True, null=True)
    # Parent linkage
    guardian_name = models.CharField(max_length=255, blank=True, null=True)
    guardian = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='children')

    def __str__(self):
        # user may be AbstractUser
        try:
            name = self.user.get_full_name() or self.user.username
        except:
            name = str(self.user)
        return f"{name} ({self.school.name})"

    class Meta:
        indexes = [
            models.Index(fields=['school']),
            models.Index(fields=['classroom']),
            models.Index(fields=['section']),
            models.Index(fields=['school', 'classroom']),
        ]
        ordering = ['roll_number']

class TeacherAssignment(models.Model):
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assignments')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='assignments')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='assignments')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='assignments')

    class Meta:
        unique_together = ('teacher', 'subject', 'classroom', 'section')

    def __str__(self):
        return f"{self.teacher} - {self.subject.name} - {self.classroom.name}"

class StudentYearRecord(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='student_year_records')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='year_records')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.SET_NULL, null=True, blank=True, related_name='year_records')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='year_records')
    roll_number = models.CharField(max_length=50, blank=True, null=True)
    academic_year = models.CharField(max_length=9)  # e.g., "2025" or "2024-2025"
    status = models.CharField(max_length=20, choices=[
        ('promoted', 'Promoted'),
        ('retained', 'Retained'),
        ('not_passed', 'Not Passed'),
    ], default='promoted')
    examination_id = models.IntegerField(blank=True, null=True)
    result_cgpa = models.FloatField(blank=True, null=True)
    result_grade = models.CharField(max_length=5, blank=True, null=True)
    percentage = models.FloatField(blank=True, null=True)
    rank = models.IntegerField(blank=True, null=True)
    promoted_to_classroom = models.ForeignKey(ClassRoom, on_delete=models.SET_NULL, null=True, blank=True, related_name='promoted_year_records')
    promoted_on = models.DateTimeField(blank=True, null=True)
    meta = models.JSONField(blank=True, null=True)

    class Meta:
        unique_together = ('student', 'academic_year')
        indexes = [
            models.Index(fields=['school', 'academic_year']),
            models.Index(fields=['student', 'academic_year']),
        ]
        ordering = ['-academic_year', 'student_id']

    def __str__(self):
        try:
            nm = self.student.user.get_full_name() or self.student.user.username
        except:
            nm = str(self.student_id)
        return f"{nm} - {self.academic_year} ({self.status})"

class VirtualClass(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='virtual_classes')
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='virtual_classes')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='virtual_classes')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='virtual_classes')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='virtual_classes')
    meeting_id = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.subject.name} - {self.teacher}"
