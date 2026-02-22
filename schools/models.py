from django.db import models
from django.utils import timezone

class School(models.Model):
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255, blank=True)
    logo = models.ImageField(upload_to='school_logos/', blank=True, null=True)

    def __str__(self):
        return self.name


class Advertisement(models.Model):
    TYPE_CHOICES = (
        ('image', 'Image'),
        ('video', 'Video'),
    )
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='advertisements')
    text = models.CharField(max_length=255, blank=True)
    link = models.URLField(blank=True)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='image')
    media = models.FileField(upload_to='school_ads/')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f"{self.school.name} - {self.type} - {self.text[:20] if self.text else 'Ad'}"
