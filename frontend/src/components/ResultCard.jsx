import React from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Divider, Grid } from '@mui/material';
import './ResultCard.css';
import ImageWithFallback from './ImageWithFallback';
import api from '../utils/api';
import fallbackLogo from './fallback_logo.png';

export default function ResultCard({ studentData, results, overallResult, examination, school }) {
  const student = studentData?.student || {};
  const user = student.user || {};
  const studentName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const guardianName = (
    student.guardian_name || student.parent_name || student.father_name || student.mother_name ||
    student.guardian?.name || student.guardian?.full_name || student.father?.name || student.mother?.name ||
    user.guardian_name || user.parent_name || ''
  );
  
  // Subject order according to specified sequence
  const subjectOrder = [
    // Bangla
    'বাংলা', 'Bangla', 'Bengali',
    'বাংলা প্রথম পত্র', 'Bangla First Paper', 'বাংলা-১ম', 'Bangla 1st Paper',
    'বাংলা দ্বিতীয় পত্র', 'Bangla Second Paper', 'বাংলা-২য়', 'Bangla 2nd Paper',
    'বাংলা ১+২', 'Bangla 1+2',
    // English
    'ইংরেজি', 'ইংরেজী', 'English',
    'ইংরেজি প্রথম পত্র', 'English First Paper', 'ইংরেজী-১ম', 'English 1st Paper',
    'ইংরেজি দ্বিতীয় পত্র', 'English Second Paper', 'ইংরেজী-২য়', 'English 2nd Paper', 'ইংরেজি-২য়',
    'ইংরেজি ১+২', 'English 1+2',
    // Math
    'গণিত', 'Mathematics', 'সাধারণ গণিত', 'General Math',
    // Science
    'বিজ্ঞান', 'Science',
    // BGS
    'বাংলাদেশ ও বিশ্বপরিচয়', 'Bangladesh and Global Studies', 'বাংলাদেশ ও বিশ্বপরিয়',
    // ICT
    'তথ্য ও যোগাযোগ প্রযুক্তি', 'Ict', 'ICT', 'আইসিটি',
    // Religion
    'ধর্ম', 'Religion', 'ধর্ম ও নৈতিক শিক্ষা', 'Islam and Moral Education', 'হিন্দু ধর্ম', 'Hindu Religion',
    // Agriculture
    'কৃষি', 'Agriculture', 'কৃষি শিক্ষা',
    // Science Group
    'পদার্থ', 'Physics', 'পদার্থবিজ্ঞান',
    'রসায়ন', 'Chemistry',
    'জীববিজ্ঞান', 'Biology',
    'উচ্চতর গণিত', 'Higher Math', 'Higher Mathematics',
    // Humanities
    'ইতিহাস', 'History', 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা',
    'ভূগোল', 'Geography', 'ভূগোল ও পরিবেশ',
    'পৌরনীতি', 'Civics', 'পৌরনীতি ও নাগরিকতা',
    'অর্থনীতি', 'Economics',
    // Business
    'ব্যবসায় উদ্যোগ', 'Business Entrepreneurship',
    'ব্যবসায় শিক্ষা', 'Business Studies',
    'হিসাববিজ্ঞান', 'Accounting',
    'ফিন্যান্স', 'Finance', 'ফিন্যান্স ও ব্যাংকিং'
  ];

  // Function to sort results according to subject order
  const sortResultsBySubjectOrder = (resultsArray) => {
    if (!Array.isArray(resultsArray)) return [];
    
    // Helper to normalize subject name for matching
    const normalize = (name) => {
      if (!name) return '';
      // Remove text inside parentheses e.g., "Math (A)" -> "Math"
      let clean = name.replace(/\s*\(.*?\)\s*/g, '').trim();
      return clean;
    };

    return resultsArray.sort((a, b) => {
      const subjectA = a.subject?.name || a.subject_name || '';
      const subjectB = b.subject?.name || b.subject_name || '';
      
      const cleanA = normalize(subjectA);
      const cleanB = normalize(subjectB);
      
      // Try exact match first, then clean match
      let indexA = subjectOrder.indexOf(subjectA);
      if (indexA === -1) indexA = subjectOrder.indexOf(cleanA);
      
      // Also check if subjectOrder has the variation (e.g. English 2nd vs English-2nd)
      if (indexA === -1) {
          // Try to find if any key in subjectOrder is contained in the subject name
          indexA = subjectOrder.findIndex(key => subjectA === key || cleanA === key);
      }
      
      let indexB = subjectOrder.indexOf(subjectB);
      if (indexB === -1) indexB = subjectOrder.indexOf(cleanB);
      if (indexB === -1) {
          indexB = subjectOrder.findIndex(key => subjectB === key || cleanB === key);
      }
      
      // If both subjects are in the order list, sort by their order
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // If only one subject is in the order list, put it first
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // If neither subject is in the order list, sort alphabetically
      return subjectA.localeCompare(subjectB, 'bn');
    });
  };
  
  
  
  const resolveMediaUrl = (raw) => {
    try {
      const val = typeof raw === 'string' ? raw : (raw || '');
      if (!val) return '';
      if (/^https?:\/\//i.test(val)) return val;
      const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
      let normalized = val.replace(/\\/g, '/');
      if (/(^|[\\/])media[\\/]/i.test(val)) {
        const rel = String(val).replace(/^.*?[\\/](media[\\/].*)$/i, '$1').replace(/\\/g, '/');
        normalized = rel;
      } else if (/\/media\//i.test(normalized)) {
        const idx = normalized.toLowerCase().indexOf('/media/');
        normalized = normalized.slice(idx + 1);
      }
      if (!normalized || normalized === '/' || normalized === 'media' || normalized === '/media' || normalized === '/media/') return '';
      if (normalized.startsWith('/')) return `${base}${normalized}`;
      if (/^media\//i.test(normalized)) return `${base}/${normalized}`;
      return `${base}/media/${normalized}`;
    } catch (_) {
      return '';
    }
  };

  // School logo URL handling with relative path
  const logoSrc = (() => {
    // First try to use the school logo from the school data
    const schoolLogo = school?.logo || school?.img || school?.logo_url || school?.image;
    if (schoolLogo) {
      return resolveMediaUrl(schoolLogo);
    }
    
    // Fallback to the direct path (relative to public folder)
    return '/media/school_logos/logo_CBwqhuz.png';
  })();

  // Resolve student photo URL similar to StudentCard
  const resolvePhotoUrl = (raw) => {
    try {
      const val = typeof raw === 'string' ? raw : (raw || '');
      if (!val) return null;
      if (/^https?:\/\//i.test(val)) return val;
      const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
      const normalized = val.replace(/\\/g, '/');
      if (!normalized || normalized === '/' || normalized === 'media' || normalized === '/media' || normalized === '/media/') return null;
      if (normalized.startsWith('/')) return `${base}${normalized}`;
      if (/^media\//i.test(normalized)) return `${base}/${normalized}`;
      return `${base}/media/${normalized}`;
    } catch (_) {
      return raw || null;
    }
  };

  const rawPhoto = user?.photo_url || user?.photo || user?.profile_picture || null;
  const studentPhotoUrl = resolvePhotoUrl(rawPhoto);
  
  const getGradeColor = (grade) => {
    const colors = {
      'A+': '#4caf50',
      'A': '#66bb6a',
      'A-': '#81c784',
      'B': '#29b6f6',
      'C': '#ffa726',
      'D': '#ff7043',
      'F': '#ef5350'
    };
    return colors[grade] || '#757575';
  };
  const isClassNineOrTen = () => {
    try {
      const sources = [
        student?.classroom?.name,
        student?.classroom?.display_name,
        examination?.classroom?.name,
        examination?.class_name,
        examination?.name
      ].filter(Boolean).map(s => String(s).toLowerCase());
      const text = sources.join(' ');
      return /নবম|দশম|\b9\b|\b10\b|\bnine\b|\bten\b|\bix\b|\bx\b|class\s*9|class\s*10/.test(text);
    } catch (_) { return false; }
  };
  const isBanglaFirst = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
    return n.includes('বাংলা প্রথম') || n.includes('bangla first') || n.includes('বাংলা-১') || n.includes('1st');
  };
  const isBanglaSecond = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
    return n.includes('বাংলা দ্বিত') || n.includes('bangla second') || n.includes('বাংলা-২') || n.includes('2nd');
  };
  const isBanglaGeneric = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
    return n === 'বাংলা' || n === 'bangla' || n === 'bengali';
  };
  const isBanglaPaper = (name) => isBanglaFirst(name) || isBanglaSecond(name);
  const banglaCombinedPass = () => {
    try {
      const list = (results || []).filter(r => isBanglaPaper(r.subject?.name || r.subject_name));
      if (!list.length) return false;
      const passMarks = parseFloat(examination?.pass_marks) || 33;
      const sumCQ = list.reduce((s, r) => s + (parseFloat(r.written_marks) || 0), 0);
      const sumMCQ = list.reduce((s, r) => s + (parseFloat(r.mcq_marks) || 0), 0);
      return (sumCQ >= passMarks) && (sumMCQ >= passMarks);
    } catch (_) { return false; }
  };
  const isEnglishFirst = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
    return n.includes('ইংরেজি প্রথম') || n.includes('ইংরেজী প্রথম') || n.includes('english first') || n.includes('ইংরেজি-১') || n.includes('ইংরেজী-১') || /(^|\s)1st(\s|$)/.test(n);
  };
  const isEnglishSecond = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
    return n.includes('ইংরেজি দ্বিত') || n.includes('ইংরেজী দ্বিত') || n.includes('english second') || n.includes('ইংরেজি-২') || n.includes('ইংরেজী-২') || /(^|\s)2nd(\s|$)/.test(n);
  };
  const isEnglishGeneric = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
    return n === 'ইংরেজি' || n === 'ইংরেজী' || n === 'english';
  };
  const isEnglishPaper = (name) => isEnglishFirst(name) || isEnglishSecond(name) || isEnglishGeneric(name);
  const englishCombinedPass = () => {
    try {
      const list = (results || []).filter(r => isEnglishPaper(r.subject?.name || r.subject_name));
      if (!list.length) return false;
      const passMarks = parseFloat(examination?.pass_marks) || 33;
      const sumCQ = list.reduce((s, r) => s + (parseFloat(r.written_marks) || 0), 0);
      return (sumCQ >= passMarks);
    } catch (_) { return false; }
  };

  // Determine pass/fail for display: if any subject failed, Final Result is Failed.
  const hasAnySubjectFail = Array.isArray(results) && (() => {
    const combinedOkBangla = isClassNineOrTen() ? banglaCombinedPass() : false;
    const combinedOkEnglish = isClassNineOrTen() ? englishCombinedPass() : false;
    return results.some(r => {
      const fail = (r?.grade === 'F') || (r?.is_passed === false);
      if (!fail) return false;
      const nm = r.subject?.name || r.subject_name || '';
      if (combinedOkBangla && isBanglaPaper(nm)) return false;
      if (combinedOkEnglish && isEnglishPaper(nm)) return false;
      return true;
    });
  })();
  const isPassedDisplay = !hasAnySubjectFail;

  const toBnDigits = (val) => {
    const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return String(val ?? '').replace(/[0-9]/g, d => bn[d] ?? d);
  };
  const examTypeLabelBn = (t) => {
    const m = {
      test: 'বিশেষ মূল্যায়ন',
      half_yearly: 'অর্ধবার্ষিক',
      annual: 'বার্ষিক',
      terminal: 'টার্মিনাল',
      model: 'মডেল টেস্ট',
      first_term: 'প্রথম টার্ম',
      final: 'ফাইনাল'
    };
    return m[t] || t || '';
  };
  const examHeaderText = (() => {
    const name = examination?.name;
    const year = examination?.academic_year || new Date().getFullYear();
    if (name && name.trim().length > 0) return `${name} - ${toBnDigits(year)} খ্রিঃ`;
    const t = examTypeLabelBn(examination?.exam_type);
    if (t) return `${t} পরীক্ষা- ${toBnDigits(year)} খ্রিঃ`;
    return `${toBnDigits(year)} খ্রিঃ`;
  })();
  const computeGrade = (percentage) => {
    if (percentage >= 80) return 'A+';
    if (percentage >= 70) return 'A';
    if (percentage >= 60) return 'A-';
    if (percentage >= 50) return 'B';
    if (percentage >= 40) return 'C';
    if (percentage >= 33) return 'D';
    return 'F';
  };
  const computeGpa = (percentage) => {
    if (percentage >= 80) return '5.00';
    if (percentage >= 70) return '4.00';
    if (percentage >= 60) return '3.50';
    if (percentage >= 50) return '3.00';
    if (percentage >= 40) return '2.00';
    if (percentage >= 33) return '1.00';
    return '0.00';
  };
  const getDisplayResults = () => {
    const arr = Array.isArray(results) ? results.slice() : [];
    if (!isClassNineOrTen()) return arr;
    const normalize = (s) => String(s || '').replace(/\s*\(.*?\)\s*/g, '').trim();
    const banglaPapers = arr.filter(r => isBanglaPaper(r.subject?.name || r.subject_name));
    const banglaGeneric = arr.filter(r => isBanglaGeneric(r.subject?.name || r.subject_name));
    const englishPapers = arr.filter(r => isEnglishPaper(r.subject?.name || r.subject_name));
    const out = arr.filter(r => {
      const n = normalize(r.subject?.name || r.subject_name);
      if (isBanglaPaper(n)) return false;
      if (isBanglaGeneric(n)) return false;
      if (isEnglishPaper(n)) return false;
      return true;
    });
    if (banglaPapers.length > 0 || banglaGeneric.length > 0) {
      const src = banglaPapers.length > 0 ? banglaPapers : banglaGeneric;
      const wRaw = src.reduce((s, r) => s + (parseFloat(r.written_marks) || 0), 0);
      const mRaw = src.reduce((s, r) => s + (parseFloat(r.mcq_marks) || 0), 0);
      const pRaw = src.reduce((s, r) => s + (parseFloat(r.practical_marks) || 0), 0);
      const w = Math.min(wRaw, 140);
      const m = Math.min(mRaw, 60);
      const p = 0;
      const obtained = src.reduce((s, r) => {
        const has = r.total_obtained != null && r.total_obtained !== '';
        const o = has ? (parseFloat(r.total_obtained) || 0) : ((parseFloat(r.written_marks) || 0) + (parseFloat(r.mcq_marks) || 0) + (parseFloat(r.practical_marks) || 0));
        return s + o;
      }, 0);
      const obtainedClamped = Math.min(w + m + p, 200);
      const possible = 200;
      const pct = possible > 0 ? Math.round((obtained / possible) * 100) : 0;
      out.push({
        subject: { name: 'বাংলা (১ম+২য়)' },
        written_marks: w,
        mcq_marks: m,
        practical_marks: p,
        total_obtained: obtainedClamped,
        total_marks: possible,
        grade: computeGrade(pct),
        gpa: computeGpa(pct),
        is_passed: pct >= 33
      });
    }
    if (englishPapers.length > 0) {
      const w = englishPapers.reduce((s, r) => s + (parseFloat(r.written_marks) || 0), 0);
      const m = englishPapers.reduce((s, r) => s + (parseFloat(r.mcq_marks) || 0), 0);
      const p = englishPapers.reduce((s, r) => s + (parseFloat(r.practical_marks) || 0), 0);
      const obtained = englishPapers.reduce((s, r) => {
        const has = r.total_obtained != null && r.total_obtained !== '';
        const o = has ? (parseFloat(r.total_obtained) || 0) : ((parseFloat(r.written_marks) || 0) + (parseFloat(r.mcq_marks) || 0) + (parseFloat(r.practical_marks) || 0));
        return s + o;
      }, 0);
      const possible = englishPapers.reduce((s, r) => {
        const ex = r.examination || {};
        const wm = parseFloat(ex.written_max) || 0;
        const mm = parseFloat(ex.mcq_max) || 0;
        const pm = parseFloat(ex.practical_max) || 0;
        const maxSum = (wm || mm || pm) ? (wm + mm + pm) : (parseFloat(ex.total_marks) || 100);
        const pMax = parseFloat(r.total_marks) || maxSum;
        return s + pMax;
      }, 0);
      const pct = possible > 0 ? Math.round((obtained / possible) * 100) : 0;
      out.push({
        subject: { name: 'ইংরেজি (১ম+২য়)' },
        written_marks: w,
        mcq_marks: m,
        practical_marks: p,
        total_obtained: obtained,
        total_marks: possible,
        grade: computeGrade(pct),
        gpa: computeGpa(pct),
        is_passed: pct >= 33
      });
    }
    return out;
  };
  const computeOverallTotalsFromDisplay = () => {
    const arr = Array.isArray(getDisplayResults()) ? getDisplayResults() : [];
    let obtained = 0;
    let possible = 0;
    for (const r of arr) {
      const o = (parseFloat(r.total_obtained) || ((parseFloat(r.written_marks) || 0) + (parseFloat(r.mcq_marks) || 0) + (parseFloat(r.practical_marks) || 0))) || 0;
      const ex = r.examination || {};
      const wm = parseFloat(ex?.written_max) || 0;
      const mm = parseFloat(ex?.mcq_max) || 0;
      const pm = parseFloat(ex?.practical_max) || 0;
      const hasExMax = (wm || mm || pm) > 0;
      const maxSum = hasExMax ? (wm + mm + pm) : (parseFloat(ex?.total_marks) || 0);
      const p = hasExMax ? maxSum : ((parseFloat(r.total_marks) || parseFloat(ex?.total_marks) || 100));
      obtained += o;
      possible += (p ?? o);
    }
    return { obtained, possible };
  };
  const overallTotals = computeOverallTotalsFromDisplay();
  const overallPercentage = overallTotals.possible > 0 ? Math.round((overallTotals.obtained / overallTotals.possible) * 100) : 0;
  const overallRows = Array.isArray(getDisplayResults()) ? getDisplayResults() : [];
  const anySubjectFailForOverall = overallRows.some(r => (r?.grade === 'F') || (r?.is_passed === false));
  const overallGradeDisplay = anySubjectFailForOverall ? 'F' : computeGrade(overallPercentage);
  const overallGpaDisplay = anySubjectFailForOverall ? '0.00' : computeGpa(overallPercentage);

  return (
    <Box className="result-card-container" sx={{ maxWidth: 900, mx: 'auto', bgcolor: 'white', p: { xs: 2, sm: 4 }, borderRadius: 2, boxShadow: 3 }}>
      {/* Header */}
      <Box sx={{ position: 'relative', textAlign: 'center', mb: 3, borderBottom: '3px solid #1976d2', pb: 2 }}>
        {/* School Logo - Top Left */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: { xs: '56px', sm: '80px' },
            height: { xs: '56px', sm: '80px' },
            borderRadius: '50%',
            border: '2px solid #1976d2',
            boxShadow: 2,
            overflow: 'hidden',
            bgcolor: 'background.paper'
          }}
          aria-label="School Logo"
        >
          <ImageWithFallback
            src={logoSrc}
            alt={school?.name || 'School Logo'}
            width="100%"
            height="100%"
            fallback={
              <img
                src={fallbackLogo}
                alt="School Logo"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
              />
            }
          />
        </Box>

        {/* Student Photo - Top Right */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: { xs: '56px', sm: '80px' },
            height: { xs: '56px', sm: '80px' },
            borderRadius: '50%',
            border: '2px solid #1976d2',
            boxShadow: 2,
            overflow: 'hidden',
            bgcolor: 'background.paper'
          }}
          aria-label="Student Photo"
        >
          <ImageWithFallback src={studentPhotoUrl} alt={studentName || 'Student Photo'} width="100%" height="100%" />
        </Box>
        
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1976d2', mb: 1, fontSize: { xs: '1.25rem', sm: '2rem' } }}>
          {(() => {
            console.log('School data in ResultCard:', { school, student, examination });
            return school?.name || student?.school_name || examination?.school_name || 'School Name';
          })()}
        </Typography>
        {/* Address Removed */}
        <Typography variant="h5" sx={{ mt: 2, fontWeight: 'bold', color: '#424242', fontSize: { xs: '1.1rem', sm: '1.5rem' } }}>
          ACADEMIC RESULT CARD
        </Typography>
      </Box>

      {/* Student Information */}
      <Grid container spacing={2} rowSpacing={2} sx={{ mb: 3, bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
        <Grid size={{ xs: 6 }}>
          <Typography variant="body2" color="text.secondary">Student Name:</Typography>
          <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 0.25 }}>{studentName}</Typography>
          {guardianName && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>অভিভাবক: {guardianName}</Typography>
          )}
        </Grid>
        <Grid size={{ xs: 6 }}>
          <Typography variant="body2" color="text.secondary">Roll Number:</Typography>
          <Typography variant="body1" sx={{ fontWeight: 'bold', mt: 0.25 }}>{student.roll_number || 'N/A'}</Typography>
        </Grid>
        <Grid size={{ xs: 6 }}>
          <Typography variant="body2" color="text.secondary">Class:</Typography>
          <Typography variant="body1" sx={{ fontWeight: 'bold', mt: 0.25 }}>
            {student.classroom?.name || 'N/A'} {student.section?.name ? `(${student.section.name})` : ''}
          </Typography>
        </Grid>
        <Grid size={{ xs: 6 }}>
          <Typography variant="body2" color="text.secondary">Examination:</Typography>
          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
            {(() => {
              const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
              const toBn = (v) => String(v ?? '').replace(/[0-9]/g, d => bn[d] ?? d);
              const map = {
                test: 'বিশেষ মূল্যায়ন',
                half_yearly: 'অর্ধবার্ষিক',
                annual: 'বার্ষিক',
                terminal: 'টার্মিনাল',
                model: 'মডেল টেস্ট',
                first_term: 'প্রথম টার্ম',
                final: 'ফাইনাল'
              };
              const year = examination?.academic_year || new Date().getFullYear();
              const t = map[examination?.exam_type] || examination?.exam_type || '';
              return t ? `${t} পরীক্ষা- ${toBn(year)} খ্রিঃ` : `${toBn(year)} খ্রিঃ`;
            })()}
          </Typography>
        </Grid>
      </Grid>

      {/* Marks Table */}
      <TableContainer component={Paper} sx={{ mb: 3, boxShadow: 2, overflowX: 'auto' }}>
        <Table size="small" sx={{ border: '2px solid #000', minWidth: 560 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#1976d2' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', border: '1px solid #fff', fontSize: { xs: '0.8rem', sm: '0.9rem' } }}>Subject</TableCell>
              <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', border: '1px solid #fff', fontSize: { xs: '0.8rem', sm: '0.9rem' } }}>CQ</TableCell>
              <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', border: '1px solid #fff', fontSize: { xs: '0.8rem', sm: '0.9rem' } }}>MCQ</TableCell>
              <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', border: '1px solid #fff', fontSize: { xs: '0.8rem', sm: '0.9rem' } }}>Practical</TableCell>
              <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', border: '1px solid #fff', fontSize: { xs: '0.8rem', sm: '0.9rem' } }}>Total</TableCell>
              <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', border: '1px solid #fff', fontSize: { xs: '0.8rem', sm: '0.9rem' } }}>Grade</TableCell>
              <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', border: '1px solid #fff', fontSize: { xs: '0.8rem', sm: '0.9rem' } }}>GPA</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Subject Results */}
            {results && results.length > 0 ? (
              sortResultsBySubjectOrder(getDisplayResults()).map((result, idx) => {
                return (
                  <TableRow key={idx}>
                    <TableCell sx={{ fontWeight: 500, border: '1px solid #ddd' }}>
                      {(() => {
                        const nm = result.subject?.name || result.subject_name || 'N/A';
                        if (isClassNineOrTen() && (isBanglaPaper(nm) || isEnglishPaper(nm))) {
                          // Append combined marker for 9-10
                          // Avoid duplicating if name already indicates 1+2
                          const low = String(nm).toLowerCase();
                          if (low.includes('১+২') || low.includes('1+2') || low.includes('১ম+২য়')) return `${nm}`;
                          return `${nm} (১ম+২য়)`;
                        }
                        return nm;
                      })()}
                    </TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ddd' }}>{parseFloat(result.written_marks) || 0}</TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ddd' }}>{parseFloat(result.mcq_marks) || 0}</TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ddd' }}>{parseFloat(result.practical_marks) || 0}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                      {(() => {
                        const hasObtained = result.total_obtained != null && result.total_obtained !== '';
                        const obtained = hasObtained
                          ? parseFloat(result.total_obtained) || 0
                          : ((parseFloat(result.written_marks) || 0) + (parseFloat(result.mcq_marks) || 0) + (parseFloat(result.practical_marks) || 0));
                        return obtained;
                      })()}
                    </TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ddd' }}>
                      <Box sx={{ 
                        display: 'inline-block', 
                        px: 1.5, 
                        py: 0.5, 
                        borderRadius: 1, 
                        bgcolor: getGradeColor(result.grade),
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        {result.grade || 'N/A'}
                      </Box>
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{result.gpa || '0.00'}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary', fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                  No subject-wise results available for this examination
                </TableCell>
              </TableRow>
            )}
            
            {/* Summary Row - Always show if overallResult exists */}
            {overallResult && (
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell colSpan={4} sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.1rem' }, border: '2px solid #000' }}>
                  TOTAL / OVERALL
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.1rem' }, border: '2px solid #000' }}>
                  {toBnDigits(overallTotals.obtained)} / {toBnDigits(overallTotals.possible)}
                </TableCell>
                <TableCell align="center" sx={{ border: '2px solid #000' }}>
                  <Box sx={{ 
                    display: 'inline-block', 
                    px: 2, 
                    py: 0.5, 
                    borderRadius: 1, 
                    bgcolor: getGradeColor(overallGradeDisplay),
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: { xs: '1rem', sm: '1.1rem' }
                  }}>
                    {overallGradeDisplay}
                  </Box>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: { xs: '1.1rem', sm: '1.2rem' }, color: getGradeColor(overallGradeDisplay), border: '2px solid #000' }}>
                  {toBnDigits(overallGpaDisplay)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Overall Result Summary */}
      {overallResult && (
        <Box sx={{ bgcolor: '#e3f2fd', p: 2, borderRadius: 2, mb: 2, border: '2px solid #1976d2' }}>
          <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1.5, textAlign: 'center' }}>
            OVERALL PERFORMANCE
          </Typography>
          <Grid container spacing={3} justifyContent="center">
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">Percentage</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                  {toBnDigits(
                    overallResult && overallResult.percentage != null
                      ? Math.round(parseFloat(overallResult.percentage))
                      : (overallTotals.possible > 0 ? Math.round((overallTotals.obtained / overallTotals.possible) * 100) : 0)
                  )}%
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">Position/Rank</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                  {overallResult.rank ? `${toBnDigits(overallResult.rank)}${getRankSuffix(overallResult.rank)}` : 'N/A'}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">Final Result</Typography>
                <Typography variant="h5" sx={{ 
                  fontWeight: 'bold', 
                  color: isPassedDisplay ? '#4caf50' : '#ef5350',
                  mt: 0.5
                }}>
                  {isPassedDisplay ? '✓ PASSED' : '✗ FAILED'}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}



      {/* Footer */}
      <Box sx={{ mt: 2, pt: 1.5, borderTop: '2px solid #e0e0e0' }}>
        <Grid container spacing={4}>
          <Grid size={{ xs: 4 }} sx={{ textAlign: 'center' }}>
            <Box sx={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.25 }}>
              <img
                src="/images/signatures/seal.png"
                alt="School Seal"
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain'
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </Box>
            <Divider sx={{ mb: 0.5, borderColor: '#000', width: '70%', mx: 'auto' }} />
            <Typography variant="caption">শ্রেণি শিক্ষক</Typography>
          </Grid>
          <Grid size={{ xs: 4 }} sx={{ textAlign: 'center' }}>
            <Box sx={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5, position: 'relative' }}>
              <img
                src="/images/signatures/seal.png"
                alt="School Seal"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '70%',
                  height: '70%',
                  objectFit: 'contain',
                  opacity: 0.25,
                  zIndex: 1
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <img
                src="/images/signatures/signature.png"
                alt="Headmaster's Signature"
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  position: 'relative',
                  zIndex: 2
                }}
                onError={(e) => {
                  e.target.onerror = null; // Prevent infinite loop
                  e.target.style.display = 'none';
                }}
              />
            </Box>
            <Divider sx={{ mb: 0.5, borderColor: '#000', width: '70%', mx: 'auto' }} />
            <Typography variant="caption">প্রধান শিক্ষক</Typography>
          </Grid>
          <Grid size={{ xs: 4 }} sx={{ textAlign: 'center' }}>
            <Box sx={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.25 }}>
              <img
                src="/images/signatures/seal.png"
                alt="School Seal"
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain'
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </Box>
            <Divider sx={{ mb: 0.5, borderColor: '#000', width: '70%', mx: 'auto' }} />
            <Typography variant="caption">অভিভাবকের স্বাক্ষর</Typography>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

function getRankSuffix(rank) {
  if (rank % 10 === 1 && rank % 100 !== 11) return 'st';
  if (rank % 10 === 2 && rank % 100 !== 12) return 'nd';
  if (rank % 10 === 3 && rank % 100 !== 13) return 'rd';
  return 'th';
}
