import React from 'react';
import { Box, Typography, Avatar, Divider, IconButton, Tooltip } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import QRCode from 'qrcode.react';
import './IDCard.css';
import api from '../utils/api';

export default function IDCard({ type = 'student', data, school, overridePhone, signatureUrl: propSignatureUrl }) {
  const defaultSignatureUrl = '/images/signatures/signature.png';
  const signatureUrl = (() => {
    if (propSignatureUrl) return propSignatureUrl;
    try {
      if (school?.id && String(school.id) === '19') {
        const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/,'');
        return `${base}/media/BHS/signature.png`;
      }
    } catch (_) {}
    return defaultSignatureUrl;
  })();
  const handlePrintSingle = () => {
    const printWindow = window.open('', '_blank');
    const cardElement = document.getElementById(`id-card-${data.id}`);
    if (cardElement && printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>ID Card - ${data?.user?.username || 'User'}</title>
            <style>
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              @media print {
                body { margin: 0; padding: 0; }
                .no-print { display: none !important; }
              }
            </style>
          </head>
          <body>
            ${cardElement.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };
  const isStudent = type === 'student';
  const user = data?.user || {};
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;

  // Function to process photo URLs
  const processPhotoUrl = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return url;
    if (url.startsWith('http')) return url;
    const base = api.defaults?.baseURL || (process.env.REACT_APP_API_URL || window.location.origin);
    const cleanedBase = String(base).replace(/\/+$/,'');
    if (url.startsWith('/media/')) return `${cleanedBase}${url}`;
    if (url.startsWith('media/')) return `${cleanedBase}/${url}`;
    return `${cleanedBase}/media/${url.replace(/^\/+|\/+$/g, '')}`;
  };

  const schoolLogo = processPhotoUrl(school?.logo);
  const userPhoto = processPhotoUrl(user.photo_url || user.photo || data.photo);
  
  // Generate QR code data
  const qrData = JSON.stringify({
    type: type,
    id: data?.id,
    name: name,
    school: school?.name,
    roll: isStudent ? data?.roll_number : null,
    username: user.username,
    timestamp: new Date().toISOString()
  });

  return (
    <Box className="id-card-wrapper" sx={{ position: 'relative' }}>
      {/* Print Button */}
      <Tooltip title="Print this card" className="no-print">
        <IconButton
          onClick={handlePrintSingle}
          sx={{
            position: 'absolute',
            top: -10,
            right: -10,
            bgcolor: 'primary.main',
            color: 'white',
            zIndex: 10,
            '&:hover': { bgcolor: 'primary.dark' },
            boxShadow: 2
          }}
          size="small"
        >
          <PrintIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Box id={`id-card-${data.id}`}>
      {/* Front Side */}
      <Box className="id-card id-card-front" sx={{ 
        background: 'linear-gradient(160deg, #0ea5e9 0%, #6366f1 100%)',
        borderRadius: 2,
        color: 'white',
        position: 'relative',
        boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '420px' // Ensure enough space for all content
      }}>
        {/* Header Section */}
        <Box sx={{ 
          bgcolor: 'rgba(0,0,0,0.3)', 
          backdropFilter: 'blur(10px)',
          p: 1.5,
          textAlign: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: '25%',
            width: '50%',
            height: '2px',
            background: 'rgba(255,255,255,0.5)'
          }
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 1 }}>
            {schoolLogo && (
              <Avatar 
                src={schoolLogo} 
                sx={{ 
                  width: 40, 
                  height: 40, 
                  border: '2px solid rgba(255,255,255,0.9)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }} 
              />
            )}
            <Box>
              <Typography variant="subtitle1" sx={{ 
                fontWeight: 900, 
                lineHeight: 1.1, 
                letterSpacing: 0.5,
                fontSize: '1.1rem',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)'
              }}>
                {school?.name || 'School Name'}
              </Typography>
              <Typography variant="caption" sx={{ 
                opacity: 0.9, 
                fontSize: '0.65rem',
                letterSpacing: 0.5,
                display: 'block',
                mt: 0.5
              }}>
                {school?.address || 'School Address'}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ 
            bgcolor: 'rgba(255,255,255,0.25)', 
            display: 'inline-block',
            px: 1.5, 
            py: 0.3, 
            borderRadius: 1, 
            fontSize: '0.7rem', 
            fontWeight: 700,
            mt: 1,
            letterSpacing: 1,
            textTransform: 'uppercase'
          }}>
            {isStudent ? 'Student Identity Card' : 'Teacher Identity Card'}
          </Box>
        </Box>

        {/* Photo Section - Centered */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          py: 3,
          px: 1.5,
          flex: '1 0 auto'
        }}>
          <Box sx={{
            position: 'relative',
            width: 140,
            height: 140,
            borderRadius: '50%',
            border: '5px solid rgba(255,255,255,0.95)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
            margin: '0 auto',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: '50%',
              border: '2px solid rgba(0,0,0,0.1)',
              pointerEvents: 'none'
            }
          }}>
            {userPhoto ? (
              <img
                src={userPhoto}
                alt={name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block'
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <Box sx={{
              display: userPhoto ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              backgroundColor: '#f0f4f8',
              color: '#0ea5e9',
              fontSize: '3.5rem',
              fontWeight: 'bold'
            }}>
              {name && name.charAt(0) ? name.charAt(0).toUpperCase() : '?'}
            </Box>
          </Box>
        </Box>

        {/* Details Section - Centered */}
        <Box sx={{ 
          textAlign: 'center', 
          px: 2,
          pb: 1.5,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,  // Reduced gap
          justifyContent: 'space-between',
          minHeight: '180px'  // Ensure minimum height for content
        }}>
          <Box>
            <Typography variant="h6" sx={{ 
              fontWeight: 900, 
              lineHeight: 1.2, 
              mb: 1,
              textShadow: '0 2px 4px rgba(0,0,0,0.2)',
              fontSize: '1.1rem'
            }}>
              {name}
            </Typography>
            
            <Box sx={{ 
              bgcolor: 'rgba(255,255,255,0.15)', 
              borderRadius: 1, 
              p: 1,
              my: 1,
              mx: 'auto',
              width: '90%'
            }}>
              {isStudent ? (
                <>
                  <Typography variant="body2" sx={{ 
                    fontWeight: 700, 
                    mb: 0.3,
                    fontSize: '0.85rem'
                  }}>
                    Roll No: <Box component="span" sx={{ fontSize: '1rem' }}>{data?.roll_number || 'N/A'}</Box>
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    fontWeight: 700,
                    fontSize: '0.85rem'
                  }}>
                    Class: <Box component="span" sx={{ fontSize: '1rem' }}>{data?.classroom?.name || 'N/A'}</Box>
                    {data?.section && ` (${data.section.name})`}
                  </Typography>
                </>
              ) : (
                <>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.3 }}>
                    ID: {user.username || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Designation: Teacher
                  </Typography>
                </>
              )}
            </Box>
          </Box>

          {/* QR Code Section */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: 0.5,
            mt: 1,
            pt: 1
          }}>
            <Typography variant="caption" sx={{ 
              fontSize: '0.65rem', 
              fontWeight: 700, 
              opacity: 0.9,
              letterSpacing: 0.5,
              color: 'white'
            }}>
              SCAN FOR DETAILS
            </Typography>
            <Box sx={{ 
              bgcolor: 'white', 
              p: 0.8, 
              borderRadius: 1.5, 
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)' 
            }}>
              <QRCode value={qrData} size={64} level="M" />
            </Box>
            <Typography variant="caption" sx={{ 
              fontSize: '0.6rem', 
              opacity: 0.9,
              color: 'white',
              mt: 0.5
            }}>
              Valid: {new Date().getFullYear()} - {new Date().getFullYear() + 1}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Back Side */}
      <Box className="id-card id-card-back" sx={{ 
        background: 'linear-gradient(160deg, #14b8a6 0%, #84cc16 100%)',
        borderRadius: 2,
        p: 1.5,
        color: 'white',
        position: 'relative',
        boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
        mt: 2
      }}>
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, fontSize: '0.8rem', letterSpacing: 0.3 }}>
              গুরুত্বপূর্ণ নির্দেশনা
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', mb: 0.5 }}>
              • এই কার্ডটি {school?.name || 'School'}-এর সম্পত্তি
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', mb: 0.5 }}>
              • ক্যাম্পাসে অবস্থানের সময় সর্বদা কার্ডটি সঙ্গে রাখতে হবে
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', mb: 0.5 }}>
              • কার্ডটি পাওয়া গেলে অনুগ্রহ করে স্কুল অফিসে জমা দিন
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem' }}>
              • এই কার্ড হস্তান্তরযোগ্য নয়
            </Typography>
          </Box>

          <Box sx={{ bgcolor: 'rgba(255,255,255,0.2)', p: 1, borderRadius: 1 }}>
            <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem', fontWeight: 'bold' }}>
              জরুরি যোগাযোগ
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem' }}>
              স্কুল অফিস: {overridePhone || school?.phone || 'N/A'}
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.3)', pt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5, height: '30px' }}>
              <img
                src={signatureUrl}
                alt="Authorized Signature"
                style={{ width: '100%', maxWidth: '150px', height: 'auto', filter: 'brightness(0) invert(1)' }}
                onError={(e) => {
                  e.target.onerror = null; // Prevent infinite loop
                  e.target.src = '/images/signatures/headmaster.png'; // Fallback to default
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
              প্রধান শিক্ষক
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', fontSize: '0.6rem', opacity: 0.9, mt: 0.2 }}>
              {school?.name || 'School Name'}
            </Typography>
          </Box>
        </Box>
      </Box>
      </Box>
    </Box>
  );
}
