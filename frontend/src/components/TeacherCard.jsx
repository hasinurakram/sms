import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Avatar, 
  Stack, 
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Badge
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';
import PhotoUpload from './PhotoUpload';
import api from '../utils/api';
import { useToast } from './Toast';

/**
 * TeacherCard component
 * Displays teacher information including picture, full name, subject, and mobile number
 */
export default function TeacherCard({ teacher, onPhotoUploaded }) {
  const toast = useToast();
  const navigate = useNavigate();
  
  // Extract teacher information
  const fullName = `${teacher.first_name || ''}${teacher.last_name ? ' ' + teacher.last_name : ''}`.trim() || 
                   (teacher.user ? `${teacher.user.first_name || ''}${teacher.user.last_name ? ' ' + teacher.user.last_name : ''}`.trim() : '') || 
                   teacher.username || 
                   (teacher.user ? teacher.user.username : '') || 
                   'Unknown';
  
  const handlePhotoChange = async (file) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!file) return;
    
    const formData = new FormData();
    formData.append('photo', file);
    
    try {
      const teacherId = teacher.id || teacher.user?.id;
      if (!teacherId) {
        toast.error('Teacher ID not found');
        return;
      }
      
      await api.patch(`/api/users/teachers/${teacherId}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Photo uploaded successfully');
      if (onPhotoUploaded) onPhotoUploaded();
    } catch (err) {
      console.error('Photo upload error:', err);
      toast.error('Failed to upload photo');
    }
  };
                   
  // Get photo URL from multiple possible sources
  const getPhotoUrl = (teacherObj) => {
    if (!teacherObj) return null;
    
    const API_BASE = (api.defaults?.baseURL || process.env.REACT_APP_API_URL || window.location.origin);
    
    // Priority 1: Direct photo_url (absolute URL from backend)
    if (teacherObj.photo_url) {
      return teacherObj.photo_url;
    }
    
    // Priority 2: Check user object for photo_url
    if (teacherObj.user?.photo_url) {
      return teacherObj.user.photo_url;
    }
    
    // Priority 3: Check nested teacher object for photo_url
    if (teacherObj.teacher?.photo_url) {
      return teacherObj.teacher.photo_url;
    }
    
    // Priority 4: Handle photo path (relative or absolute)
    const photoPath = teacherObj.photo || teacherObj.user?.photo || teacherObj.teacher?.photo;
    if (photoPath && typeof photoPath === 'string') {
      // If already absolute URL, return as-is
      if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
        return photoPath;
      }
      // Build absolute URL from relative path
      const cleanPath = photoPath.startsWith('/') ? photoPath : `/media/${photoPath}`;
      return `${String(API_BASE).replace(/\/+$/,'')}${cleanPath}`;
    }
    
    return null;
  };
  
  const photoUrl = getPhotoUrl(teacher);
  const [imageError, setImageError] = useState(false);
  
  // Get subject from multiple possible sources
  const subject = teacher.subject?.name || 
                 (teacher.assignments && teacher.assignments.length > 0 ? teacher.assignments[0].subject?.name : null) ||
                 'Not assigned';
                 
  // Get mobile number from multiple possible sources
  const mobileNumber = teacher.mobile_number || 
                      teacher.phone_number || 
                      (teacher.user ? teacher.user.phone_number || teacher.user.mobile_number : null) || 
                      'Not available';
  
  // Get email
  const email = teacher.email || 
                (teacher.user ? teacher.user.email : null) || 
                '';

  // Get educational qualification
  const qualification = teacher.educational_qualification || 
                       (teacher.user ? teacher.user.educational_qualification : null) || 
                       '';

  // Debug: Log teacher data
  console.log('Teacher:', fullName);
  console.log('Teacher object:', teacher);
  console.log('Photo URL:', photoUrl);
  console.log('Educational Qualification:', qualification);

  return (
    <Card 
      sx={{ 
        borderRadius: 4, 
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        '&:hover': { 
          transform: 'translateY(-8px) scale(1.02)', 
          boxShadow: '0 16px 48px rgba(102, 126, 234, 0.4)'
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '140px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          zIndex: 0
        }
      }}
    >
      <CardContent sx={{ position: 'relative', zIndex: 1, p: 3 }}>
        <Stack spacing={2.5} alignItems="center">
          {/* Teacher Photo with Badge and Upload */}
          <Box sx={{ position: 'relative' }}>
            {/* Photo Upload Component */}
            <PhotoUpload 
              currentPhoto={photoUrl} 
              onPhotoChange={handlePhotoChange} 
              userName={fullName}
            />
            
            {/* Badge */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: 'success.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid white',
                boxShadow: 2,
                zIndex: 2
              }}
            >
              <SchoolIcon sx={{ fontSize: 20, color: 'white' }} />
            </Box>
          </Box>
          
          {/* Teacher Name, Qualification and Subject */}
          <Box sx={{ textAlign: 'center', width: '100%' }}>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 'bold',
                color: 'white',
                textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                mb: 0.5
              }}
            >
              {fullName}
            </Typography>
            {qualification && (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: 'rgba(255,255,255,0.9)',
                  fontStyle: 'italic',
                  mb: 1,
                  textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                }}
              >
                {qualification}
              </Typography>
            )}
            <Chip 
              icon={<SchoolIcon sx={{ color: 'white !important' }} />}
              label={subject} 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.25)',
                color: 'white',
                fontWeight: 'bold',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                '& .MuiChip-icon': {
                  color: 'white'
                }
              }}
            />
          </Box>
          
          {/* Contact Information Card */}
          <Box 
            sx={{ 
              width: '100%',
              bgcolor: 'white',
              borderRadius: 3,
              p: 2.5,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            <Typography 
              variant="subtitle2" 
              sx={{ 
                mb: 2, 
                fontWeight: 'bold',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <PersonIcon fontSize="small" />
              Contact Information
            </Typography>
            
            <Stack spacing={1.5}>
              {/* Phone */}
              <Stack 
                direction="row" 
                spacing={1.5} 
                alignItems="center"
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'grey.50',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'primary.50',
                    transform: 'translateX(4px)'
                  }
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <PhoneIcon sx={{ fontSize: 18, color: 'white' }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                    Mobile
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 'bold',
                      color: 'text.primary',
                      wordBreak: 'break-all'
                    }}
                  >
                    {mobileNumber}
                  </Typography>
                </Box>
              </Stack>

              {/* Email */}
              {email && (
                <Stack 
                  direction="row" 
                  spacing={1.5} 
                  alignItems="center"
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'secondary.50',
                      transform: 'translateX(4px)'
                    }
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      bgcolor: 'secondary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <EmailIcon sx={{ fontSize: 18, color: 'white' }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Email
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: 'text.primary',
                        wordBreak: 'break-all',
                        fontSize: '0.85rem'
                      }}
                    >
                      {email}
                    </Typography>
                  </Box>
                </Stack>
              )}
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
