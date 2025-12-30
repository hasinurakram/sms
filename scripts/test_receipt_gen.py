import os
import sys
import datetime

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

try:
    import django
    django.setup()
except Exception as e:
    print('Failed to setup Django:', e)
    sys.exit(1)

from academics.models import StudentProfile
from fees.models import Payment

def main():
    student = StudentProfile.objects.order_by('id').first()
    if not student:
        print('No StudentProfile found; cannot create test payments.')
        return

    today = datetime.date.today()
    print('Using student id:', student.id)
    print('Creating two payments on', today)

    p1 = Payment.objects.create(student=student, amount=100, payment_date=today, payment_method='cash')
    p2 = Payment.objects.create(student=student, amount=150, payment_date=today, payment_method='cash')

    print('Created payments:')
    print(' -', p1.receipt_number)
    print(' -', p2.receipt_number)

    # Verify uniqueness and ordering
    assert p1.receipt_number != p2.receipt_number, 'Receipt numbers should be unique'
    assert p1.receipt_number[:13] == p2.receipt_number[:13], 'Prefix (date) should match'
    print('Verification passed.')

if __name__ == '__main__':
    main()