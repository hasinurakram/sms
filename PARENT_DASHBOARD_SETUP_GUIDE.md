# Parent Dashboard Setup Guide

## Issue: Students Showing "Not Assigned" for Class/Section

### What You're Seeing

When you click on a parent card, you see their children but they show:
- 📚 Class: **Not Assigned**
- 📖 Section: **Not Assigned**
- 🔢 Roll: **Not Assigned**
- ⚠️ **Incomplete Profile** chip

### Why This Happens

The students are linked to the parent (guardian field is set), but they haven't been assigned to a class and section yet.

---

## How to Fix This

### Step 1: Go to Students Page

1. Navigate to **Students** page in your school dashboard
2. You'll see the list of all students

### Step 2: Edit Each Student

For each student that shows "Not Assigned":

1. **Click** on the student's card or edit button
2. **Select** a classroom from the dropdown
3. **Select** a section from the dropdown
4. **Enter** a roll number
5. **Click** Save

### Step 3: Verify

1. Go back to **Parents** page
2. Click on the parent card again
3. Now you should see:
   - 📚 Class: **Class 8**
   - 📖 Section: **Section A**
   - 🔢 Roll: **12**
   - ✅ No warning chip

---

## Example: Fixing Md. Tamim Rahat

### Before (Current State)
```
Md. Tamim Rahat
📚 Class: Not Assigned
📖 Section: Not Assigned
🔢 Roll: Not Assigned
⚠️ Incomplete Profile
```

### Steps to Fix

1. Go to **Students** page
2. Find **Md. Tamim Rahat**
3. Click **Edit** or click on the student card
4. Fill in:
   - **Classroom**: Select "Class 8" (or appropriate class)
   - **Section**: Select "Section A" (or appropriate section)
   - **Roll Number**: Enter "12" (or appropriate roll)
5. Click **Save**

### After (Fixed State)
```
Md. Tamim Rahat
📚 Class: Class 8
📖 Section: Section A
🔢 Roll: 12
(No warning chip)
```

---

## Bulk Update Guide

If you have many students to update:

### Option 1: Update One by One
1. Go to Students page
2. Edit each student
3. Assign class, section, roll
4. Save

### Option 2: Use Django Admin (Faster)
1. Go to `http://127.0.0.1:8000/admin`
2. Login with admin credentials
3. Go to **Academics** → **Student Profiles**
4. Click on each student
5. Select classroom and section from dropdowns
6. Enter roll number
7. Save

### Option 3: Import from CSV (If Available)
If you have a CSV file with student data:
1. Create CSV with columns: username, classroom, section, roll_number
2. Use Django management command to import (if implemented)
3. Or manually update via admin panel

---

## Required Fields for Complete Profile

For students to show properly in parent dashboard:

| Field | Required | Example |
|-------|----------|---------|
| **Name** | ✅ Yes | Md. Tamim Rahat |
| **Classroom** | ✅ Yes | Class 8 |
| **Section** | ✅ Yes | Section A |
| **Roll Number** | ⚠️ Recommended | 12 |
| **Guardian** | ✅ Yes (for parent link) | Akhter Hossain |

---

## Visual Guide

### Current State (Incomplete)
```
┌─────────────────────────────────┐
│ ⚠️ Some students have incomplete│
│    profiles                     │
│                                 │
│ Students need class & section   │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Md. Tamim Rahat                 │
│ 📚 Class: Not Assigned          │
│ 📖 Section: Not Assigned        │
│ 🔢 Roll: Not Assigned           │
│ [Incomplete Profile]            │
└─────────────────────────────────┘
```

### After Fix (Complete)
```
(No warning message)

┌─────────────────────────────────┐
│ Md. Tamim Rahat                 │
│ 📚 Class: Class 8               │
│ 📖 Section: Section A           │
│ 🔢 Roll: 12                     │
└─────────────────────────────────┘
```

---

## Checklist for Each Student

For **Md. Tamim Rahat**:
- [ ] Assign to classroom
- [ ] Assign to section
- [ ] Enter roll number
- [ ] Verify guardian is set (Akhter Hossain)

For **Tachpia Akhter Meem**:
- [ ] Assign to classroom
- [ ] Assign to section
- [ ] Enter roll number
- [ ] Verify guardian is set (Akhter Hossain)

For **Rafi Hossain**:
- [ ] Assign to classroom
- [ ] Assign to section
- [ ] Enter roll number
- [ ] Verify guardian is set (Akhter Hossain)

...and so on for all 10 students.

---

## After Fixing All Students

Once all students have class and section assigned:

### Parent Dashboard Will Show:

1. **No warning message**
2. **Complete student information**:
   - ✅ Class name
   - ✅ Section name
   - ✅ Roll number
3. **Clickable cards** to view reports
4. **Result cards** will work (if exams entered)
5. **Attendance cards** will work (if attendance marked)

---

## Common Issues

### Issue 1: "Guardian not set"
**Problem**: Student doesn't appear in parent dashboard

**Solution**: 
1. Go to Students page
2. Edit student
3. Select parent from "Guardian" dropdown
4. Save

### Issue 2: "Still showing Not Assigned after saving"
**Problem**: Changes not saved properly

**Solution**:
1. Refresh browser (Ctrl+F5)
2. Check if classroom and section exist in system
3. Try saving again
4. Check browser console for errors

### Issue 3: "Can't select section"
**Problem**: Section dropdown is empty

**Solution**:
1. First select a classroom
2. Section dropdown will populate with sections for that class
3. If still empty, create sections for that classroom first

---

## Quick Fix Steps (Summary)

1. ✅ **Go to Students page**
2. ✅ **For each student**:
   - Edit student
   - Select classroom
   - Select section
   - Enter roll number
   - Save
3. ✅ **Verify in Parent Dashboard**:
   - Go to Parents page
   - Click parent card
   - Check students show complete info
   - No warning message

---

## Expected Timeline

- **Per Student**: 30 seconds to 1 minute
- **10 Students**: 5-10 minutes total
- **After Update**: Immediate effect (refresh page)

---

## Need Help?

### If Students Page Doesn't Work
1. Check if you're logged in
2. Verify you have permissions
3. Check browser console for errors

### If Dropdowns Are Empty
1. Go to **Classrooms** page
2. Ensure classrooms exist
3. Go to **Sections** page (or create via classrooms)
4. Ensure sections exist for each classroom

### If Save Doesn't Work
1. Check all required fields are filled
2. Check browser console for errors
3. Verify backend server is running
4. Check network tab for API errors

---

## After Setup Complete

Once all students are properly configured:

### Parent Dashboard Features Available:
- ✅ View all children
- ✅ Click child to see reports
- ✅ View latest exam results
- ✅ View current month attendance
- ✅ Download PDF reports
- ✅ Print reports

### Reports Will Show:
- ✅ Student name
- ✅ Class and section
- ✅ Roll number
- ✅ Exam marks (if entered)
- ✅ Attendance stats (if marked)

---

## Summary

**Problem**: Students showing "Not Assigned"

**Cause**: Students not assigned to class/section in database

**Solution**: Edit each student and assign classroom, section, roll number

**Time**: 5-10 minutes for 10 students

**Result**: Complete parent dashboard with all features working

---

**Start by fixing one student to test, then do the rest!** 🚀
