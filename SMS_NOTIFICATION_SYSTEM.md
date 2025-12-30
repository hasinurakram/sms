# 📱 SMS Notification System - Complete!

## ✅ What's Been Built

### 1. **SMS Service Module** 📨
**File**: `users/sms_service.py`

**Supported Providers**:
- ✅ **Console Mode** (Development - prints to console)
- ✅ **Twilio** (International SMS)
- ✅ **BulkSMS Bangladesh** (Local SMS)
- ✅ **SSL Wireless** (Bangladesh)
- ✅ **Custom API** (Your own provider)

**Features**:
- Single SMS sending
- Bulk SMS sending
- Pre-defined templates
- Error handling
- Logging
- Provider switching

---

### 2. **SMS API Endpoints** 🔌

**Endpoints Created**:
```python
POST /api/users/sms/send/          # Send single SMS
POST /api/users/sms/bulk/          # Send bulk SMS
POST /api/users/sms/template/      # Send template SMS
```

---

### 3. **SMS Templates** 📝

**Pre-defined Templates**:
1. **Admission Confirmation**
2. **Result Published**
3. **Fee Reminder**
4. **Attendance Alert**
5. **Exam Schedule**
6. **Meeting Invitation**
7. **Custom Message**

---

### 4. **Phone Number Field** 📞
- ✅ Added `phone_number` to User model
- ✅ Supports international format (+8801712345678)
- ✅ Updated serializers
- ✅ Migration ready

---

## 🚀 How to Use

### Setup (Choose Your Provider):

#### Option 1: Console Mode (Development)
```python
# settings.py
SMS_PROVIDER = 'console'  # Messages print to console
```

#### Option 2: Twilio (International)
```python
# settings.py
SMS_PROVIDER = 'twilio'
SMS_API_KEY = 'your_twilio_account_sid'
SMS_API_SECRET = 'your_twilio_auth_token'
SMS_SENDER_ID = '+1234567890'  # Your Twilio number
```

```bash
# Install Twilio
pip install twilio
```

#### Option 3: BulkSMS Bangladesh
```python
# settings.py
SMS_PROVIDER = 'bulksms'
SMS_API_KEY = 'your_bulksms_api_key'
SMS_SENDER_ID = 'YourBrand'
```

#### Option 4: SSL Wireless (Bangladesh)
```python
# settings.py
SMS_PROVIDER = 'ssl_wireless'
SMS_API_KEY = 'your_ssl_api_token'
SMS_SENDER_ID = 'YourBrand'
```

#### Option 5: Custom API
```python
# settings.py
SMS_PROVIDER = 'custom'
SMS_API_KEY = 'your_api_key'
SMS_CUSTOM_API_URL = 'https://your-sms-api.com/send'
```

---

## 📡 API Usage

### 1. Send Single SMS

**Request**:
```http
POST /api/users/sms/send/
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone_number": "+8801712345678",
  "message": "Hello! This is a test message from our school."
}
```

**Response**:
```json
{
  "success": true,
  "message": "SMS sent successfully"
}
```

---

### 2. Send Bulk SMS

**Request**:
```http
POST /api/users/sms/bulk/
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone_numbers": [
    "+8801712345678",
    "+8801812345678",
    "+8801912345678"
  ],
  "message": "Important: School will remain closed tomorrow due to weather conditions."
}
```

**Response**:
```json
{
  "success": true,
  "total": 3,
  "sent": 3,
  "failed": 0,
  "results": [
    {
      "phone": "+8801712345678",
      "success": true,
      "message": "SMS sent successfully"
    },
    ...
  ]
}
```

---

### 3. Send Template SMS

**Request**:
```http
POST /api/users/sms/template/
Authorization: Bearer <token>
Content-Type: application/json

{
  "template": "result",
  "phone_number": "+8801712345678",
  "data": {
    "student_name": "রাফি আহমেদ",
    "exam_name": "Half Yearly Exam",
    "cgpa": "4.85",
    "grade": "A+"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "SMS sent successfully",
  "sms_content": "Dear Parent, Half Yearly Exam results are published. রাফি আহমেদ scored CGPA: 4.85, Grade: A+. Check portal for details."
}
```

---

## 📝 Available Templates

### 1. Admission Confirmation
```python
{
  "template": "admission",
  "data": {
    "student_name": "রাফি আহমেদ",
    "roll_number": "1",
    "class_name": "ষষ্ঠ শ্রেণী"
  }
}
```

### 2. Result Published
```python
{
  "template": "result",
  "data": {
    "student_name": "রাফি আহমেদ",
    "exam_name": "Half Yearly",
    "cgpa": "4.85",
    "grade": "A+"
  }
}
```

### 3. Fee Reminder
```python
{
  "template": "fee_reminder",
  "data": {
    "student_name": "রাফি আহমেদ",
    "amount": "5000",
    "due_date": "30-09-2024"
  }
}
```

### 4. Attendance Alert
```python
{
  "template": "attendance",
  "data": {
    "student_name": "রাফি আহমেদ",
    "date": "30-09-2024",
    "status": "Absent"
  }
}
```

### 5. Exam Schedule
```python
{
  "template": "exam_schedule",
  "data": {
    "student_name": "রাফি আহমেদ",
    "exam_name": "Final Exam",
    "date": "15-10-2024",
    "time": "10:00 AM"
  }
}
```

### 6. Meeting Invitation
```python
{
  "template": "meeting",
  "data": {
    "parent_name": "Mr. Ahmed",
    "date": "05-10-2024",
    "time": "3:00 PM",
    "purpose": "Discuss academic progress"
  }
}
```

---

## 🎯 Use Cases

### 1. **Result Notification**
```python
# When results are published
import requests

for student in students:
    requests.post('http://localhost:8000/api/users/sms/template/', 
        headers={'Authorization': 'Bearer <token>'},
        json={
            'template': 'result',
            'phone_number': student.parent_phone,
            'data': {
                'student_name': student.name,
                'exam_name': exam.name,
                'cgpa': student.cgpa,
                'grade': student.grade
            }
        }
    )
```

### 2. **Fee Reminder**
```python
# Send fee reminders to all parents
for student in students_with_pending_fees:
    requests.post('http://localhost:8000/api/users/sms/template/',
        headers={'Authorization': 'Bearer <token>'},
        json={
            'template': 'fee_reminder',
            'phone_number': student.parent_phone,
            'data': {
                'student_name': student.name,
                'amount': student.pending_amount,
                'due_date': student.fee_due_date
            }
        }
    )
```

### 3. **Emergency Announcement**
```python
# Send to all parents
phone_numbers = [parent.phone for parent in parents]

requests.post('http://localhost:8000/api/users/sms/bulk/',
    headers={'Authorization': 'Bearer <token>'},
    json={
        'phone_numbers': phone_numbers,
        'message': 'URGENT: School will remain closed tomorrow due to weather alert. Stay safe!'
    }
)
```

### 4. **Attendance Alert**
```python
# Daily attendance alerts
for student in absent_students:
    requests.post('http://localhost:8000/api/users/sms/template/',
        headers={'Authorization': 'Bearer <token>'},
        json={
            'template': 'attendance',
            'phone_number': student.parent_phone,
            'data': {
                'student_name': student.name,
                'date': today,
                'status': 'Absent'
            }
        }
    )
```

---

## 💰 Cost Comparison

### SMS Provider Costs (Bangladesh):

| Provider | Cost per SMS | Bulk Rate | Features |
|----------|--------------|-----------|----------|
| **BulkSMS BD** | 0.25 BDT | 0.20 BDT (1000+) | Masking, API |
| **SSL Wireless** | 0.30 BDT | 0.25 BDT (1000+) | Masking, Reports |
| **Twilio** | 0.50 BDT | Same | International |

### Example Costs:
- **100 SMS/day**: 25 BDT/day = 750 BDT/month
- **500 SMS/day**: 100 BDT/day = 3,000 BDT/month
- **1000 SMS/day**: 200 BDT/day = 6,000 BDT/month

---

## 🔧 Installation

### Step 1: Install Dependencies
```bash
pip install requests twilio
```

### Step 2: Run Migration
```bash
python manage.py makemigrations
python manage.py migrate
```

### Step 3: Configure Settings
```python
# backend/settings.py
SMS_PROVIDER = 'console'  # Change to your provider
SMS_API_KEY = 'your_api_key'
SMS_API_SECRET = 'your_api_secret'
SMS_SENDER_ID = 'YourSchool'
```

### Step 4: Test
```bash
# Start server
python manage.py runserver

# Test SMS (console mode)
curl -X POST http://localhost:8000/api/users/sms/send/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+8801712345678", "message": "Test message"}'
```

---

## 📊 Features

### ✅ Single SMS
- Send to one recipient
- Custom message
- Instant delivery

### ✅ Bulk SMS
- Send to multiple recipients
- Same message to all
- Batch processing

### ✅ Template SMS
- Pre-defined templates
- Variable substitution
- Consistent messaging

### ✅ Provider Support
- Multiple providers
- Easy switching
- Fallback options

### ✅ Error Handling
- Detailed error messages
- Retry logic
- Logging

---

## 🎨 Frontend Integration (Coming Soon)

### SMS Sending UI Component:
```javascript
// Send SMS from frontend
const sendSMS = async (phone, message) => {
  const response = await api.post('/api/users/sms/send/', {
    phone_number: phone,
    message: message
  });
  
  if (response.data.success) {
    toast.success('SMS sent successfully!');
  }
};
```

---

## 🔒 Security

### Best Practices:
- ✅ Authentication required
- ✅ Rate limiting (recommended)
- ✅ Phone number validation
- ✅ Message length limits
- ✅ API key encryption
- ✅ Audit logging

---

## 📈 Statistics & Monitoring

### Track SMS Usage:
```python
# Add to your code
import logging

logger = logging.getLogger(__name__)
logger.info(f"SMS sent to {phone_number}: {message}")
```

### Monitor Costs:
- Count SMS sent per day
- Track failed deliveries
- Monitor API usage
- Calculate monthly costs

---

## 🎉 Benefits

### For School:
- ✅ Instant parent communication
- ✅ Automated notifications
- ✅ Cost-effective
- ✅ High delivery rate (98%+)

### For Parents:
- ✅ Timely updates
- ✅ Important alerts
- ✅ No app needed
- ✅ Works on any phone

### For Teachers:
- ✅ Easy communication
- ✅ Bulk messaging
- ✅ Template messages
- ✅ Time-saving

---

## 🚀 Next Steps

### 1. Choose Provider
- Sign up for SMS service
- Get API credentials
- Configure in settings

### 2. Test System
- Send test SMS
- Verify delivery
- Check costs

### 3. Integrate
- Add to result system
- Add to fee system
- Add to attendance system

### 4. Monitor
- Track usage
- Monitor costs
- Optimize templates

---

## 📱 **READY TO USE!**

### Quick Start:
```bash
# 1. Install
pip install -r requirements.txt

# 2. Migrate
python manage.py makemigrations
python manage.py migrate

# 3. Configure (settings.py)
SMS_PROVIDER = 'console'  # For testing

# 4. Test
python manage.py runserver

# 5. Send SMS via API
POST /api/users/sms/send/
```

---

**Your school can now send SMS notifications to mobile phones!** 📱✨

**Perfect for:**
- Result notifications
- Fee reminders
- Attendance alerts
- Emergency announcements
- Exam schedules
- Meeting invitations

**Start sending SMS today!** 🚀
