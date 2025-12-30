from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('results', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='examination',
            name='written_max',
            field=models.IntegerField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='examination',
            name='mcq_max',
            field=models.IntegerField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='examination',
            name='practical_max',
            field=models.IntegerField(null=True, blank=True),
        ),
    ]
