import React from 'react';
import api from '../utils/api';
import { Box, Typography, Avatar } from '@mui/material';
import QRCode from 'qrcode.react';

export default function AdmissionCard({ data, school, exam }) {
  const user = data?.user || {};
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const className = data?.classroom?.name || 'N/A';
  const section = data?.section?.name ? `(${data.section.name})` : '';
  const rollNumber = data?.roll_number || 'N/A';

  // Process photo URL
  const processPhotoUrl = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return url;
    if (url.startsWith('http')) return url;
    const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
    if (url.startsWith('/media/')) return `${base}${url}`;
    if (url.startsWith('media/')) return `${base}/${url}`;
    return `${base}/media/${url.replace(/^\/+|\/+$/g, '')}`;
  };

  const schoolLogo = processPhotoUrl(school?.logo);
  const userPhoto = processPhotoUrl(user.photo_url || user.photo || data.photo);
  const signatureUrl = (() => {
    try {
      if (school?.id && String(school.id) === '19') {
        const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/,'');
        return `${base}/media/BHS/signature.png`;
      }
    } catch (_) {}
    return '/images/signatures/signature.png';
  })();

  // QR Code data
  const qrData = JSON.stringify({
    type: 'admission_card',
    student_id: data?.id,
    exam_id: exam?.id,
    roll_number: rollNumber,
    name: name,
    class: className,
    section: data?.section?.name || '',
    timestamp: new Date().toISOString()
  });

  return (
    <Box 
      key={`admission-card-${rollNumber || 'unknown'}`}
      className="admission-card" 
      sx={{
        background: 'linear-gradient(145deg, #f8f9ff 0%, #f0f4ff 100%)',
        borderRadius: '12px',
        color: '#1a237e',
        width: '100%',
        maxWidth: '420px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(26, 35, 126, 0.1)',
        position: 'relative',
        fontFamily: 'Hind Siliguri, Arial, sans-serif',
        border: '1px solid #e0e8ff',
        p: 3,
        lineHeight: 1.6,
        '&:hover': {
          boxShadow: '0 6px 24px rgba(26, 35, 126, 0.15)',
          transform: 'translateY(-2px)',
          transition: 'all 0.3s ease'
        }
      }}
    >
      {/* Header with Logo and Student Photo */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        mb: 2,
        padding: '12px',
        backgroundColor: '#1a237e',
        borderRadius: '8px',
        color: 'white'
      }}>
        {/* School Logo */}
        <Box sx={{ 
          width: '60px',
          height: '60px',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: '#f5f5f5'
        }}>
          {schoolLogo ? (
            <img 
              src={schoolLogo} 
              alt="School Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = 'Logo';
              }}
            />
          ) : 'Logo'}
        </Box>
        
        {/* School Info */}
        <Box sx={{ textAlign: 'center', flex: 1, px: 2 }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 'bold', 
            fontSize: '1.2rem',
            mb: 0.5,
            lineHeight: 1.2
          }}>
            {school?.name || 'স্কুল নাম'}
          </Typography>
          <Typography variant="h5" sx={{ 
            fontSize: '1.3rem',
            fontWeight: 'bold',
            mb: 0.5,
            lineHeight: 1.2
          }}>
            প্রবেশপত্র
          </Typography>
          <Typography variant="body2" sx={{ 
            fontSize: '0.9rem',
            fontWeight: 500,
            lineHeight: 1.2
          }}>
            {exam?.name || 'বার্ষিক পরীক্ষা - ২০২৫'}
          </Typography>
        </Box>
        
        {/* Student Photo */}
        <Box sx={{ 
          width: '60px',
          height: '75px',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: '#f5f5f5'
        }}>
          {userPhoto ? (
            <img 
              src={userPhoto} 
              alt="Student" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = 'Photo';
              }}
            />
          ) : 'Photo'}
        </Box>
      </Box>

      {/* Student Info */}
      <Box sx={{ 
        mb: 2,
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <Typography variant="h6" sx={{ 
          fontWeight: 'bold',
          fontSize: '1.1rem',
          textAlign: 'center',
          mb: 1.5,
          lineHeight: 1.2
        }}>
          {name || 'খাদিজা আক্তার রিমা'}
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          <Typography variant="body2" sx={{ flex: '1 1 45%', minWidth: '120px' }}>
            <strong>Roll:</strong> {rollNumber || '১'}
          </Typography>
          <Typography variant="body2" sx={{ flex: '1 1 45%', minWidth: '120px' }}>
            <strong>Class:</strong> {className ? `${className} ${section}` : 'অষ্টম শ্রেণি (ক)'}
          </Typography>
          <Typography variant="body2" sx={{ flex: '1 1 100%' }}>
            <strong>Exam ID:</strong> {exam?.exam_id || 'N/A'}
          </Typography>
        </Box>
      </Box>

      {/* Exam Details */}
      <Box sx={{ 
        mb: 2, 
        border: '1px solid #d1d9ff', 
        borderRadius: '8px', 
        p: 2,
        backgroundColor: '#f8f9ff',
        boxShadow: '0 2px 8px rgba(26, 35, 126, 0.05)'
      }}>
        <Typography variant="subtitle2" sx={{ 
          fontWeight: 'bold', 
          mb: 1.5, 
          textAlign: 'center',
          borderBottom: '1px solid #e0e0e0',
          pb: 0.5
        }}>
          Exam Details:
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>তারিখ:</span> <span>২৬/১১/২০২৫</span>
          </Typography>
          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>সময়:</span> <span>সকাল ১০:০০</span>
          </Typography>
          <Typography variant="body2" sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            mt: 1,
            pt: 1,
            borderTop: '1px dashed #e0e0e0'
          }}>
            <span>Center:</span> <span style={{ textAlign: 'right' }}>{exam?.center || (school?.name || 'স্কুল নাম')}</span>
          </Typography>
        </Box>
      </Box>

      {/* Valid For */}
      <Box sx={{ 
        textAlign: 'center',
        mb: 2,
        mt: 2,
        fontSize: '0.85rem',
        color: '#555'
      }}>
        Valid for: Annual Exam 2025
      </Box>

      {/* Footer */}
      <Box sx={{
        mt: 3,
        pt: 3,
        borderTop: '2px dashed #d1d9ff'
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: 2
        }}>
          {/* Principal's Signature */}
          <Box sx={{ 
            textAlign: 'center', 
            flex: 1,
            maxWidth: '300px',
            pt: 1
          }}>
            <Box sx={{ 
              height: '60px',
              borderBottom: '2px solid #1a237e',
              mb: 0.5,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              pb: 0.5,
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: 'url("/images/signatures/seal.png")',
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                opacity: 0.2,
                zIndex: 0
              }
            }}>
              {signatureUrl && (
                <img 
                  src={signatureUrl} 
                  alt="Principal's Signature" 
                  style={{ 
                    maxHeight: '50px',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    position: 'relative',
                    zIndex: 2,
                    opacity: 1
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
            </Box>
            <Typography variant="body2" sx={{ 
              fontWeight: 'bold',
              fontSize: '0.85rem'
            }}>
              প্রধান শিক্ষক
            </Typography>
          </Box>

                  </Box>
      </Box>
    </Box>
  );
}
