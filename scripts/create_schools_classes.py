# scripts/create_schools_classes.py
# Save this file in project root: E:\SchoolManagementSoftware\scripts\create_schools_classes.py
# Make sure file is saved as UTF-8 (to support Bengali)

from django.core.files import File
from academics.models import School, ClassRoom
import os

# Adjust logo paths if you have logos in project; else leave logo_path = None
schools_data = [
    {"name":"Dhalaitali Janata High School", "address":"Dhalaitali, Matlab, Chandpur", "mobile":"1716557279", "logo_path": None},
    {"name":"Gridakalindia High school", "address":"Gridakalindia, Faridganj, Chandpur", "mobile":"1877995254", "logo_path": None},
    {"name":"কাওনিয়া শহীদ হাবিব উল্লা উচ্চ বিদ্যালয়", "address":"কাওনিয়া শহীদ হাবিব উল্লা উচ্চ বিদ্যালয়", "mobile":"", "logo_path": None},
    {"name":"চরপাড়া তৈয়বা দাখিল মাদ্রাসা", "address":"চরপাড়া , ফরিদগঞ্জ, চাঁদপুর।", "mobile":"", "logo_path": None},
    {"name":"ঘিলাতলী সামাদিয়া কামিল মাদ্রাসা", "address":"ঘিলাতলী, নারায়নপুর মতলব দক্ষিণ, চাঁদপুর", "mobile":"1838323189", "logo_path": None},
    {"name":"শ্রীরামপুর উচ্চ বিদ্যালয়", "address":"শ্রীরামপুর, কচুয়া, চাঁদপুর", "mobile":"", "logo_path": None},
    {"name":"হাজী মঈন উদ্দিন উচ্চ বিদ্যালয়", "address":"চরমাছুয়া, মতলব উত্তর, চাঁদপুর", "mobile":"", "logo_path": None},
    {"name":"মতলবগঞ্জ পাইলট বালিকা উচ্চ বিদ্যালয়", "address":"মতলব দক্ষিণ, চাঁদপুর।", "mobile":"", "logo_path": None},
    {"name":"বিডিএ্যাপ আইটি ফার্ম", "address":"ঢাকা বাংলাদেশ", "mobile":"1796336003", "logo_path": None},
]

# create schools (or get existing)
created = []
for s in schools_data:
    school_obj, _ = School.objects.get_or_create(name=s["name"], defaults={"address": s["address"]})
    # if you have logo files uncomment below and adjust path:
    # if s["logo_path"] and os.path.exists(s["logo_path"]):
    #     with open(s["logo_path"], "rb") as f:
    #         school_obj.logo.save(os.path.basename(s["logo_path"]), File(f), save=True)
    created.append(school_obj)
print(f"Processed {len(created)} schools.")

# classes per school (example: create 6-10th for each)
school_classes_common = ["ষষ্ঠ শ্রেণী", "সপ্তম শ্রেণী", "অষ্টম শ্রেণী", "নবম শ্রেণী", "দশম শ্রেণী"]
for school in created:
    for cname in school_classes_common:
        cr, created_flag = ClassRoom.objects.get_or_create(name=cname, school=school)
print("Classes created/ensured for each school.")
