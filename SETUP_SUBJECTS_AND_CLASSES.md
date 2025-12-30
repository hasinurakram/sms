# 🏫 Setup: Add Subjects and Classes

## ⚠️ **IMPORTANT: Required Before Adding Teachers/Students**

Before you can add teachers or students, you need to set up:
1. ✅ **Classes** (Classrooms)
2. ✅ **Subjects**

---

## 🎯 **QUICK SETUP GUIDE:**

### **Step 1: Add Classes**

1. Go to Django Admin: `http://localhost:8000/admin`
2. Navigate to: **Academics → Classrooms**
3. Click **"Add Classroom"**
4. Fill the form:
   ```
   School: [Select your school]
   Name: Class 8
   ```
5. Click **"Save and add another"**
6. Repeat for all classes:
   - Class 6
   - Class 7
   - Class 8
   - Class 9
   - Class 10

---

### **Step 2: Add Subjects**

1. Go to Django Admin: `http://localhost:8000/admin`
2. Navigate to: **Academics → Subjects**
3. Click **"Add Subject"**
4. Fill the form:
   ```
   School: [Select your school]
   Name: Mathematics
   Code: MATH
   ```
5. Click **"Save and add another"**
6. Repeat for all subjects:
   - বাংলা (Bengali) - BANG
   - ইংরেজি (English) - ENG
   - গণিত (Mathematics) - MATH
   - বিজ্ঞান (Science) - SCI
   - সামাজিক বিজ্ঞান (Social Science) - SS
   - ধর্ম ও নৈতিক শিক্ষা (Religion) - REL
   - কৃষি শিক্ষা (Agriculture) - AGR

---

## 🚀 **AFTER SETUP:**

Once you've added classes and subjects:
1. ✅ Go back to frontend
2. ✅ Click "Add New Teacher" or "Add Student"
3. ✅ Dropdowns will now show your classes and subjects!
4. ✅ You can add teachers and students!

---

## 💡 **WHY THIS IS NEEDED:**

### **Teachers Need**:
- Subject to teach
- Class to teach

### **Students Need**:
- Class to enroll in
- Roll number in that class

**Without classes and subjects, you can't assign anyone!**

---

## 🎯 **COMMON CLASSES:**

### **For High School**:
```
Class 6 (ষষ্ঠ শ্রেণী)
Class 7 (সপ্তম শ্রেণী)
Class 8 (অষ্টম শ্রেণী)
Class 9 (নবম শ্রেণী)
Class 10 (দশম শ্রেণী)
```

### **For Primary School**:
```
Class 1
Class 2
Class 3
Class 4
Class 5
```

---

## 📚 **COMMON SUBJECTS:**

### **For Bangladeshi Schools**:
```
বাংলা (Bengali)
ইংরেজি (English)
গণিত (Mathematics)
বিজ্ঞান (Science)
সামাজিক বিজ্ঞান (Social Science)
ধর্ম ও নৈতিক শিক্ষা (Religion & Moral Education)
কৃষি শিক্ষা (Agriculture)
তথ্য ও যোগাযোগ প্রযুক্তি (ICT)
শারীরিক শিক্ষা (Physical Education)
```

---

## 🎊 **QUICK BULK SETUP:**

### **Option 1: Django Admin** (Recommended)
- Add one by one
- Takes 5-10 minutes
- Most reliable

### **Option 2: Django Shell** (Advanced)
```python
python manage.py shell

from academics.models import ClassRoom, Subject
from schools.models import School

school = School.objects.get(id=4)

# Add Classes
classes = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10']
for c in classes:
    ClassRoom.objects.get_or_create(school=school, name=c)

# Add Subjects
subjects = [
    ('বাংলা', 'BANG'),
    ('ইংরেজি', 'ENG'),
    ('গণিত', 'MATH'),
    ('বিজ্ঞান', 'SCI'),
    ('সামাজিক বিজ্ঞান', 'SS'),
]
for name, code in subjects:
    Subject.objects.get_or_create(school=school, name=name, code=code)

print("Done!")
exit()
```

---

## ✅ **CHECKLIST:**

Before adding teachers/students, make sure:
- [ ] School is created
- [ ] At least 1 class is added
- [ ] At least 1 subject is added
- [ ] Refresh the frontend page

---

## 🎯 **TROUBLESHOOTING:**

### **Problem**: Dropdowns are empty
**Solution**: Add classes and subjects in Django Admin

### **Problem**: Can't save teacher/student
**Solution**: Select a class and subject first

### **Problem**: "No subjects found" warning
**Solution**: Go to Django Admin → Academics → Subjects → Add

### **Problem**: "No classes found" warning
**Solution**: Go to Django Admin → Academics → Classrooms → Add

---

## 🚀 **QUICK ACCESS:**

### **Django Admin**:
```
http://localhost:8000/admin
```

### **Add Classroom**:
```
http://localhost:8000/admin/academics/classroom/add/
```

### **Add Subject**:
```
http://localhost:8000/admin/academics/subject/add/
```

---

## 🎉 **AFTER SETUP:**

Your system will be ready to:
- ✅ Add teachers with subject assignments
- ✅ Add students to classes
- ✅ Create teaching assignments
- ✅ Enter exam results
- ✅ Generate result cards
- ✅ Full functionality!

---

**⚠️ This is a ONE-TIME setup per school!**

**Takes only 5-10 minutes!** ⏱️

**Then you're ready to go!** 🚀
