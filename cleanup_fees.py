import sys
import argparse
import os
import django
from datetime import datetime
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from fees.models import FeeStructure, StudentFeeAssignment, FeeCategory
from django.db import transaction

def month_index_from_category(name: str) -> int:
    months = ['জানুয়ারী','ফেব্রুয়ারী','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগষ্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর']
    if not name:
        return 0
    n = str(name).strip()
    for i, m in enumerate(months, start=1):
        if n.startswith(m) and 'মাসের বেতন' in n:
            return i
    return 0

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--school', type=int, required=True)
    parser.add_argument('--year', type=int, default=datetime.now().year)
    parser.add_argument('--month', type=int, default=datetime.now().month)
    args = parser.parse_args()
    school_id = args.school
    year_str = str(args.year)
    current_month = args.month
    with transaction.atomic():
        exam_structs = FeeStructure.objects.filter(school_id=school_id, frequency='one_time')
        exam_assignments = StudentFeeAssignment.objects.filter(fee_structure__in=exam_structs)
        ea = exam_assignments.count()
        es = exam_structs.count()
        exam_assignments.delete()
        exam_structs.delete()
        monthly_structs = list(FeeStructure.objects.filter(school_id=school_id, frequency='monthly'))
        to_keep_ids = set()
        for s in monthly_structs:
            cat_name = s.category.name if s.category else ''
            mi = month_index_from_category(cat_name)
            if s.academic_year == year_str and 1 <= mi <= current_month:
                to_keep_ids.add(s.id)
        monthly_to_delete = [s for s in monthly_structs if s.id not in to_keep_ids]
        mtd_ids = [s.id for s in monthly_to_delete]
        monthly_assignments = StudentFeeAssignment.objects.filter(fee_structure_id__in=mtd_ids)
        ma = monthly_assignments.count()
        ms = len(mtd_ids)
        monthly_assignments.delete()
        if mtd_ids:
            FeeStructure.objects.filter(id__in=mtd_ids).delete()
    print(f"Deleted exam assignments: {ea}, exam structures: {es}")
    print(f"Deleted monthly assignments: {ma}, monthly structures: {ms}")

if __name__ == '__main__':
    main()
