
import os
import django
import sys

# Set stdout to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import Advertisement

ads = Advertisement.objects.all()
print(f"Total ads: {ads.count()}")
for ad in ads:
    try:
        print(f"ID: {ad.id}, School: {ad.school.name}, Type: {ad.type}, Text: {ad.text}, Media: {ad.media}")
    except Exception as e:
        print(f"ID: {ad.id}, Error: {e}")
