import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAcademics } from '../context/AcademicsContext';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  MenuItem,
  Paper,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import ResultCard from '../components/ResultCard';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { scopedGet } from '../utils/schoolApi';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function ResultCardGenerator() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { classrooms, refreshClassrooms } = useAcademics();
  
  const [examTypes, setExamTypes] = useState([
    { value: 'test', label: 'বিশেষ মূল্যায়ন' },
    { value: 'half_yearly', label: 'অর্ধবার্ষিক' },
    { value: 'annual', label: 'বার্ষিক' },
    { value: 'terminal', label: 'টার্মিনাল' },
    { value: 'model', label: 'মডেল টেস্ট' },
    { value: 'first_term', label: 'প্রথম টার্ম' },
    { value: 'final', label: 'ফাইনাল' }
  ]);
  const [selectedExamType, setSelectedExamType] = useState('');
  const [examinations, setExaminations] = useState([]);
  // classrooms state removed, using context
  const [selectedClass, setSelectedClass] = useState('');
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  
  // Result data
  const [studentData, setStudentData] = useState(null);
  const [results, setResults] = useState([]);
  const [overallResult, setOverallResult] = useState(null);
  const [school, setSchool] = useState(null);
  const [examination, setExamination] = useState(null);
  const [overrideLogo, setOverrideLogo] = useState('');
  const [noYearMessage, setNoYearMessage] = useState('');


  const isMounted = React.useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    refreshClassrooms(id)
      .then(data => {
        if (data && data.length > 0) {
          // toast.success(`Loaded ${data.length} classes`);
        } else {
          // toast.info('No classes found for this school');
        }
      })
      .catch(() => toast.error('Failed to load classes'));
    loadSchool();
  }, [id, refreshClassrooms]);

  // Apply deep-link query params and auto-generate if requested
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const qClass = qs.get('classroom');
    const qStudent = qs.get('student');
    const qExam = qs.get('exam_type');
    const qExamId = qs.get('exam');
    const qSection = qs.get('section');
    const qLogo = qs.get('logo') || qs.get('school_logo');
    const qAuto = qs.get('auto');
    let timeout;
    (async () => {
      try {
        if (qClass) {
          const numClass = parseInt(qClass, 10);
          setSelectedClass(Number.isNaN(numClass) ? '' : numClass);
          await refreshClassrooms(id);
          try {
            const secRes = await scopedGet('/api/academics/sections/', id, { classroom: Number.isNaN(numClass) ? qClass : numClass }, { timeout: 15000 });
            const secs = Array.isArray(secRes.data) ? secRes.data : secRes.data?.results || [];
            setSections(secs);
          } catch (_) {}
          if (qSection) {
            const numSec = parseInt(qSection, 10);
            let list = [];
            try {
              const studs = await scopedGet('/api/academics/students/', id, { classroom: Number.isNaN(numClass) ? qClass : numClass, section: Number.isNaN(numSec) ? qSection : numSec }, { timeout: 30000 });
              list = Array.isArray(studs.data) ? studs.data : studs.data?.results || [];
            } catch (err) {
              if (err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''))) {
                try {
                  const studsFallback = await scopedGet('/api/academics/students/', id, { classroom: Number.isNaN(numClass) ? qClass : numClass }, { timeout: 45000 });
                  list = Array.isArray(studsFallback.data) ? studsFallback.data : studsFallback.data?.results || [];
                } catch (_) {
                  list = [];
                }
              } else {
                list = [];
              }
            }
            const sorted = [...list].sort((a, b) => {
              const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
              const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
              const aNum = Number.isNaN(ar) ? null : ar;
              const bNum = Number.isNaN(br) ? null : br;
              if (aNum !== null && bNum !== null) return aNum - bNum;
              const as = String(a?.roll_number ?? '');
              const bs = String(b?.roll_number ?? '');
              return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
            });
            setStudents(sorted);
          } else {
            setStudents([]);
          }
        }
        if (qSection) {
          const numSecOnly = parseInt(qSection, 10);
          setSelectedSection(Number.isNaN(numSecOnly) ? '' : numSecOnly);
        }
        if (qStudent) {
          const numStudent = parseInt(qStudent, 10);
          setSelectedStudent(Number.isNaN(numStudent) ? '' : numStudent);
        }
        if (qExam) setSelectedExamType(qExam);
        if (qLogo) {
          const raw = String(qLogo || '').trim();
          if (raw) {
            setOverrideLogo(raw);
            setSchool(prev => {
              const base = prev && typeof prev === 'object' ? prev : {};
              return { ...base, logo: raw };
            });
          }
        }
        if (qAuto === '1' && qClass && qStudent && (qExam || qExamId)) {
          timeout = setTimeout(() => handleSearch(qExamId || null), 200);
        }
      } catch (e) {
        console.warn('Deep link setup failed:', e);
      }
    })();
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const loadSchool = () => {
    api.get(`/api/schools/${id}/`, { timeout: 15000 })
      .then(res => {
        if (isMounted.current) setSchool(res.data);
      })
      .catch(async (err) => {
        console.error(err);
        try {
          const listRes = await api.get('/api/schools/', { timeout: 15000 });
          const arr = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.results || []);
          const found = arr.find(s => String(s.id) === String(id));
          if (found && isMounted.current) setSchool(found);
        } catch (_) {}
      });
  };

  useEffect(() => {
    if (id) {
      loadSchool();
    }
  }, [id]);

  useEffect(() => {
    try {
      let url = '';
      const raw1 = school?.logo || school?.image;
      if (typeof raw1 === 'string') url = raw1;
      else if (raw1 && typeof raw1.url === 'string') url = raw1.url;
      if (!url) url = school?.logo_url || school?.image_url || school?.photo_url || '';
      url = String(url || '').trim();
      if (url && !overrideLogo) setOverrideLogo(url);
    } catch (_) {}
  }, [school, overrideLogo]);


  const handleClassChange = (classIdRaw) => {
    const parsed = parseInt(classIdRaw, 10);
    const classId = Number.isNaN(parsed) ? '' : parsed;
    setSelectedClass(classId);
    setSelectedStudent('');
    setSelectedExamType('');
    setStudentData(null);
    setResults([]);
    setOverallResult(null);
    setSelectedSection('');
    
    if (!classId) {
      setStudents([]);
      setExaminations([]);
      setSections([]);
      return;
    }
    
    // Load sections for this class
    scopedGet('/api/academics/sections/', id, { classroom: classId }, { timeout: 15000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setSections(data);
        if (data.length === 0) {
          scopedGet('/api/academics/students/', id, { classroom: classId }, { timeout: 15000 })
            .then(r => {
              const list = Array.isArray(r.data) ? r.data : r.data?.results || [];
              const sorted = [...list].sort((a, b) => {
                const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
                const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
                const aNum = Number.isNaN(ar) ? null : ar;
                const bNum = Number.isNaN(br) ? null : br;
                if (aNum !== null && bNum !== null) return aNum - bNum;
                const as = String(a?.roll_number ?? '');
                const bs = String(b?.roll_number ?? '');
                return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
              });
              setStudents(sorted);
            })
            .catch(() => setStudents([]));
        }
      })
      .catch(() => setSections([]));
    
    // Do not load students yet; wait for section selection
    setStudents([]);
    
    // Load examinations for this class only
    scopedGet('/api/results/examinations/', id, { classroom: classId, year: selectedYear }, { timeout: 15000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        const classExams = data.filter(exam => getClassroomId(exam.classroom) === classId);
        setExaminations(classExams);
      })
      .catch(err => {
        console.error('Error loading examinations:', err);
        toast.error('Failed to load examinations');
      });
  };

  useEffect(() => {
    if (selectedClass) {
      scopedGet('/api/results/examinations/', id, { classroom: selectedClass, year: selectedYear }, { timeout: 15000 })
        .then(res => {
          const data = Array.isArray(res.data) ? res.data : res.data.results || [];
          const classExams = data.filter(exam => getClassroomId(exam.classroom) === selectedClass);
          setExaminations(classExams);
        })
        .catch(() => setExaminations([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  const normalizeExamType = (type, name) => {
    const s = String(type || '').toLowerCase();
    if (!s) {
      const rn = String(name || '').toLowerCase();
      if (/(বার্ষিক|final|annual)/.test(rn)) return 'annual';
      if (/(অর্ধ|half|mid)/.test(rn)) return 'half_yearly';
      if (/(টার্মিনাল|terminal)/.test(rn)) return 'terminal';
      if (/(মডেল|model)/.test(rn)) return 'model';
      if (/(টেস্ট|test|monthly)/.test(rn)) return 'test';
    }
    if (['final','annual','yearly'].includes(s)) return 'annual';
    if (['half','half_yearly','mid','half-yearly'].includes(s)) return 'half_yearly';
    if (['terminal','term'].includes(s)) return 'terminal';
    if (['model','model_test','model-test'].includes(s)) return 'model';
    if (['test','monthly'].includes(s)) return 'test';
    if (['first_term','first','first-term'].includes(s)) return 'first_term';
    return s || 'annual';
  };

  const getClassroomId = (cls) => {
    const v = typeof cls === 'object' ? (cls?.id ?? null) : cls;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  };
  const normalizeLower = (s) => String(s || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
  const canonicalLower = (s) => {
    const n = normalizeLower(s);
    const dict = {
      'বাংলা-১ম': 'বাংলা প্রথম পত্র',
      'বাংলা-২য়': 'বাংলা দ্বিতীয় পত্র',
      'ইংরেজি-১ম': 'ইংরেজি প্রথম পত্র',
      'ইংরেজী-১ম': 'ইংরেজি প্রথম পত্র',
      'ইংরেজি-২য়': 'ইংরেজি দ্বিতীয় পত্র',
      'ইংরেজী-২য়': 'ইংরেজি দ্বিতীয় পত্র'
    };
    const mapped = dict[n] || s;
    return normalizeLower(mapped);
  };
  const normalizeSubjectName = (name) => {
    const base = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim();
    const clsObj = classrooms.find(c => parseInt(c.id, 10) === parseInt(selectedClass, 10)) || {};
    const nm = String(clsObj?.name || '').toLowerCase();
    const isNineTen = /নবম|nine|\b9\b|দশম|ten|\b10\b/.test(nm);
    if (!isNineTen) {
      const lower = base.trim().toLowerCase();
      if (/(ict|আইসিটি|তথ্য\s*ও\s*(যোগাযোগ|যোগযোগ)\s*প্রযুক্তি)/i.test(lower)) return 'ict';
      if (/(বাংলাদেশ\s*ও\s*বিশ্বপরিচয়|bangladesh\s*and\s*global\s*studies)/i.test(lower)) return 'bgs';
      if (/(english|ইংরেজি|ইংরেজী)/i.test(lower)) return lower; // keep paper-specific names separate for class 6–8
      return lower;
    }
    const lower = base.toLowerCase();
    const paperNo = (/(১ম|1st|first)/i.test(lower) ? 1 : (/(২য়|২য়|2nd|second)/i.test(lower) ? 2 : null));
    if (/(বাংলা|bangla|bengali)/i.test(lower)) return paperNo ? `bangla__paper${paperNo}` : 'bangla';
    if (/(english|ইংরেজি|ইংরেজী)/i.test(lower)) return paperNo ? `english__paper${paperNo}` : 'english';
    const s = base.replace(/[- ]?(১ম|২য়|২য়|1st|2nd|first|second)([- ]?(paper|পত্র))?/gi, '').trim();
    return s.toLowerCase();
  };

  const calculateGradeAndGPA = (obtained, total) => {
    if (!total || total === 0) return { grade: 'F', gpa: '0.00', is_passed: false };
    const percentage = (obtained / total) * 100;
    let grade = 'F';
    let gpa = 0.00;
    
    if (percentage >= 80) { grade = 'A+'; gpa = 5.00; }
    else if (percentage >= 70) { grade = 'A'; gpa = 4.00; }
    else if (percentage >= 60) { grade = 'A-'; gpa = 3.50; }
    else if (percentage >= 50) { grade = 'B'; gpa = 3.00; }
    else if (percentage >= 40) { grade = 'C'; gpa = 2.00; }
    else if (percentage >= 33) { grade = 'D'; gpa = 1.00; }
    
    return { grade, gpa: gpa.toFixed(2), is_passed: grade !== 'F' };
  };

  const getExamMax = (ex) => {
    const obj = ex || {};
    const wm = parseFloat(obj.written_max) || 0;
    const mm = parseFloat(obj.mcq_max) || 0;
    const pm = parseFloat(obj.practical_max) || 0;
    if (wm || mm || pm) return wm + mm + pm;
    const t = parseFloat(obj.total_marks);
    return Number.isFinite(t) ? t : 100;
  };
  const getClassGroup = () => {
    const clsObj = classrooms.find(c => parseInt(c.id, 10) === parseInt(selectedClass, 10)) || {};
    const x = String(clsObj?.name || '').toLowerCase();
    if (/ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b/.test(x)) return 'six_to_eight';
    if (/নবম|nine|\b9\b|দশম|ten|\b10\b/.test(x)) return 'nine_ten';
    return null;
  };
  const getPassMarks = (exams) => {
    const ex = Array.isArray(exams) ? exams.find(e => e && (e.pass_marks != null)) : null;
    const pm = parseFloat(ex?.pass_marks);
    return Number.isFinite(pm) && pm > 0 ? pm : 33;
  };
  const computeSubjectPass = (name, w, m, p, exams, examination) => {
    const group = getClassGroup();
    const lower = canonicalLower(name);
    const passMarks = getPassMarks(exams);
    if (group === 'six_to_eight') {
      const exObj = examination || {};
      let wMax = parseFloat(exObj?.written_max) || 0;
      let mMax = parseFloat(exObj?.mcq_max) || 0;
      let pMax = parseFloat(exObj?.practical_max) || 0;
      if (!(wMax || mMax || pMax)) {
        const spec = getSubjectMaximaForClass(name) || {};
        wMax = parseFloat(spec.written) || 0;
        mMax = parseFloat(spec.mcq) || 0;
        pMax = parseFloat(spec.practical) || 0;
      }
      const requireCQ = wMax > 0;
      const requireMCQ = mMax > 0;
      const requirePR = pMax > 0;
      const tCQ = requireCQ ? Math.round(wMax / 3) : 0;
      const tMCQ = requireMCQ ? Math.round(mMax / 3) : 0;
      const tPR = requirePR ? Math.round(pMax / 3) : 0;
      const cqOk = requireCQ ? (w >= tCQ) : true;
      const mcqOk = requireMCQ ? (m >= tMCQ) : true;
      const prOk = requirePR ? (p >= tPR) : true;
      return cqOk && mcqOk && prOk;
    }
    return ((w + m + p) >= passMarks);
  };
  const SUBJECT_MAXIMA = {
    six_to_eight: {
      'বাংলা প্রথম পত্র': { written: 70, mcq: 30, practical: 0 },
      'bangla first paper': { written: 70, mcq: 30, practical: 0 },
      'বাংলা দ্বিতীয় পত্র': { written: 35, mcq: 15, practical: 0 },
      'bangla second paper': { written: 35, mcq: 15, practical: 0 },
      'ইংরেজি প্রথম পত্র': { written: 100, mcq: 0, practical: 0 },
      'english first paper': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি দ্বিতীয় পত্র': { written: 50, mcq: 0, practical: 0 },
      'english second paper': { written: 50, mcq: 0, practical: 0 },
      'গণিত': { written: 70, mcq: 30, practical: 0 },
      'mathematics': { written: 70, mcq: 30, practical: 0 },
      'বিজ্ঞান': { written: 70, mcq: 30, practical: 0 },
      'science': { written: 70, mcq: 30, practical: 0 },
      'বাংলাদেশ ও বিশ্বপরিচয়': { written: 70, mcq: 30, practical: 0 },
      'বাংলাদেশ ও বিশ্বপরিয়': { written: 70, mcq: 30, practical: 0 },
      'bgs': { written: 70, mcq: 30, practical: 0 },
      'আইসিটি': { written: 10, mcq: 15, practical: 25 },
      'ict': { written: 10, mcq: 15, practical: 25 },
      'তথ্য ও যোগাযোগ প্রযুক্তি': { written: 10, mcq: 15, practical: 25 },
      'তথ্য ও যোগযোগ প্রযুক্তি': { written: 10, mcq: 15, practical: 25 },
      'religion': { written: 70, mcq: 30, practical: 0 },
      'ধর্ম': { written: 70, mcq: 30, practical: 0 },
      'কৃষি': { written: 50, mcq: 25, practical: 25 },
      'agriculture': { written: 50, mcq: 25, practical: 25 }
    }
  };
  const getSubjectMaximaForClass = (subjectName) => {
    const grp = getClassGroup();
    if (!grp || grp !== 'six_to_eight') return null;
    const s = canonicalLower(subjectName);
    const keys = Object.keys(SUBJECT_MAXIMA.six_to_eight);
    const hit = keys.find(k => normalizeLower(k) === s);
    return hit ? SUBJECT_MAXIMA.six_to_eight[hit] : null;
  };
  const getTotalMaxForResult = (r) => {
    const ex = r.examination || {};
    const nm = r.subject?.name || r.subject_name || '';
    const m = getSubjectMaximaForClass(nm);
    const subjectTotal = m ? (m.written + m.mcq + m.practical) : null;
    const direct = getExamMax(ex);
    const rawTotal = parseFloat(r.total_marks);
    const hasExplicitExMax = (parseFloat(ex?.written_max) || 0) || (parseFloat(ex?.mcq_max) || 0) || (parseFloat(ex?.practical_max) || 0);
    if (subjectTotal && !hasExplicitExMax) return subjectTotal;
    if (Number.isFinite(rawTotal) && rawTotal > 0) return rawTotal;
    if (hasExplicitExMax) return direct;
    return subjectTotal || direct || 100;
  };

  const dedupeAndFillResults = (arr, exams) => {
    const map = new Map();
    
    // Process existing results
    for (const r of (Array.isArray(arr) ? arr : [])) {
      const nm = normalizeSubjectName(r.subject?.name || r.subject_name || r.examination?.name);
      if (!nm) continue;
      
      const prev = map.get(nm);
      if (prev) {
        const prevExId = typeof prev.examination === 'object' ? prev.examination?.id : prev.examination;
        const currExId = typeof r.examination === 'object' ? r.examination?.id : r.examination;
        if (prevExId === currExId) {
          const pw = parseFloat(prev.written_marks) || 0;
          const pmq = parseFloat(prev.mcq_marks) || 0;
          const pp = parseFloat(prev.practical_marks) || 0;
          const po = ((pw + pmq + pp) > 0) ? (pw + pmq + pp) : (parseFloat(prev.total_obtained) || 0);
          const pt = getTotalMaxForResult(prev);
          let { grade: pGrade, gpa: pGpa } = calculateGradeAndGPA(po, pt);
          const pPassed = computeSubjectPass(prev.subject?.name || prev.subject_name || nm, pw, pmq, pp, exams, prev.examination);
          if (!pPassed) { pGrade = 'F'; pGpa = '0.00'; }
          else if (pGrade === 'F') { pGrade = 'D'; pGpa = '1.00'; }
          const rw = parseFloat(r.written_marks) || 0;
          const rmq = parseFloat(r.mcq_marks) || 0;
          const rp = parseFloat(r.practical_marks) || 0;
          const ro = ((rw + rmq + rp) > 0) ? (rw + rmq + rp) : (parseFloat(r.total_obtained) || 0);
          const rt = getTotalMaxForResult(r);
          let { grade: rGrade, gpa: rGpa } = calculateGradeAndGPA(ro, rt);
          const rPassed = computeSubjectPass(r.subject?.name || r.subject_name || nm, rw, rmq, rp, exams, r.examination);
          if (!rPassed) { rGrade = 'F'; rGpa = '0.00'; }
          else if (rGrade === 'F') { rGrade = 'D'; rGpa = '1.00'; }
          const chosen = ro >= po ? { base: r, w: rw, m: rmq, p: rp, o: ro, t: rt, grade: rGrade, gpa: rGpa, pass: rPassed } : { base: prev, w: pw, m: pmq, p: pp, o: po, t: pt, grade: pGrade, gpa: pGpa, pass: pPassed };
          let cleanName = chosen.base.subject?.name || chosen.base.subject_name || nm;
          cleanName = cleanName.replace(/\s*\(.*?\)\s*/g, '').trim();
          const clsObj = classrooms.find(c => parseInt(c.id, 10) === parseInt(selectedClass, 10)) || {};
          const nm2 = String(clsObj?.name || '').toLowerCase();
          const isNineTen = /নবম|nine|\b9\b|দশম|ten|\b10\b/.test(nm2);
          if (isNineTen) {
            cleanName = cleanName.replace(/[- ]?(১ম|২য়|২য়|1st|2nd|first|second)([- ]?(paper|পত্র))?/gi, '').trim();
          }
          map.set(nm, {
            ...chosen.base,
            written_marks: chosen.w,
            mcq_marks: chosen.m,
            practical_marks: chosen.p,
            total_obtained: chosen.o,
            total_marks: chosen.t,
            grade: chosen.grade,
            gpa: chosen.gpa,
            is_passed: chosen.pass,
            subject: { ...(chosen.base.subject || {}), name: cleanName },
            subject_name: cleanName
          });
        } else {
          const prevDate = new Date((typeof prev.examination === 'object' ? prev.examination?.exam_date : null) || 0).getTime();
          const currDate = new Date((typeof r.examination === 'object' ? r.examination?.exam_date : null) || 0).getTime();
          const useCurr = currDate && (!prevDate || currDate >= prevDate);
          const base = useCurr ? r : prev;
          const w = parseFloat(base.written_marks) || 0;
          const m = parseFloat(base.mcq_marks) || 0;
          const p = parseFloat(base.practical_marks) || 0;
          const o = ((w + m + p) > 0) ? (w + m + p) : (parseFloat(base.total_obtained) || 0);
          const t = getTotalMaxForResult(base);
          let { grade, gpa } = calculateGradeAndGPA(o, t);
          const passed = computeSubjectPass(base.subject?.name || base.subject_name || nm, w, m, p, exams, base.examination);
          if (!passed) { grade = 'F'; gpa = '0.00'; }
          else if (grade === 'F') { grade = 'D'; gpa = '1.00'; }
          let cleanName = base.subject?.name || base.subject_name || nm;
          cleanName = cleanName.replace(/\s*\(.*?\)\s*/g, '').trim();
          const clsObj = classrooms.find(c => parseInt(c.id, 10) === parseInt(selectedClass, 10)) || {};
          const nm2 = String(clsObj?.name || '').toLowerCase();
          const isNineTen = /নবম|nine|\b9\b|দশম|ten|\b10\b/.test(nm2);
          if (isNineTen) {
            cleanName = cleanName.replace(/[- ]?(১ম|২য়|২য়|1st|2nd|first|second)([- ]?(paper|পত্র))?/gi, '').trim();
          }
          map.set(nm, {
            ...base,
            written_marks: w,
            mcq_marks: m,
            practical_marks: p,
            total_obtained: o,
            total_marks: t,
            grade,
            gpa,
            is_passed: passed,
            subject: { ...(base.subject || {}), name: cleanName },
            subject_name: cleanName
          });
        }
      } else {
        const w = parseFloat(r.written_marks) || 0;
        const m = parseFloat(r.mcq_marks) || 0;
        const p = parseFloat(r.practical_marks) || 0;
        const obtained = ((w + m + p) > 0) ? (w + m + p) : (parseFloat(r.total_obtained) || 0);
        const totalMax = getTotalMaxForResult(r);
        let { grade, gpa } = calculateGradeAndGPA(obtained, totalMax);
        const passed = computeSubjectPass(r.subject?.name || r.subject_name || nm, w, m, p, exams, r.examination);
        if (!passed) { grade = 'F'; gpa = '0.00'; }
        else if (grade === 'F') { grade = 'D'; gpa = '1.00'; }
        let cleanName = r.subject?.name || r.subject_name || nm;
        cleanName = cleanName.replace(/\s*\(.*?\)\s*/g, '').trim();
        {
          const clsObj = classrooms.find(c => parseInt(c.id, 10) === parseInt(selectedClass, 10)) || {};
          const nm = String(clsObj?.name || '').toLowerCase();
          const isNineTen = /নবম|nine|\b9\b|দশম|ten|\b10\b/.test(nm);
          if (isNineTen) {
            cleanName = cleanName.replace(/[- ]?(১ম|২য়|২য়|1st|2nd|first|second)([- ]?(paper|পত্র))?/gi, '').trim();
          }
        }
        map.set(nm, {
          ...r,
          written_marks: w,
          mcq_marks: m,
          practical_marks: p,
          total_obtained: obtained,
          total_marks: totalMax,
          grade,
          gpa,
          is_passed: passed,
          subject: { ...(r.subject || {}), name: cleanName },
          subject_name: cleanName
        });
      }
    }
    
    // Do not auto-fill missing exams with zero rows; only display what the student actually has results for
    return Array.from(map.values());
  };

  const handleSearch = async (examIdOverride = null) => {
    if (!selectedStudent || (!selectedExamType && !examIdOverride)) {
      toast.warning('Please select class, student, and exam type');
      return;
    }

    setLoading(true);
    try {
      // Get student details
      const studentRes = await api.get(`/api/academics/students/${selectedStudent}/`);
      const student = studentRes.data;
      setStudentData({ student: overrideLogo ? { ...student, school_logo: overrideLogo } : student });

      let matchingExams = [];
      if (examIdOverride) {
        const ex = examinations.find(e => String(e.id) === String(examIdOverride));
        matchingExams = ex ? [ex] : [];
      } else {
        const selType = normalizeExamType(selectedExamType);
        matchingExams = examinations.filter(exam => 
          normalizeExamType(exam.exam_type, exam.name) === selType && 
          getClassroomId(exam.classroom) === selectedClass
        );
      }

      if (matchingExams.length === 0) {
        // Fallback: try by regex on names within class
        const fallbackExams = examinations.filter(ex => getClassroomId(ex.classroom) === selectedClass);
        let alt = [];
        const sel = normalizeExamType(selectedExamType);
        if (sel === 'annual') alt = fallbackExams.filter(ex => /(বার্ষিক|final|annual)/i.test(String(ex.name || '')));
        else if (sel === 'half_yearly') alt = fallbackExams.filter(ex => /(অর্ধ|half|mid)/i.test(String(ex.name || '')));
        else if (sel === 'terminal') alt = fallbackExams.filter(ex => /(টার্মিনাল|terminal|term)/i.test(String(ex.name || '')));
        else if (sel === 'model') alt = fallbackExams.filter(ex => /(মডেল|model)/i.test(String(ex.name || '')));
        else if (sel === 'test') alt = fallbackExams.filter(ex => /(টেস্ট|test|monthly)/i.test(String(ex.name || '')));
        else if (sel === 'first_term') alt = fallbackExams.filter(ex => /(first\s*term|প্রথম\s*টার্ম)/i.test(String(ex.name || '')));

        if (alt.length > 0) {
          matchingExams = alt;
        } else {
          // Fallback 2: derive exam from student's existing results
          try {
            const rs = await scopedGet('/api/results/results/', id, { student: student.id, year: selectedYear, page_size: 2000 }, { timeout: 20000 });
            let arr = Array.isArray(rs.data) ? rs.data : (rs.data?.results || []);
            if (!arr.length) {
              const rsNoYear = await scopedGet('/api/results/results/', id, { student: student.id, page_size: 2000 }, { timeout: 20000 });
              arr = Array.isArray(rsNoYear.data) ? rsNoYear.data : (rsNoYear.data?.results || []);
            }
            const examIds = Array.from(new Set(arr.map(r => (typeof r.examination === 'object' ? r.examination?.id : r.examination)).filter(Boolean)));
            let found = null;
            for (const exId of examIds) {
              try {
                const exRes = await api.get(`/api/results/examinations/${exId}/`);
                const ex = exRes.data;
                if (getClassroomId(ex.classroom) === selectedClass && normalizeExamType(ex.exam_type, ex.name) === sel) {
                  found = ex;
                  break;
                }
              } catch (_) {}
            }
            if (found) matchingExams = [found];
          } catch (_) {}

          if (matchingExams.length === 0) {
            setStudentData(null);
            setResults([]);
            setOverallResult(null);
            setNoYearMessage(`দুঃখিত ${selectedYear} সালের রেজাল্ট এই স্কুলে এখনও ইনপুট দেওয়া হয়নি, দয়া করে অত্র বিদ্যালয়ের প্রধান শিক্ষক অথবা এ্যাডমিনের সাথে যোগাযোগ করুন। ধন্যবাদ।`);
            toast.error(`দুঃখিত ${selectedYear} সালের রেজাল্ট পাওয়া যায়নি`);
            setLoading(false);
            return;
          }
        }
      }

      let chosenExam = null;
      const possibleExams = [...matchingExams];
      try {
        const examResList = await Promise.all(matchingExams.map(ex => api.get(`/api/results/examinations/${ex.id}/`).then(r => r.data).catch(() => null)));
        const valid = examResList.filter(Boolean);
        const validSorted = [...valid].sort((a, b) => new Date(b.exam_date || 0) - new Date(a.exam_date || 0));
        chosenExam = validSorted[0] || valid[0] || null;
        setExamination(chosenExam);
      } catch (_) {
        chosenExam = matchingExams[0] || null;
        setExamination(chosenExam);
      }
      // Keep all matching examinations for subject coverage; chosenExam is only for header
      const originalMatching = [...matchingExams];
      matchingExams = originalMatching.length ? originalMatching : (chosenExam ? [chosenExam] : []);
      
      // Fetch results for all matching examinations and merge
      let fetchedResults = [];
      for (const ex of matchingExams) {
        // Try with section first (if selected), then without as fallback
        try {
          const primaryParams = { examination: ex.id, student: student.id, page_size: 1000 };
          if (selectedSection) primaryParams.section = selectedSection;
          const resultsRes = await scopedGet('/api/results/results/', id, primaryParams, { timeout: 15000 });
          const arr = Array.isArray(resultsRes.data) ? resultsRes.data : (resultsRes.data?.results || []);
          if (arr.length) {
            fetchedResults = fetchedResults.concat(arr);
            continue;
          }
          if (selectedSection) {
            const resultsResNoSec = await scopedGet('/api/results/results/', id, { examination: ex.id, student: student.id, page_size: 1000 }, { timeout: 15000 });
            const arr2 = Array.isArray(resultsResNoSec.data) ? resultsResNoSec.data : (resultsResNoSec.data?.results || []);
            fetchedResults = fetchedResults.concat(arr2);
          }
        } catch (err) {
          try {
            const resultsResNoSec = await scopedGet('/api/results/results/', id, { examination: ex.id, student: student.id, page_size: 1000 }, { timeout: 15000 });
            const arr = Array.isArray(resultsResNoSec.data) ? resultsResNoSec.data : (resultsResNoSec.data?.results || []);
            fetchedResults = fetchedResults.concat(arr);
          } catch (_) {}
        }
      }
      if ((!fetchedResults || fetchedResults.length === 0) && possibleExams.length > 1) {
        const sortedPossible = [...possibleExams].sort((a, b) => new Date(b.exam_date || 0) - new Date(a.exam_date || 0));
        for (const ex of sortedPossible) {
          try {
            const params = { examination: ex.id, student: student.id, page_size: 1000 };
            if (selectedSection) params.section = selectedSection;
            const resA = await scopedGet('/api/results/results/', id, params, { timeout: 15000 });
            let arrA = Array.isArray(resA.data) ? resA.data : (resA.data?.results || []);
            if ((!arrA || arrA.length === 0) && selectedSection) {
              const resB = await scopedGet('/api/results/results/', id, { examination: ex.id, student: student.id, page_size: 1000 }, { timeout: 15000 });
              arrA = Array.isArray(resB.data) ? resB.data : (resB.data?.results || []);
            }
            if (arrA && arrA.length) {
              fetchedResults = arrA;
              matchingExams = [ex];
              try {
                const exObj = await api.get(`/api/results/examinations/${ex.id}/`).then(r => r.data).catch(() => null);
                if (exObj) setExamination(exObj);
              } catch (_) {}
              break;
            }
          } catch (_) {}
        }
      }
      setResults(fetchedResults);

      if (fetchedResults.length === 0) {
        try {
          const r = await scopedGet('/api/results/results/', id, { student: student.id, page_size: 2000, year: selectedYear }, { timeout: 20000 });
          const arr = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
          const allowedIds = new Set(matchingExams.map(ex => ex.id));
          const filtered = arr.filter(it => {
            const exObj = typeof it.examination === 'object' ? it.examination : null;
            const exId = exObj ? exObj.id : it.examination;
            return allowedIds.has(parseInt(exId, 10));
          });
          if (filtered.length > 0) {
            fetchedResults = filtered;
            setResults(dedupeAndFillResults(fetchedResults, matchingExams));
          }
        } catch (_) {}
      }
      if (fetchedResults.length > 0) {
        const merged = dedupeAndFillResults(fetchedResults, matchingExams);
        setResults(merged);
        const usedExamIds = Array.from(new Set(merged.map(r => {
          const exObj = r.examination;
          return typeof exObj === 'object' ? exObj?.id : exObj;
        }).filter(Boolean)));
        try {
          const usedExamObjs = await Promise.all(usedExamIds.map(eid => api.get(`/api/results/examinations/${eid}/`).then(r => r.data).catch(() => null)));
          const validUsed = usedExamObjs.filter(Boolean).sort((a, b) => new Date(b.exam_date || 0) - new Date(a.exam_date || 0));
          if (validUsed[0]) setExamination(validUsed[0]);
        } catch (_) {}
      } else {
        const merged = dedupeAndFillResults([], matchingExams);
        setResults(merged);
      }

      // Get combined overall result with rank from backend
      try {
        let url = `/api/results/overall/combined_by_exam_type/?student=${student.id}&exam_type=${normalizeExamType(selectedExamType)}&classroom=${selectedClass}&school=${id}&year=${selectedYear}`;
        if (selectedSection) {
            url += `&section=${selectedSection}`;
        }
        const overallRes = await api.get(url);
        let combined = overallRes.data;
        // If rank is missing, try to derive it from examination-level overall list
        if (!combined || combined.rank == null) {
          const exId = chosenExam?.id || null;
          if (exId) {
            try {
              const classOverallRes = await scopedGet('/api/results/overall/', id, { examination: exId, page_size: 500 }, { timeout: 15000 });
              const list = Array.isArray(classOverallRes.data) ? classOverallRes.data : (classOverallRes.data?.results || []);
              const me = (list || []).find(item => {
                const sid = item?.student?.id ?? item?.student_id;
                return String(sid) === String(student.id);
              });
              if (me && me.rank != null) {
                combined = { ...(combined || {}), rank: me.rank };
              }
            } catch (_) { /* ignore fallback failure */ }
          }
          if (!combined || combined.rank == null) {
            try {
              const params = { 
                exam_type: normalizeExamType(selectedExamType), 
                classroom: selectedClass, 
                school: id, 
                page_size: 500 
              };
              if (selectedSection) params.section = selectedSection;
              const rankListRes = await scopedGet('/api/results/overall/combined_rank_list_by_exam_type/', id, params, { timeout: 15000 });
              const arr = Array.isArray(rankListRes.data) ? rankListRes.data : (rankListRes.data?.results || []);
              const me2 = (arr || []).find(row => {
                const sid = row?.student?.id ?? row?.student_id;
                return String(sid) === String(student.id);
              });
              if (me2 && me2.rank != null) {
                combined = { ...(combined || {}), rank: me2.rank };
              }
            } catch (_) { /* ignore fallback failure */ }
          }
        }
        setOverallResult(combined);
      } catch (err) {
        /* ignore errors for combined overall; fallback calculation below */
        // Fallback: Calculate on frontend without rank
        if (fetchedResults.length > 0) {
          const totalObtained = fetchedResults.reduce((sum, r) => sum + (parseFloat(r.total_obtained) || 0), 0);
          const totalPossible = fetchedResults.reduce((sum, r) => {
            const ex = r.examination || {};
            const wm = parseFloat(ex.written_max) || 0;
            const mm = parseFloat(ex.mcq_max) || 0;
            const pm = parseFloat(ex.practical_max) || 0;
            const maximaSum = (wm || mm || pm) ? (wm + mm + pm) : (parseFloat(ex.total_marks) || 100);
            return sum + maximaSum;
          }, 0);
          const avgGPA = fetchedResults.reduce((sum, r) => sum + (parseFloat(r.gpa) || 0), 0) / fetchedResults.length;
          const percentage = totalPossible > 0 ? (totalObtained / totalPossible * 100).toFixed(2) : 0;
          const isPassed = fetchedResults.every(r => r.is_passed);
          
          // Determine grade based on CGPA
          let grade = 'F';
          if (avgGPA >= 5.0) grade = 'A+';
          else if (avgGPA >= 4.0) grade = 'A';
          else if (avgGPA >= 3.5) grade = 'A-';
          else if (avgGPA >= 3.0) grade = 'B';
          else if (avgGPA >= 2.0) grade = 'C';
          else if (avgGPA >= 1.0) grade = 'D';
          
          setOverallResult({
            total_marks_obtained: totalObtained.toFixed(2),
            total_marks_possible: totalPossible.toFixed(2),
            percentage: percentage,
            cgpa: avgGPA.toFixed(2),
            grade: grade,
            is_passed: isPassed,
            rank: null
          });
        } else {
          setOverallResult(null);
        }
      }

      toast.success(`Result card generated with ${Array.isArray(results) ? results.length : 0} subjects!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate result card');
      setStudentData(null);
      setResults([]);
      setOverallResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!studentData) {
      toast.warning('Please generate a result card first');
      return;
    }
    toast.info('Opening print dialog...');
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleDownloadPDF = async () => {
    if (!studentData) {
      toast.warning('Please generate a result card first');
      return;
    }
    try {
      const cardEl = document.querySelector('.result-card-container');
      if (!cardEl) {
        toast.error('Could not find the result card to export');
        return;
      }
      const canvas = await html2canvas(cardEl, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 40; // margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let y = 20;
      if (imgHeight > pageHeight - 40) {
        // scale to fit height if needed
        const scale = (pageHeight - 40) / imgHeight;
        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;
        const x = (pageWidth - scaledWidth) / 2;
        pdf.addImage(imgData, 'PNG', x, 20, scaledWidth, scaledHeight);
      } else {
        const x = (pageWidth - imgWidth) / 2;
        pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      }
      pdf.save(`result-card-${studentData.student?.user?.username || 'student'}.pdf`);
      toast.success('PDF downloaded');
    } catch (e) {
      console.error('PDF generation error:', e);
      toast.error('Failed to generate PDF.');
    }
  };

  const handleReset = () => {
    setSelectedClass('');
    setSelectedStudent('');
    setSelectedExamType('');
    setStudents([]);
    setExaminations([]);
    setStudentData(null);
    setResults([]);
    setOverallResult(null);
    setSelectedSection('');
    toast.info('Form reset');
  };

  const handleSectionChange = (e) => {
    const p = parseInt(e.target.value, 10);
    const secId = Number.isNaN(p) ? '' : p;
    setSelectedSection(secId);
    
    if (selectedClass) {
      if (secId) {
        scopedGet('/api/academics/students/', id, { classroom: selectedClass, section: secId }, { timeout: 30000 })
          .then(res => {
            const data = Array.isArray(res.data) ? res.data : res.data.results || [];
            const sorted = [...data].sort((a, b) => {
              const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
              const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
              const aNum = Number.isNaN(ar) ? null : ar;
              const bNum = Number.isNaN(br) ? null : br;
              if (aNum !== null && bNum !== null) return aNum - bNum;
              const as = String(a?.roll_number ?? '');
              const bs = String(b?.roll_number ?? '');
              return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
            });
            setStudents(sorted);
          })
          .catch(err => {
            if (err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''))) {
              scopedGet('/api/academics/students/', id, { classroom: selectedClass }, { timeout: 45000 })
                .then(res2 => {
                  const data2 = Array.isArray(res2.data) ? res2.data : res2.data.results || [];
                  const sorted2 = [...data2].sort((a, b) => {
                    const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
                    const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
                    const aNum = Number.isNaN(ar) ? null : ar;
                    const bNum = Number.isNaN(br) ? null : br;
                    if (aNum !== null && bNum !== null) return aNum - bNum;
                    const as = String(a?.roll_number ?? '');
                    const bs = String(b?.roll_number ?? '');
                    return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
                  });
                  toast.warning('Section query timed out, loaded class students instead');
                  setStudents(sorted2);
                })
                .catch(e2 => {
                  console.error('Error loading students (fallback):', e2);
                  toast.error('Failed to load students');
                  setStudents([]);
                });
            } else {
              console.error('Error loading students:', err);
              toast.error('Failed to load students');
            }
          });
      } else {
        scopedGet('/api/academics/students/', id, { classroom: selectedClass }, { timeout: 15000 })
          .then(res => {
            const data = Array.isArray(res.data) ? res.data : res.data.results || [];
            const sorted = [...data].sort((a, b) => {
              const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
              const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
              const aNum = Number.isNaN(ar) ? null : ar;
              const bNum = Number.isNaN(br) ? null : br;
              if (aNum !== null && bNum !== null) return aNum - bNum;
              const as = String(a?.roll_number ?? '');
              const bs = String(b?.roll_number ?? '');
              return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
            });
            setStudents(sorted);
          })
          .catch(() => setStudents([]));
      }
    }
  };

  const handleStudentChange = (e) => {
    const p = parseInt(e.target.value, 10);
    setSelectedStudent(Number.isNaN(p) ? '' : p);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4">
          <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          রেজাল্ট কার্ড জেনারেটর
        </Typography>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>ব্যাক</Button>
      </Stack>

      {/* Search Form */}
      <Paper sx={{ p: 3, mb: 3, boxShadow: 3 }} className="no-print">
        <Typography variant="h6" gutterBottom>রেজাল্ট কার্ড তৈরি করুন</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          সব বিষয়ে রেজাল্ট কার্ড তৈরির জন্য শ্রেণি, শিক্ষার্থী এবং পরীক্ষার ধরন নির্বাচন করুন
        </Typography>
        
        <Stack spacing={2} sx={{ mb: 2 }}>
          {/* ধাপ ১: শ্রেণি নির্বাচন */}
          <TextField
            select
            label="ধাপ ১: শ্রেণি নির্বাচন করুন"
            value={selectedClass}
            onChange={(e) => handleClassChange(e.target.value)}
            fullWidth
          >
            <MenuItem value="">
              {classrooms.length === 0 ? "কোনো শ্রেণি পাওয়া যায়নি (লোড হচ্ছে...)" : "একটি শ্রেণি নির্বাচন করুন"}
            </MenuItem>
            {classrooms.map((classroom) => (
              <MenuItem key={classroom.id} value={classroom.id}>
                {classroom.name}
              </MenuItem>
            ))}
          </TextField>

          {/* ধাপ ১.৫: সেকশন নির্বাচন */}
          <TextField
            select
            label="ধাপ ১.৫: সেকশন নির্বাচন করুন"
            value={selectedSection}
            onChange={handleSectionChange}
            fullWidth
            disabled={!selectedClass}
          >
            <MenuItem value="">
              {sections.length === 0 ? "কোনো সেকশন পাওয়া যায়নি" : "সেকশন নির্বাচন করুন"}
            </MenuItem>
            {sections.map((sec) => (
              <MenuItem key={sec.id} value={sec.id}>
                {sec.name}
              </MenuItem>
            ))}
          </TextField>

          {/* ধাপ ২: শিক্ষার্থী নির্বাচন */}
          <TextField
            select
            label="ধাপ ২: শিক্ষার্থী নির্বাচন করুন"
            value={selectedStudent}
            onChange={handleStudentChange}
            fullWidth
            disabled={!selectedClass}
          >
            <MenuItem value="">
              {students.length === 0 ? "কোনো শিক্ষার্থী পাওয়া যায়নি" : "একজন শিক্ষার্থী নির্বাচন করুন"}
            </MenuItem>
            {students.map((student) => (
              <MenuItem key={student.id} value={student.id}>
                {student.user?.first_name} {student.user?.last_name} - Roll: {student.roll_number || 'N/A'}
              </MenuItem>
            ))}
          </TextField>

          {/* ধাপ ২.৫: সাল নির্বাচন */}
          <TextField
            type="number"
            label="ধাপ ২.৫: সাল নির্বাচন করুন"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value || String(new Date().getFullYear()), 10) || new Date().getFullYear())}
            fullWidth
            disabled={!selectedClass}
            inputProps={{ min: 2000, max: 2100 }}
          />

          {/* ধাপ ৩: পরীক্ষার ধরন নির্বাচন */}
          <TextField
            select
            label="ধাপ ৩: পরীক্ষার ধরন নির্বাচন করুন"
            value={selectedExamType}
            onChange={(e) => setSelectedExamType(e.target.value)}
            fullWidth
            disabled={!selectedClass}
          >
            <MenuItem value="">পরীক্ষার ধরন নির্বাচন করুন</MenuItem>
            {examTypes.map((type) => (
              <MenuItem key={type.value} value={type.value}>
                {type.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={() => handleSearch()}
            disabled={loading || !selectedStudent || !selectedExamType}
          >
            {loading ? 'তৈরি হচ্ছে...' : 'রেজাল্ট কার্ড তৈরি করুন'}
          </Button>
          
          {studentData && (
            <>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                color="primary"
              >
                প্রিন্ট
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadPDF}
                color="secondary"
              >
                পিডিএফ ডাউনলোড
              </Button>
            </>
          )}
          
          <Button
            variant="text"
            startIcon={<RefreshIcon />}
            onClick={handleReset}
          >
            রিসেট
          </Button>
        </Stack>

        {classrooms.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            কোনো শ্রেণি পাওয়া যায়নি। আগে শ্রেণি তৈরি করুন।
          </Alert>
        )}
        
        {selectedClass && students.length === 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            এই শ্রেণিতে কোনো শিক্ষার্থী নেই। আগে শিক্ষার্থী যোগ করুন।
          </Alert>
        )}
        
        {selectedClass && selectedExamType && examinations.length > 0 && 
         !examinations.find(e => normalizeExamType(e.exam_type, e.name) === normalizeExamType(selectedExamType) && getClassroomId(e.classroom) === selectedClass) && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            এই শ্রেণির জন্য কোনো {examTypes.find(t => t.value === selectedExamType)?.label} পরীক্ষা পাওয়া যায়নি। আগে একটি পরীক্ষা তৈরি করুন।
          </Alert>
        )}
      </Paper>

      

      {/* Result Card Display */}
      {studentData ? (
        <>
          <ResultCard
            studentData={studentData}
            results={results}
            overallResult={overallResult}
            examination={overrideLogo ? { ...(examination || {}), school_logo: overrideLogo } : examination}
            school={school || {}}
            schoolId={id}
          />
        </>
      ) : (
        <EmptyState
          icon={AssessmentIcon}
          title={noYearMessage ? "রেজাল্ট পাওয়া যায়নি" : "কোনো রেজাল্ট কার্ড তৈরি হয়নি"}
          message={noYearMessage || "সব বিষয়ে রেজাল্ট কার্ড তৈরির জন্য শ্রেণি, শিক্ষার্থী এবং পরীক্ষার ধরন নির্বাচন করুন"}
        />
      )}
    </Box>
  );
}
