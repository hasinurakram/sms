#!/usr/bin/env python
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from fees.models import StudentFeeAssignment, Payment
from academics.models import StudentProfile

# Check if student 1039 has fee assignments
student = StudentProfile.objects.filter(id=1039).first()
if student:
    print(f'Student: {student.user.first_name} {student.user.last_name}')
    print(f'Classroom: {student.classroom}')
    if student.classroom:
        print(f'School: {student.classroom.school}')
    
    # Check fee assignments
    assignments = StudentFeeAssignment.objects.filter(student=student)
    print(f'Fee assignments: {assignments.count()}')
    for assignment in assignments:
        fee_name = assignment.fee_structure.category.name if assignment.fee_structure and assignment.fee_structure.category else "Unknown Fee"
        print(f'  - {fee_name}: {assignment.get_payable_amount()}')
    
    # Check payments
    payments = Payment.objects.filter(student=student)
    print(f'Payments: {payments.count()}')
    for payment in payments:
        print(f'  - {payment.amount} on {payment.payment_date}')
else:
    print('Student 1039 not found')