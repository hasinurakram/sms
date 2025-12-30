# Student Dashboard Feature - Complete Guide ✅

## Overview

Added a new feature where clicking on a student card opens their personal dashboard showing:
- 📊 **Latest Result Card** - Most recent exam results
- 📅 **Last Month Attendance** - Attendance records for the past 30 days

Similar to the Parent Dashboard, but focused on individual student data.

---

## What Was Added

### 1. New Page: StudentDashboard

**File**: `frontend/src/pages/StudentDashboard.jsx`

**Features**:
- Student profile header with photo, name, class, section, roll
- Two tabs: Results and Attendance
- Download PDF button
- Print button
- Beautiful report cards with school branding

**Route**: `/school/:id/student/:studentId/dashboard`

---

### 2. Updated StudentCard Component

**File**: `frontend/src/components/StudentCard.jsx`

**Changes**:
- Added `onClick` prop
- Made card clickable with hover effect
- Smooth animations on hover

**Before**:
```jsx
<Card sx={{ borderRadius: 2 }}>
```

**After**:
```jsx
<Card 
  sx={{ 
    borderRadius: 2,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: 4
    }
  }}
  onClick={() => onClick && onClick(student)}
>
```

---

### 3. Updated StudentsPage

**File**: `frontend/src/pages/StudentsPage.jsx`

**Changes**:
- Added navigation to student dashboard on card click

**Before**:
```jsx
onClick={() => handleStudentSelect(s)}
```

**After**:
```jsx
onClick={() => navigate(`/school/${id}/student/${s.id}/dashboard`)}
```

---

### 4. Updated App Routes

**File**: `frontend/src/App.jsx`

**Changes**:
- Imported StudentDashboard component
- Added new route

```jsx
import StudentDashboard from './pages/StudentDashboard';

// In routes:
<Route path="student/:studentId/dashboard" element={<StudentDashboard />} />
```

---

## How It Works

### User Flow

```
1. Go to Students page
   ↓
2. Select a class
   ↓
3. Click on any student card
   ↓
4. Student Dashboard opens
   ↓
5. See two tabs:
   - Latest Result Card
   - Last Month Attendance
   ↓
6. Click Download PDF or Print
   ↓
7. Get formatted report
```

---

## Features in Detail

### Tab 1: Latest Result Card

**Shows**:
- School logo and name
- Student information (name, roll, class, section)
- Exam name and date
- Subject-wise marks table
- Total marks, percentage, grade
- Remarks (if any)

**Data Source**: `/api/fees/results/?student={studentId}`

**Logic**:
- Fetches all results for the student
- Sorts by date (most recent first)
- Displays the latest result

**If no results**: Shows "No result card available"

---

### Tab 2: Last Month Attendance

**Shows**:
- School logo and name
- Student information
- Date range (last 30 days)
- Summary cards:
  - Total Days
  - Present Days
  - Absent Days
  - Attendance Percentage
- Detailed attendance table with date, status, notes

**Data Source**: `/api/attendance/records/?student={studentId}&date_after={30 days ago}&date_before={today}`

**Logic**:
- Fetches attendance records for last 30 days
- Calculates statistics
- Displays in table format

**If no records**: Shows "No attendance records available"

---

## UI Components

### Header Section

```jsx
<Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
  <Stack direction="row" alignItems="center" spacing={2}>
    <Avatar src={studentInfo.user?.photo_url} sx={{ width: 64, height: 64 }} />
    <Box>
      <Typography variant="h4">{studentName}</Typography>
      <Stack direction="row" spacing={2}>
        <Chip label={`Class: ${classroom}`} />
        <Chip label={`Section: ${section}`} />
        <Chip label={`Roll: ${roll}`} />
      </Stack>
    </Box>
  </Stack>
</Paper>
```

### Tabs

```jsx
<Tabs value={selectedTab} onChange={(e, newValue) => setSelectedTab(newValue)}>
  <Tab icon={<AssessmentIcon />} label="Latest Result Card" />
  <Tab icon={<CalendarIcon />} label="Last Month Attendance" />
</Tabs>
```

### Action Buttons

```jsx
<Button startIcon={<DownloadIcon />} onClick={downloadPDF}>
  Download PDF
</Button>
<Button startIcon={<PrintIcon />} onClick={printReport}>
  Print
</Button>
```

---

## PDF Generation

Uses `html2canvas` and `jspdf` to convert the report to PDF:

```javascript
const downloadPDF = async () => {
  const canvas = await html2canvas(reportsRef.current, {
    scale: 2,
    useCORS: true,
    logging: false
  });
  
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(`${studentName}_Report.pdf`);
};
```

---

## Styling

### Gradient Header

```jsx
background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
```

### Hover Effect on Cards

```jsx
'&:hover': {
  transform: 'translateY(-4px)',
  boxShadow: 4
}
```

### Color-Coded Summary Cards

- **Total Days**: Blue (`#e3f2fd`)
- **Present**: Green (`#e8f5e9`)
- **Absent**: Red (`#ffebee`)
- **Percentage**: Orange (`#fff3e0`)

---

## API Endpoints Used

### 1. Get Student Info
```
GET /api/academics/students/{studentId}/
```

### 2. Get School Info
```
GET /api/schools/{schoolId}/
```

### 3. Get Results
```
GET /api/fees/results/?student={studentId}
```

### 4. Get Attendance
```
GET /api/attendance/records/?student={studentId}&date_after={date}&date_before={date}
```

---

## Testing Checklist

### Test 1: Navigate to Student Dashboard
- [ ] Go to Students page
- [ ] Select a class
- [ ] Click on a student card
- [ ] Student dashboard opens ✅
- [ ] URL is `/school/{id}/student/{studentId}/dashboard` ✅

### Test 2: View Result Card
- [ ] Dashboard opens on Results tab
- [ ] If student has results: Result card displays ✅
- [ ] Shows student info, marks, grade ✅
- [ ] If no results: "No result card available" ✅

### Test 3: View Attendance
- [ ] Click Attendance tab
- [ ] Summary cards show statistics ✅
- [ ] Table shows attendance records ✅
- [ ] Dates are formatted correctly ✅
- [ ] If no records: "No attendance records" ✅

### Test 4: Download PDF
- [ ] Click "Download PDF" button
- [ ] PDF generates successfully ✅
- [ ] PDF contains the report ✅
- [ ] File name is correct ✅

### Test 5: Print Report
- [ ] Click "Print" button
- [ ] Print dialog opens ✅
- [ ] Report is printable ✅

### Test 6: Navigation
- [ ] Click back arrow
- [ ] Returns to Students page ✅
- [ ] Can navigate to another student ✅

---

## Example Data Flow

### Result Card Example

**API Response**:
```json
{
  "id": 1,
  "student": 848,
  "exam_name": "Mid-Term Exam",
  "subjects": [
    {
      "subject_name": "Mathematics",
      "marks_obtained": 85,
      "total_marks": 100,
      "grade": "A"
    },
    {
      "subject_name": "English",
      "marks_obtained": 78,
      "total_marks": 100,
      "grade": "A-"
    }
  ],
  "total_marks_obtained": 163,
  "total_marks": 200,
  "percentage": 81.5,
  "grade": "A",
  "remarks": "Excellent performance",
  "created_at": "2025-01-10T10:00:00Z"
}
```

**Displayed As**:
```
📊 Result Card

Student Name: Md. Tamim Rahat
Roll Number: 12
Class: Class 8
Section: Section A
Exam: Mid-Term Exam
Date: 10 Jan 2025

Subject         Marks    Total    Grade
Mathematics     85       100      A
English         78       100      A-

Total Marks: 163/200
Percentage: 81.5%
Grade: A

Remarks: Excellent performance
```

---

### Attendance Example

**API Response**:
```json
[
  {
    "id": 1,
    "student": 848,
    "date": "2025-01-10",
    "present": true,
    "note": ""
  },
  {
    "id": 2,
    "student": 848,
    "date": "2025-01-09",
    "present": false,
    "note": "Sick leave"
  }
]
```

**Displayed As**:
```
📅 Attendance Report (Last 30 Days)

Period: 11 Dec 2024 - 10 Jan 2025

Total Days: 20
Present: 18
Absent: 2
Attendance: 90.0%

Date              Status      Note
10 Jan 2025 (Fri) ✅ Present  -
09 Jan 2025 (Thu) ❌ Absent   Sick leave
...
```

---

## Responsive Design

### Mobile View
- Single column layout
- Stacked summary cards
- Scrollable tables
- Touch-friendly buttons

### Tablet View
- Two-column summary cards
- Wider tables
- Better spacing

### Desktop View
- Four-column summary cards
- Full-width tables
- Optimal spacing

---

## Error Handling

### Student Not Found
```jsx
if (!studentInfo) {
  return (
    <Alert severity="error">Student not found</Alert>
    <Button onClick={() => navigate('/school/{id}/students')}>
      Back to Students
    </Button>
  );
}
```

### No Results
```jsx
<Alert severity="info">
  No result card available for this student
</Alert>
```

### No Attendance
```jsx
<Alert severity="info">
  No attendance records available for the last 30 days
</Alert>
```

---

## Files Modified/Created

### Created
```
frontend/src/pages/StudentDashboard.jsx (new file, 748 lines)
```

### Modified
```
frontend/src/components/StudentCard.jsx
- Added onClick prop
- Added hover effects
- Made card clickable

frontend/src/pages/StudentsPage.jsx
- Updated onClick to navigate to dashboard

frontend/src/App.jsx
- Added StudentDashboard import
- Added new route
```

---

## Summary

### What You Can Do Now

1. ✅ Click on any student card
2. ✅ View their latest result card
3. ✅ View their last month attendance
4. ✅ Download reports as PDF
5. ✅ Print reports
6. ✅ Navigate back to students list

### Benefits

- **For Teachers**: Quick access to student performance
- **For Administrators**: Easy monitoring of individual students
- **For Parents**: Can be shared with parents
- **For Students**: Professional-looking reports

---

## Next Steps

1. **Refresh browser** (Ctrl+Shift+R)
2. **Go to Students page**
3. **Click on any student card**
4. **Explore the dashboard!** 🎉

---

**The feature is complete and ready to use!** ✅
