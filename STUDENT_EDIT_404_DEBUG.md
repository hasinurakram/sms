# Student Edit 404 Error - Debugging Guide

## Issue

When clicking "Save Changes" in the Edit Student dialog, you get:
```
Failed to update student profile: Request failed with status code 404
```

## Possible Causes

### 1. Student ID is Invalid
- Student may have been deleted
- ID mismatch between frontend and backend
- Context data is stale

### 2. API Endpoint Not Found
- URL routing issue
- ViewSet not properly registered
- Incorrect URL format

### 3. PATCH Method Not Allowed
- ViewSet missing update permission
- Serializer issue

---

## Debugging Steps

### Step 1: Check Browser Console

After clicking "Save Changes", check the browser console (F12) for:

```javascript
// Look for these logs:
User updated successfully
Updating student profile with data: {classroom_id: 8, section_id: 5, ...}
Student ID: 123

// If you see 404, check:
Error response: {...}
Error data: {...}
Student ID that failed: 123
```

**What to look for**:
- Does "User updated successfully" appear? (If yes, user update works)
- What is the Student ID being used?
- What URL is being called? (Check Network tab)

---

### Step 2: Check Network Tab

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Click "Save Changes"
4. Look for the PATCH request

**Expected URL**:
```
PATCH http://127.0.0.1:8000/api/academics/students/123/
```

**Check**:
- Is the URL correct?
- What is the student ID (123)?
- What is the response status?
- What is the response body?

---

### Step 3: Verify Student ID

In the browser console, when edit dialog opens, check:

```javascript
console.log('Selected student:', selectedStudent);
console.log('Student ID:', selectedStudent?.id);
console.log('User ID:', selectedStudent?.user?.id);
```

**Verify**:
- Student ID exists and is a number
- User ID exists and is a number
- Both IDs are valid

---

### Step 4: Test API Directly

Open a new browser tab and try:

```
http://127.0.0.1:8000/api/academics/students/
```

**Expected**: List of all students with their IDs

Then try with a specific ID:
```
http://127.0.0.1:8000/api/academics/students/123/
```

**Expected**: Details of student with ID 123

**If 404**: Student doesn't exist in database

---

### Step 5: Check Django Admin

1. Go to: `http://127.0.0.1:8000/admin`
2. Login with admin credentials
3. Go to **Academics** → **Student Profiles**
4. Find the student you're trying to edit
5. Note their ID number
6. Verify it matches the ID in the frontend

---

## Common Issues & Solutions

### Issue 1: Student ID Mismatch

**Symptom**: Frontend shows student but backend can't find it

**Solution**:
```javascript
// In browser console, check:
console.log('Context students:', contextStudents);
console.log('Selected student:', selectedStudent);

// Verify the student exists in context
// If not, refresh the page
```

### Issue 2: Stale Context Data

**Symptom**: Student was deleted but still shows in UI

**Solution**:
1. Click the **Refresh** button on Students page
2. Or reload the page (F5)
3. Try editing again

### Issue 3: Wrong API URL

**Symptom**: URL in Network tab is malformed

**Solution**: Check the `api.js` configuration:
```javascript
// Should be:
baseURL: 'http://127.0.0.1:8000/api/'
```

### Issue 4: CORS or Server Not Running

**Symptom**: Network error, not 404

**Solution**:
1. Verify Django server is running
2. Check terminal for errors
3. Restart server if needed

---

## Quick Fix Steps

### Fix 1: Refresh Everything

1. **Refresh Students page** (click Refresh button)
2. **Select class again**
3. **Click Edit on student**
4. **Try saving**

### Fix 2: Check Student Exists

1. Open browser console (F12)
2. Type: `console.log(selectedStudent)`
3. Verify ID exists
4. Go to: `http://127.0.0.1:8000/api/academics/students/[ID]/`
5. If 404, student doesn't exist

### Fix 3: Restart Django Server

Sometimes the server needs a restart:

```bash
# Stop server (Ctrl+C)
cd d:\SchoolManagementSoftware
python manage.py runserver
```

Then refresh browser and try again.

---

## Testing Checklist

### Test 1: Verify Student Exists
- [ ] Go to Students page
- [ ] Click Refresh button
- [ ] Select a class
- [ ] Student appears in list
- [ ] Note the student's name

### Test 2: Check Browser Console
- [ ] Open DevTools (F12)
- [ ] Go to Console tab
- [ ] Click Edit on student
- [ ] Check console for student data
- [ ] Note the student ID

### Test 3: Check Network Request
- [ ] Open DevTools (F12)
- [ ] Go to Network tab
- [ ] Click "Save Changes"
- [ ] Find PATCH request
- [ ] Check URL format
- [ ] Check response status
- [ ] Check response body

### Test 4: Verify API Endpoint
- [ ] Open new tab
- [ ] Go to: `http://127.0.0.1:8000/api/academics/students/`
- [ ] Verify students list loads
- [ ] Find your student in the list
- [ ] Note their ID
- [ ] Try: `http://127.0.0.1:8000/api/academics/students/[ID]/`
- [ ] Verify student details load

---

## Expected Console Output

### When Edit Dialog Opens:
```javascript
Selected student: {
  id: 123,
  user: {
    id: 456,
    first_name: "Md. Tamim",
    last_name: "Rahat",
    ...
  },
  classroom: { id: 8, name: "Class 8" },
  section: { id: 5, name: "Section A" },
  roll_number: "12",
  guardian: { id: 789, ... }
}
```

### When Clicking Save:
```javascript
User updated successfully
Updating student profile with data: {
  classroom_id: 8,
  section_id: 5,
  roll_number: "12",
  guardian_id: 789
}
Student ID: 123
Student profile updated successfully
```

### If 404 Error:
```javascript
Error updating student: Error: Request failed with status code 404
Error response: { status: 404, ... }
Error data: { detail: "Not found." }
Student ID that failed: 123
```

---

## What to Report

If the issue persists, please provide:

1. **Student ID** from console log
2. **Network tab screenshot** showing the PATCH request
3. **Console errors** (full error message)
4. **API test result** from browser (does `/api/academics/students/[ID]/` work?)
5. **Django admin check** (does student exist with that ID?)

---

## Temporary Workaround

If editing doesn't work, you can update students via Django Admin:

1. Go to: `http://127.0.0.1:8000/admin`
2. Login
3. Go to **Academics** → **Student Profiles**
4. Find the student
5. Click to edit
6. Update classroom, section, roll, guardian
7. Save

Then refresh the frontend to see changes.

---

## Next Steps

1. ✅ **Refresh browser** (Ctrl+Shift+R)
2. ✅ **Open DevTools** (F12)
3. ✅ **Try editing a student**
4. ✅ **Check console logs**
5. ✅ **Check Network tab**
6. ✅ **Report findings**

The enhanced error logging will help us identify the exact issue!
