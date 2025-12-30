# populate_schools.py
import os
import django

# Django সেটআপ
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from schools.models import School

# স্কুল ডেটা
schools_data = [
    {
        "name": "Dhalaitali Janata High School",
        "address": "Dhalaitali, Matlab, Chandpur",
        "logo": "school_logos/dhalaitali.png"
    },
    {
        "name": "Gridakalindia High School",
        "address": "Gridakalindia, Faridganj, Chandpur",
        "logo": "school_logos/gridakalindia.png"
    },
    {
        "name": "কাওনিয়া শহীদ হাবিব উল্লা উচ্চ বিদ্যালয়",
        "address": "কাওনিয়া শহীদ হাবিব উল্লা উচ্চ বিদ্যালয়",
        "logo": "school_logos/kaunia_habib.png"
    },
    {
        "name": "চরপাড়া তৈয়বা দাখিল মাদ্রাসা",
        "address": "চরপাড়া, ফরিদগঞ্জ, চাঁদপুর",
        "logo": "school_logos/charpara_taiba.png"
    },
    {
        "name": "ঘিলাতলী সামাদিয়া কামিল মাদ্রাসা",
        "address": "ঘিলাতলী, নারায়নপুর মতলব দক্ষিণ, চাঁদপুর",
        "logo": "school_logos/ghilatoli_samadia.png"
    },
    {
        "name": "শ্রীরামপুর উচ্চ বিদ্যালয়",
        "address": "শ্রীরামপুর, কচুয়া, চাঁদপুর",
        "logo": "school_logos/shreerampur.png"
    },
    {
        "name": "হাজী মঈন উদ্দিন উচ্চ বিদ্যালয়",
        "address": "চরমাছুয়া, মতলব উত্তর, চাঁদপুর",
        "logo": "school_logos/hazi_moinuddin.png"
    },
]

# ডাটাবেসে আপডেট
for s in schools_data:
    school, created = School.objects.get_or_create(name=s["name"])
    school.address = s["address"]
    school.logo = s["logo"]  # media ফোল্ডারের path
    school.save()
    print(f"{school.name} saved!")
