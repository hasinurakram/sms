import React from 'react';
import { Box, Typography, Avatar, Divider, IconButton, Tooltip } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
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
              .id-card-front, .id-card-back { width: 54mm !important; min-height: 86mm !important; height: auto !important; }
              .id-card { page-break-inside: avoid; break-inside: avoid; margin: 5mm auto; }
              .id-card-back { padding-bottom: 12mm !important; position: relative; }
              * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
  const currentYear = new Date().getFullYear();
  const headPhone = overridePhone || school?.headmaster_phone || school?.head_teacher_phone || school?.principal_phone || school?.phone || null;
  const digitMapBn = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'};
  const toLatinDigits = (s) => String(s || '').replace(/[০-৯]/g, ch => digitMapBn[ch] || ch);
  const classWordMap = {'প্রথম':1,'১ম':1,'দ্বিতীয়':2,'দ্বিতীয়':2,'২য়':2,'২য়':2,'তৃতীয়':3,'তৃতীয়':3,'৩য়':3,'৩য়':3,'চতুর্থ':4,'৪র্থ':4,'পঞ্চম':5,'৫ম':5,'ষষ্ঠ':6,'৬ষ্ঠ':6,'সপ্তম':7,'৭ম':7,'অষ্টম':8,'৮ম':8,'নবম':9,'৯ম':9,'দশম':10,'১০ম':10,'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10};
  const romanMap = {'i':1,'ii':2,'iii':3,'iv':4,'v':5,'vi':6,'vii':7,'viii':8,'ix':9,'x':10};
  const getClassNumber = (nm) => {
    const n = String(nm || '').toLowerCase();
    for (const k in classWordMap) { if (n.includes(k)) return classWordMap[k]; }
    const roman = n.replace(/[^ivx]/g,'');
    if (roman && romanMap[roman]) return romanMap[roman];
    const m = toLatinDigits(n).match(/\b(1[0-2]|[1-9])\b/);
    if (m) return parseInt(m[0],10);
    return null;
  };
  const getSectionCode = (secName) => {
    if (!secName) return '00';
    const raw = String(secName).trim();
    const s = raw.replace(/[()\[\]{}]/g, '').trim();
    const sl = s.toLowerCase();
    // Stream mapping: Science=01, Commerce=02, Humanities=03
    if (sl.includes('বিজ্ঞান') || sl.includes('science')) return '01';
    if (sl.includes('ব্যবসা') || sl.includes('ব্যবসায়') || sl.includes('ব্যবসায়') || sl.includes('commerce') || sl.includes('business')) return '02';
    if (sl.includes('মানবিক') || sl.includes('arts') || sl.includes('humanities')) return '03';
    const bnLetters = 'কখগঘঙচছজঝটঠডঢণতথদধনপফবভমযরলশষসহ';
    // Only accept single-letter sections; otherwise fallback to 00
    if (s.length === 1) {
      const idxBn = bnLetters.indexOf(s[0]);
      if (idxBn >= 0) return String(idxBn + 1).padStart(2, '0');
      const up = s.toUpperCase();
      if (/^[A-Z]$/.test(up)) return String(up.charCodeAt(0) - 64).padStart(2, '0');
    }
    // If numeric section like "1", "02"
    const md = toLatinDigits(s).match(/^\d+$/) ? [s] : null;
    if (md) return String(parseInt(toLatinDigits(md[0]), 10)).padStart(2, '0');
    return '00';
  };
  const getStudentIdCode = () => {
    if (!isStudent) return '';
    const year = String(new Date().getFullYear());
    const clsNum = getClassNumber(data?.classroom?.name);
    const cls = clsNum != null ? String(clsNum).padStart(2,'0') : '00';
    const sec = getSectionCode(data?.section?.name);
    const rollDigits = (() => {
      const val = data?.roll_number;
      if (val === null || val === undefined) return null;
      const str = toLatinDigits(String(val));
      const m = str.match(/\d+/);
      return m ? m[0] : null;
    })();
    const roll = rollDigits != null ? String(parseInt(rollDigits,10)).padStart(2,'0') : '00';
    return `${year}${cls}${sec}${roll}`;
  };
  const studentIdCode = getStudentIdCode();

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
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '360px'
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
                    mb: 0.3,
                    fontSize: '0.85rem'
                  }}>
                    ID: <Box component="span" sx={{ fontSize: '1rem' }}>{studentIdCode || 'N/A'}</Box>
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

          {/* QR/Validity removed for compact front side */}
        </Box>
      </Box>

      {/* Back Side */}
      <Box className="id-card id-card-back" sx={{ 
        background: 'linear-gradient(160deg, #14b8a6 0%, #84cc16 100%)',
        borderRadius: 2,
        p: 1.5,
        pb: 3,
        color: 'white',
        position: 'relative',
        boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
        mt: 2
      }}>
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
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
              স্কুল: {school?.name || 'N/A'}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem' }}>
              প্রধান শিক্ষক: {headPhone || 'N/A'}
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.3)', pt: 1, mt: 'auto', mb: '18px' }}>
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
        <Box sx={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
          <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.95 }}>
            Valid: জানুয়ারি {currentYear} - ডিসেম্বর {currentYear}
          </Typography>
        </Box>
      </Box>
      </Box>
    </Box>
  );
}
