from django.db import models
from django.utils import timezone
from academics.models import StudentProfile, ClassRoom
from schools.models import School
from decimal import Decimal
from django.db.models.signals import post_save
from django.dispatch import receiver
import datetime


class FeeCategory(models.Model):
    """Fee categories like Tuition, Admission, Exam, etc."""
    FEE_TYPES = [
        ('tuition', 'Tuition Fee'),
        ('admission', 'Admission Fee'),
        ('exam', 'Examination Fee'),
        ('transport', 'Transport Fee'),
        ('library', 'Library Fee'),
        ('sports', 'Sports Fee'),
        ('lab', 'Laboratory Fee'),
        ('other', 'Other'),
    ]
    
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='fee_categories')
    name = models.CharField(max_length=100)
    fee_type = models.CharField(max_length=20, choices=FEE_TYPES, default='other')
    description = models.TextField(blank=True)
    is_mandatory = models.BooleanField(default=True)
    
    class Meta:
        verbose_name_plural = 'Fee Categories'
        unique_together = ('school', 'name')
    
    def __str__(self):
        return f"{self.name} ({self.school.name})"


class FeeStructure(models.Model):
    """Fee structure for a class/grade"""
    FREQUENCY_CHOICES = [
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('half_yearly', 'Half Yearly'),
        ('yearly', 'Yearly'),
        ('one_time', 'One Time'),
    ]
    
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='fee_structures')
    category = models.ForeignKey(FeeCategory, on_delete=models.CASCADE, related_name='structures', null=True, blank=True)
    # Keep DB-level null allowed to avoid migration disruption; validations enforce presence
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='fee_structures', null=True, blank=True)
    
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default='monthly')
    
    # Due date settings
    due_day = models.PositiveIntegerField(default=10, help_text="Day of month for payment")
    late_fee_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    late_fee_after_days = models.PositiveIntegerField(default=7, help_text="Days after due date")
    
    is_active = models.BooleanField(default=True)
    academic_year = models.CharField(max_length=20, blank=True, help_text="e.g., 2024-2025")

    def __str__(self):
        category_name = self.category.name if self.category else 'No Category'
        classroom_name = self.classroom.name if self.classroom else 'No Class'
        return f"{category_name} - {classroom_name} - {self.amount}"

    class Meta:
        indexes = [
            models.Index(fields=['school', 'classroom']),
            models.Index(fields=['is_active']),
        ]

    def clean(self):
        # Ensure classroom belongs to the same school
        try:
            cls_school = getattr(self.classroom, 'school', None)
            if cls_school and self.school and cls_school != self.school:
                from django.core.exceptions import ValidationError
                raise ValidationError({'classroom': 'Selected classroom does not belong to the provided school.'})
        except Exception:
            pass

    def save(self, *args, **kwargs):
        # Validate invariants before saving
        self.full_clean()
        super().save(*args, **kwargs)


class StudentFeeAssignment(models.Model):
    """Assign fees to individual students with custom amounts if needed"""
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='fee_assignments')
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.CASCADE, related_name='assignments')
    
    # Override amount if student has discount/scholarship
    custom_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_reason = models.CharField(max_length=200, blank=True)
    
    is_waived = models.BooleanField(default=False)
    waiver_reason = models.TextField(blank=True)
    
    assigned_date = models.DateField(auto_now_add=True)
    
    def get_payable_amount(self):
        if self.is_waived:
            return Decimal('0.00')
        if self.custom_amount:
            return self.custom_amount
        base = self.fee_structure.amount
        if self.discount_percentage > 0:
            discount = base * (self.discount_percentage / 100)
            return base - discount
        return base
    
    class Meta:
        unique_together = ('student', 'fee_structure')
    
    def __str__(self):
        student_name = self.student.user.get_full_name()
        # FeeStructure.category can be null; guard against None to avoid AttributeError in admin formatting
        category_name = getattr(getattr(self.fee_structure, 'category', None), 'name', None) or 'No Category'
        return f"{student_name} - {category_name}"

    def clean(self):
        # Enforce: student's classroom must match fee_structure.classroom
        try:
            student_cls = getattr(self.student, 'classroom', None)
            struct_cls = getattr(self.fee_structure, 'classroom', None)
            if student_cls and struct_cls and student_cls_id(student_cls) != class_id(struct_cls):
                from django.core.exceptions import ValidationError
                raise ValidationError({'fee_structure': 'Fee structure classroom does not match the student\'s classroom.'})
            # Enforce school consistency when available
            student_school = getattr(self.student, 'school', None) or getattr(getattr(student_cls, 'school', None), 'pk', None)
            structure_school = getattr(self.fee_structure, 'school', None)
            if student_school and structure_school and obj_pk(student_school) != obj_pk(structure_school):
                from django.core.exceptions import ValidationError
                raise ValidationError({'fee_structure': 'Fee structure school does not match the student\'s school.'})
        except Exception:
            # Be conservative: if we cannot verify, let other layers handle
            pass

    def save(self, *args, **kwargs):
        # Validate invariants before saving
        self.full_clean()
        super().save(*args, **kwargs)


# Utility helpers for robust FK id extraction without strict coupling
def obj_pk(obj):
    try:
        return getattr(obj, 'pk', obj)
    except Exception:
        return obj

def class_id(cls):
    try:
        return getattr(cls, 'pk', cls)
    except Exception:
        return cls

def student_cls_id(student_cls):
    try:
        return getattr(student_cls, 'pk', student_cls)
    except Exception:
        return student_cls


class Payment(models.Model):
    """Payment records"""
    PAYMENT_METHODS = [
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer'),
        ('cheque', 'Cheque'),
        ('online', 'Online Payment'),
        ('mobile_banking', 'Mobile Banking (bKash/Nagad/Rocket)'),
        ('card', 'Credit/Debit Card'),
    ]
    
    PAYMENT_STATUS = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]
    
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='payments')
    fee_assignment = models.ForeignKey(StudentFeeAssignment, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='cash')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS, default='pending')
    
    payment_date = models.DateField(default=timezone.now)
    transaction_id = models.CharField(max_length=200, blank=True)
    reference = models.CharField(max_length=200, blank=True, help_text="Cheque number, receipt number, etc.")
    
    # For installments
    installment_number = models.PositiveIntegerField(default=1)
    remarks = models.TextField(blank=True)
    
    # Receipt
    receipt_number = models.CharField(max_length=50, unique=True, blank=True, null=True)
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    created_by = models.CharField(max_length=100, blank=True)

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            import datetime
            from django.db import IntegrityError
            # Use the provided payment_date if available; otherwise, fallback to today
            date_for_serial = self.payment_date or datetime.date.today()
            prefix = f"RCP-{date_for_serial.strftime('%Y%m%d')}-"

            def next_sequence():
                existing = Payment.objects.filter(receipt_number__startswith=prefix).values_list('receipt_number', flat=True)
                max_seq = 0
                for rn in existing:
                    try:
                        tail = rn.split(prefix)[1]
                        max_seq = max(max_seq, int(tail))
                    except Exception:
                        continue
                return max_seq + 1

            # Generate and attempt to save; on rare race, retry with increment
            attempts = 0
            while True:
                attempts += 1
                seq = next_sequence()
                self.receipt_number = f"{prefix}{seq:04d}"
                try:
                    super().save(*args, **kwargs)
                    break
                except IntegrityError:
                    if attempts >= 3:
                        raise
                    # Another concurrent insert used the same sequence; try again
                    continue
        else:
            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student.user.get_full_name()} - {self.amount} - {self.receipt_number}"

    class Meta:
        ordering = ['-payment_date', '-created_at']
        indexes = [
            models.Index(fields=['student', 'payment_date']),
            models.Index(fields=['payment_date']),
            models.Index(fields=['receipt_number']),
            models.Index(fields=['payment_status']),
        ]


class FeeCollection(models.Model):
    """Monthly/periodic fee collection summary"""
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='fee_collections')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='fee_collections', null=True, blank=True)
    
    month = models.PositiveIntegerField()  # 1-12
    year = models.PositiveIntegerField()
    
    total_expected = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_collected = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_pending = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    collection_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    class Meta:
        unique_together = ('school', 'classroom', 'month', 'year')
        ordering = ['-year', '-month']
    
    def __str__(self):
        return f"{self.school.name} - {self.month}/{self.year}"


class FeeSlip(models.Model):
    """Invoice/Slip generated for a student's class fee per month"""
    STATUS_CHOICES = [
        ('unpaid', 'Unpaid'),
        ('partial', 'Partial'),
        ('paid', 'Paid'),
        ('void', 'Void'),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='fee_slips')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='fee_slips')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='fee_slips')
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.CASCADE, related_name='fee_slips')

    month = models.PositiveIntegerField()  # 1-12
    year = models.PositiveIntegerField()

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='unpaid')
    due_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('student', 'fee_structure', 'month', 'year')
        indexes = [
            models.Index(fields=['school', 'classroom', 'month', 'year']),
            models.Index(fields=['student', 'month', 'year']),
        ]

    def __str__(self):
        return f"{self.student.user.get_full_name()} - {self.month}/{self.year} - {self.amount}"


@receiver(post_save, sender=FeeStructure)
def generate_slips_for_class(sender, instance: FeeStructure, created: bool, **kwargs):
    """Auto-generate slips from January to current month when a monthly fee structure is created."""
    try:
        if not created:
            return
        if instance.frequency != 'monthly' or not instance.is_active:
            return
        school = instance.school
        classroom = instance.classroom
        if not classroom:
            return

        today = timezone.now().date()
        current_year = today.year
        current_month = today.month

        # Fetch current students in this classroom
        students = list(StudentProfile.objects.filter(classroom=classroom, school=school))
        if not students:
            return

        # Prepare slips for Jan..current_month
        slips = []
        for student in students:
            # Determine amount for student (use assignment if exists else structure amount)
            assignment = None
            try:
                assignment = StudentFeeAssignment.objects.filter(student=student, fee_structure=instance).first()
            except Exception:
                assignment = None
            base_amount = instance.amount
            if assignment:
                try:
                    base_amount = assignment.get_payable_amount()
                except Exception:
                    base_amount = instance.amount

            for m in range(1, current_month + 1):
                # Compute due date for each month
                due_day = int(instance.due_day or 10)
                # Clamp day to last day of month
                last_day = 28
                for d in (31, 30, 29, 28):
                    try:
                        datetime.date(current_year, m, d)
                        last_day = d
                        break
                    except Exception:
                        continue
                due_d = min(due_day, last_day)
                due_date = datetime.date(current_year, m, due_d)

                slips.append(FeeSlip(
                    school=school,
                    classroom=classroom,
                    student=student,
                    fee_structure=instance,
                    month=m,
                    year=current_year,
                    amount=base_amount,
                    due_date=due_date,
                ))

        # Bulk create with ignore_conflicts to avoid duplicates on re-run
        if slips:
            try:
                FeeSlip.objects.bulk_create(slips, ignore_conflicts=True)
            except TypeError:
                # For older Django versions without ignore_conflicts
                existing = set(
                    FeeSlip.objects.filter(
                        student__in=[s.student for s in slips],
                        fee_structure=instance,
                        year=current_year,
                        month__in=range(1, current_month + 1)
                    ).values_list('student_id', 'month')
                )
                to_create = [s for s in slips if (getattr(s.student, 'pk', None), s.month) not in existing]
                if to_create:
                    FeeSlip.objects.bulk_create(to_create)
    except Exception:
        # Fail softly to not block FeeStructure creation
        pass
