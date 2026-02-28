from django.db import models
from django.conf import settings
from schools.models import School
from academics.models import StudentProfile

class AttendanceRecord(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='attendance_records')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField()
    present = models.BooleanField(default=True)
    note = models.TextField(blank=True, null=True)
    taken_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='attendance_taken'
    )
    taken_by_name = models.CharField(max_length=150, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        unique_together = ('student', 'date')
        ordering = ['-date']
        indexes = [
            models.Index(fields=['school', 'date']),
            models.Index(fields=['school']),
            models.Index(fields=['date']),
            models.Index(fields=['student']),
            models.Index(fields=['taken_by_user']),
        ]

    def __str__(self):
        return f"{self.student.user.username} - {self.date} - {'P' if self.present else 'A'}"
