from django.apps import apps
from django.conf import settings
from django.db import connections, transaction
from django.core.management.color import no_style
import os
import django
import sys
from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

def get_db_aliases():
    source = 'sqlite_old' if 'sqlite_old' in settings.DATABASES else 'default'
    target = 'postgres' if 'postgres' in settings.DATABASES else 'default'
    return source, target

def get_field_names(Model):
    fields = []
    for f in Model._meta.get_fields():
        if f.concrete and not f.auto_created and not f.many_to_many:
            fields.append(getattr(f, 'attname', f.name))
    pk = getattr(Model._meta.pk, 'attname', Model._meta.pk.name)
    if pk and pk not in fields:
        fields.append(pk)
    return fields

def copy_queryset(Model, source_alias, target_alias, batch_size=500, ignore_conflicts=True):
    fields = get_field_names(Model)
    src_qs = Model.objects.using(source_alias).all().values(*fields)
    buffer = []
    total = 0
    for row in src_qs.iterator():
        obj = Model(**row)
        buffer.append(obj)
        if len(buffer) >= batch_size:
            Model.objects.using(target_alias).bulk_create(buffer, ignore_conflicts=ignore_conflicts, batch_size=batch_size)
            total += len(buffer)
            buffer = []
    if buffer:
        Model.objects.using(target_alias).bulk_create(buffer, ignore_conflicts=ignore_conflicts, batch_size=batch_size)
        total += len(buffer)
    return total

def reset_sequences(models, target_alias):
    connection = connections[target_alias]
    sql = []
    for m in models:
        sql += connection.ops.sequence_reset_sql(no_style(), [m])
    if sql:
        with connection.cursor() as cursor:
            for stmt in sql:
                cursor.execute(stmt)

def main():
    source_alias, target_alias = get_db_aliases()
    plan = [
        ('users', 'User'),
        ('schools', 'School'),
        ('users', 'Profile'),
        ('academics', 'ClassRoom'),
        ('academics', 'Section'),
        ('academics', 'Subject'),
        ('academics', 'StudentProfile'),
        ('academics', 'TeacherAssignment'),
        ('fees', 'FeeCategory'),
        ('fees', 'FeeStructure'),
        ('fees', 'StudentFeeAssignment'),
        ('fees', 'Payment'),
        ('fees', 'FeeCollection'),
        ('fees', 'FeeSlip'),
        ('results', 'Examination'),
        ('results', 'Result'),
        ('results', 'StudentOverallResult'),
        ('users', 'Task'),
    ]
    copied = {}
    models_for_seq_reset = []
    for app_label, model_name in plan:
        try:
            Model = apps.get_model(app_label, model_name)
        except Exception:
            continue
        with transaction.atomic(using=target_alias):
            # clear target table to preserve original primary keys
            Model.objects.using(target_alias).all().delete()
            print(f'Copying {app_label}.{model_name}...')
            n = copy_queryset(Model, source_alias, target_alias, ignore_conflicts=True)
            copied_key = f'{app_label}.{model_name}'
            copied[copied_key] = n
            print(f'Inserted {n} rows into {copied_key}')
            models_for_seq_reset.append(Model)
    reset_sequences(models_for_seq_reset, target_alias)
    return copied

if __name__ == '__main__':
    res = main()
    print(res)
