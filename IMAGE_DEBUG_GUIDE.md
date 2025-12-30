# Teacher Photo Debugging Guide 🔍

## Quick Diagnosis

### Step 1: Check Browser Console
1. Open your browser
2. Press **F12** to open DevTools
3. Go to **Console** tab
4. Look for lines like:
   ```
   Teacher: John Doe Photo URL: http://127.0.0.1:8000/media/user_photos/photo.jpg
   ```

### Step 2: Check Network Tab
1. In DevTools, go to **Network** tab
2. Filter by **Img** (images)
3. Refresh the page
4. Look for image requests
5. Check if they return **200 OK** or **404 Not Found**

### Step 3: Test Photo URL Directly
Copy the photo URL from console and paste it in a new browser tab:
```
http://127.0.0.1:8000/media/user_photos/filename.jpg
```

**If it loads**: Frontend issue (check React code)
**If it doesn't load**: Backend issue (check Django setup)

## Common Scenarios

### Scenario A: Photo URL is `null`
**Console shows:**
```
Teacher: John Doe Photo URL: null
```

**Cause**: No photo uploaded or field is empty

**Solution**:
1. Go to Add Teacher page
2. Upload a photo using the photo upload component
3. Save the teacher
4. Check if photo appears

### Scenario B: Photo URL exists but shows 404
**Console shows:**
```
Teacher: John Doe Photo URL: http://127.0.0.1:8000/media/user_photos/photo.jpg
Image failed to load: http://127.0.0.1:8000/media/user_photos/photo.jpg
```

**Network tab shows**: 404 Not Found

**Cause**: File doesn't exist at that path

**Solution**:
1. Check if file exists:
   ```bash
   # Windows
   dir media\user_photos\
   
   # Linux/Mac
   ls media/user_photos/
   ```

2. If folder doesn't exist, create it:
   ```bash
   mkdir media\user_photos
   ```

3. Check Django settings (`backend/settings.py`):
   ```python
   MEDIA_URL = '/media/'
   MEDIA_ROOT = BASE_DIR / 'media'
   ```

4. Check `backend/urls.py` has:
   ```python
   if settings.DEBUG:
       urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
   ```

### Scenario C: Photo URL is malformed
**Console shows:**
```
Teacher: John Doe Photo URL: /media/user_photos/photo.jpg
```
(Missing `http://127.0.0.1:8000`)

**Cause**: Backend not returning absolute URL

**Solution**: Already fixed! The frontend now handles this:
```javascript
const API_BASE = 'http://127.0.0.1:8000';
const cleanPath = photoPath.startsWith('/') ? photoPath : `/media/${photoPath}`;
return `${API_BASE}${cleanPath}`;
```

### Scenario D: CORS Error
**Console shows:**
```
Access to image at 'http://127.0.0.1:8000/media/...' from origin 'http://localhost:3000' 
has been blocked by CORS policy
```

**Cause**: CORS not configured for media files

**Solution**: Add to `backend/settings.py`:
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

CORS_ALLOW_CREDENTIALS = True
```

## Backend Checklist

### ✅ Django Settings
```python
# backend/settings.py

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

INSTALLED_APPS = [
    # ...
    'corsheaders',  # If using CORS
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # If using CORS
    # ...
]
```

### ✅ URLs Configuration
```python
# backend/urls.py

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # ... your URL patterns
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

### ✅ Model Field
```python
# users/models.py

class User(AbstractUser):
    photo = models.ImageField(upload_to='user_photos/', null=True, blank=True)
```

### ✅ Serializer
```python
# users/serializers.py or academics/serializers.py

class UserSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    
    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None
```

## Frontend Checklist

### ✅ API Base URL
```javascript
// TeacherCard.jsx

const API_BASE = 'http://127.0.0.1:8000';
```

### ✅ Photo URL Construction
```javascript
const getPhotoUrl = (teacherObj) => {
  if (!teacherObj) return null;
  
  const API_BASE = 'http://127.0.0.1:8000';
  
  // Priority 1: photo_url from backend
  if (teacherObj.photo_url) {
    return teacherObj.photo_url;
  }
  
  // Priority 2: Build from photo path
  const photoPath = teacherObj.photo || teacherObj.user?.photo;
  if (photoPath && typeof photoPath === 'string') {
    if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
      return photoPath;
    }
    const cleanPath = photoPath.startsWith('/') ? photoPath : `/media/${photoPath}`;
    return `${API_BASE}${cleanPath}`;
  }
  
  return null;
};
```

### ✅ Error Handling
```javascript
const [imageError, setImageError] = useState(false);

<Avatar 
  src={!imageError ? photoUrl : null}
  onError={() => {
    console.error('Image failed to load:', photoUrl);
    setImageError(true);
  }}
>
  {(!photoUrl || imageError) && <PersonIcon />}
</Avatar>
```

## Testing Steps

### Test 1: Upload New Photo
1. Go to Add Teacher page
2. Click on photo upload area
3. Select an image file (JPG, PNG)
4. Fill other fields
5. Click Save
6. Go to Teacher Cards page
7. **Expected**: Photo should appear

### Test 2: Check Existing Teacher
1. Open browser DevTools (F12)
2. Go to Console tab
3. Go to Teacher Cards page
4. Look for console logs showing photo URLs
5. Copy a photo URL
6. Paste it in a new browser tab
7. **Expected**: Image should load

### Test 3: API Response
1. Open browser DevTools (F12)
2. Go to Network tab
3. Go to Teacher Cards page
4. Find the API request (e.g., `/api/users/teachers/`)
5. Click on it
6. Go to Response tab
7. Look for `photo_url` field in the JSON
8. **Expected**: Should be an absolute URL like `http://127.0.0.1:8000/media/user_photos/photo.jpg`

## Manual File Check

### Windows
```cmd
cd d:\SchoolManagementSoftware
dir media\user_photos\
```

### Linux/Mac
```bash
cd /path/to/SchoolManagementSoftware
ls -la media/user_photos/
```

**Expected output**: List of image files

## Quick Fix Commands

### Create media folder if missing
```bash
# Windows
mkdir media\user_photos

# Linux/Mac
mkdir -p media/user_photos
```

### Check Django server is running
```bash
# Should show Django running on port 8000
netstat -ano | findstr :8000
```

### Restart Django server
```bash
# Stop current server (Ctrl+C)
# Then restart
python manage.py runserver
```

## Still Not Working?

### Last Resort Checklist
1. ✅ Django server is running on `http://127.0.0.1:8000`
2. ✅ Frontend is running on `http://localhost:3000`
3. ✅ Photo file exists in `media/user_photos/`
4. ✅ Photo URL in console is correct
5. ✅ Photo URL loads when pasted in browser
6. ✅ No CORS errors in console
7. ✅ No 404 errors in Network tab
8. ✅ Browser cache cleared (Ctrl+Shift+R)

### Get Help
If all above checks pass and images still don't load:
1. Take a screenshot of browser console
2. Take a screenshot of Network tab
3. Copy the exact photo URL from console
4. Check if the URL works in a new browser tab
5. Share the error message

## Success Indicators

✅ Console shows: `Teacher: John Doe Photo URL: http://127.0.0.1:8000/media/user_photos/photo.jpg`
✅ Network tab shows: `photo.jpg` with status **200 OK**
✅ Photo appears in the teacher card
✅ No errors in console
✅ Hover effects work smoothly

---

**Remember**: The new design includes debug logging, so always check the browser console first!
