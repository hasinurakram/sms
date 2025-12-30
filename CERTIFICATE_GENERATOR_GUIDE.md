# Certificate Generator System

## Overview
The Certificate Generator is a new feature that allows you to create professional certificates for students by simply entering their Roll Number and Session.

## Features
- **Simple Input**: Just enter Roll Number and Session (e.g., ২০২৪-২০২৫)
- **Professional Design**: Beautiful certificate template with school branding
- **Student Information**: Automatically fetches student details from the database
- **Print Ready**: Optimized for printing with proper layout and styling
- **Responsive Design**: Works on all screen sizes

## How to Use

### 1. Access the Certificate Generator
- Navigate to your school dashboard
- Click on "সার্টিফিকেট" (Certificate) in the menu
- Or go directly to: `/school/{school-id}/certificate`

### 2. Generate a Certificate
1. **Enter Roll Number**: Type the student's roll number (e.g., "1", "101", etc.)
2. **Enter Session**: Type the academic session (e.g., "২০২৪-২০২৫", "2024-2025")
3. **Click "সার্টিফিকেট তৈরি করুন"**: The system will search for the student and generate the certificate

### 3. Print the Certificate
- Once the certificate is generated, click "সার্টিফিকেট প্রিন্ট করুন" (Print Certificate)
- Use your browser's print dialog to print on paper

## Certificate Design
The certificate includes:
- School logo and name
- Student name and photo
- Roll number and class information
- Academic session
- Professional borders and styling
- Date of issue
- Space for signature and school seal

## Technical Details

### API Integration
The system uses the existing student API:
- Endpoint: `/api/academics/students/?school={school-id}&roll_number={roll-number}`
- Automatically fetches student data including photo and class information

### Frontend Components
- **CertificateGenerator.jsx**: Main component with form and certificate display
- **Certificate Component**: Renders the actual certificate with professional styling

### Styling
- Material-UI components for consistent design
- Professional certificate layout with borders and typography
- Print-optimized CSS for high-quality printing

## Error Handling
- If no student is found with the given roll number, an error message is displayed
- If the API fails, the system shows an appropriate error message
- Form validation ensures both roll number and session are provided

## Browser Compatibility
- Works on all modern browsers
- Print functionality supported in Chrome, Firefox, Safari, and Edge
- Responsive design works on mobile and desktop

## Future Enhancements
Potential improvements for future versions:
- Bulk certificate generation for multiple students
- Different certificate templates (achievement, participation, etc.)
- Custom certificate text and messages
- Digital signature integration
- PDF export functionality

## Support
If you encounter any issues:
1. Check that the backend server is running
2. Verify the school ID is correct
3. Ensure the student exists in the database with the provided roll number
4. Check browser console for any JavaScript errors

## File Locations
- Frontend Component: `frontend/src/pages/CertificateGenerator.jsx`
- Route: Added to `frontend/src/App.jsx`
- Menu: Added to `frontend/src/pages/SchoolDashboard.jsx`
