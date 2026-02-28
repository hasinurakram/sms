import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  Stack
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { scopedGet } from '../utils/schoolApi';
import { useSchool } from '../context/SchoolContext';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const EXAM_TYPE_LABELS = {
  'half_yearly': 'অর্ধবার্ষিক',
  'annual': 'বার্ষিক',
  'test': 'বিশেষ মূল্যায়ন',
  'model_test': 'মডেল টেস্ট',
  'pre_test': 'প্রাক-নির্বাচনী',
  'final': 'চূড়ান্ত পরীক্ষা'
};

const RankListPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { schoolId: contextSchoolId } = useSchool();
  const schoolId = contextSchoolId || id;
  const tableRef = useRef(null);
  const [examinations, setExaminations] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resultsByStudent, setResultsByStudent] = useState(new Map());
  const [activeExamId, setActiveExamId] = useState(null);
  const [sortBy, setSortBy] = useState('current');
  const passMarks = React.useMemo(() => {
    try {
      const ex = (examinations || []).find(e => e && e.pass_marks != null);
      const pm = parseFloat(ex?.pass_marks);
      return Number.isFinite(pm) && pm > 0 ? pm : 33;
    } catch (_) { return 33; }
  }, [examinations]);

  useEffect(() => {
    if (!schoolId) return;
    scopedGet('/api/results/examinations/', schoolId)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.data || []);
        setExaminations(Array.isArray(data) ? data : []);
        const types = [...new Set((Array.isArray(data) ? data : []).map(e => e?.exam_type).filter(Boolean))];
        setExamTypes(types);
      })
      .catch(err => console.error('Examinations fetch error:', err));
    scopedGet('/api/academics/classrooms/', schoolId)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.data || []);
        setClassrooms(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error('Classrooms fetch error:', err));
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !selectedClass) { setSections([]); return; }
    scopedGet('/api/academics/sections/', schoolId, { classroom: selectedClass })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.data || []);
        setSections(Array.isArray(data) ? data : []);
      })
      .catch(() => setSections([]));
  }, [schoolId, selectedClass]);

  const handleFetchRankings = () => {
    if (!selectedExamType || !selectedClass || !selectedSection) return;
    setLoading(true);
    setErrorMessage('');
    setRankings([]);
    setResultsByStudent(new Map());
    // Prefer examination-level overall for exact totals/ranks
    scopedGet('/api/results/examinations/', schoolId, { classroom: selectedClass, page_size: 1000, year: selectedYear })
      .then(async exRes => {
        const allExams = Array.isArray(exRes.data) ? exRes.data : (exRes.data?.results || []);
        const matching = (allExams || []).filter(e => String(e.exam_type || '') === String(selectedExamType));
        const picked = [...matching].sort((a, b) => {
          const ad = a.exam_date ? new Date(a.exam_date).getTime() : 0;
          const bd = b.exam_date ? new Date(b.exam_date).getTime() : 0;
          if (bd !== ad) return bd - ad;
          return (b.id || 0) - (a.id || 0);
        })[0] || null;
        if (picked && picked.id) {
          try {
            const resp = await scopedGet('/api/results/overall/', schoolId, { examination: picked.id, page_size: 2000 }, { timeout: 30000 });
            const data = Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
            const list = Array.isArray(data) ? data : [];
            if (list.length) {
              setActiveExamId(String(picked.id));
              const withNewRoll = list.map((row, idx) => ({ ...row, _new_roll: row.rank ?? (idx + 1) }));
              setRankings(withNewRoll);
              try {
                // Try with section filter first
                const primaryParams = { examination: picked.id, classroom: selectedClass, page_size: 3000 };
                if (selectedSection) primaryParams.section = selectedSection;
                const rResp = await scopedGet('/api/results/results/', schoolId, primaryParams, { timeout: 30000 });
                let rData = Array.isArray(rResp.data) ? rResp.data : (rResp.data?.results || []);
                let arr = Array.isArray(rData) ? rData : [];
                // Fallback: without section filter if empty
                if (!arr.length && selectedSection) {
                  const rRespNoSec = await scopedGet('/api/results/results/', schoolId, { examination: picked.id, classroom: selectedClass, page_size: 3000 }, { timeout: 30000 });
                  rData = Array.isArray(rRespNoSec.data) ? rRespNoSec.data : (rRespNoSec.data?.results || []);
                  arr = Array.isArray(rData) ? rData : [];
                }
                const byStu = new Map();
                for (const r of arr) {
                  const sid = r?.student?.id ?? r?.student_id ?? r?.student;
                  if (!sid) continue;
                  const key = String(sid);
                  if (!byStu.has(key)) byStu.set(key, []);
                  byStu.get(key).push(r);
                }
                setResultsByStudent(byStu);
              } catch (_) {
                try {
                  const r2 = await scopedGet('/api/results/results/', schoolId, { exam_type: selectedExamType, classroom: selectedClass, section: selectedSection, page_size: 3000 }, { timeout: 30000 });
                  const r2Data = Array.isArray(r2.data) ? r2.data : (r2.data?.results || []);
                  const arr2 = Array.isArray(r2Data) ? r2Data : [];
                  const byStu2 = new Map();
                  for (const r of arr2) {
                    const sid = r?.student?.id ?? r?.student_id ?? r?.student;
                    if (!sid) continue;
                    const key = String(sid);
                    if (!byStu2.has(key)) byStu2.set(key, []);
                    byStu2.get(key).push(r);
                  }
                  setResultsByStudent(byStu2);
                } catch {
                  setResultsByStudent(new Map());
                }
              }
              setLoading(false);
              return;
            }
          } catch (_) { /* fall through to combined */ }
        }
        // Fallback: combined by exam_type
        return api.get('/api/results/overall/combined_rank_list_by_exam_type/', {
          params: {
            exam_type: selectedExamType,
            classroom: selectedClass,
            section: selectedSection,
            school: schoolId || undefined,
            year: selectedYear,
            page_size: 1000
          }
        })
          .then(res => {
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.data || []);
            const list = Array.isArray(data) ? data : [];
            if (!list.length) {
              setErrorMessage(`দুঃখিত ${selectedYear} সালের রেজাল্ট অত্র বিদ্যালয়ে এখনও ইনপুট দেওয়া হয়নি, দয়া করে এ্যাডমিন অথবা অত্র বিদ্যালয়ের প্রধান শিক্ষকের সাথে যোগাযোগ করুন। ধন্যবাদ।`);
              setRankings([]);
              return;
            }
            const computed = computeNewRolls(list);
            setRankings(computed);
            (async () => {
              const byStu = new Map();
              const pageSize = 500;
              for (const item of computed) {
                const sid = item?.student?.id ?? item?.student_id ?? item?.student;
                if (!sid) continue;
                const sidStr = String(sid);
                let page = 1;
                const maxPages = 10;
                const collected = [];
                for (; page <= maxPages; page++) {
                  try {
                    const params = { student: sid, exam_type: selectedExamType, classroom: selectedClass, section: selectedSection, year: selectedYear, page, page_size: pageSize };
                    const r = await scopedGet('/api/results/results/', schoolId, params, { timeout: 15000 });
                    const arr = Array.isArray(r.data) ? r.data : (r.data?.results || []);
                    if (!arr.length) break;
                    collected.push(...arr);
                    const hasNext = Boolean((r.data?.next || '').length);
                    if (!hasNext && (!r.data?.count || arr.length < pageSize)) break;
                  } catch (_) { break; }
                }
                if (collected.length) {
                  if (!byStu.has(sidStr)) byStu.set(sidStr, []);
                  for (const it of collected) byStu.get(sidStr).push(it);
                }
              }
              if (byStu.size > 0) setResultsByStudent(byStu);
            })();
          })
          .catch(err => {
            const msg = err?.response?.data?.detail || err?.message || 'ডাটা লোড করা যায়নি';
            setErrorMessage(msg);
            setRankings([]);
          })
          .finally(() => setLoading(false));
      })
      .catch(() => {
        setErrorMessage('পরীক্ষার তালিকা পাওয়া যায়নি');
        setRankings([]);
        setLoading(false);
      });
  };
  const normalizeName = (s) => String(s || '')
    .replace(/\u200c|\u200d/g, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const toAsciiDigits = (s) => {
    const str = String(s || '');
    // Bengali ০-৯ -> 0-9, Arabic-Indic ٠-٩ -> 0-9
    return str
      .replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
      .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  };
  const canonicalSubjectName = (s) => {
    const n = String(s || '').toLowerCase();
    if (!n) return '';
    if (/বাংলা.*1\+2|bangla.*1\+2|বাংলা\s*১\+২/.test(n)) return 'bangla_combined';
    if (/english.*1\+2|ইংরেজি.*1\+2|ইংরেজি\s*১\+২|ইংরেজী\s*১\+২/.test(n)) return 'english_combined';
    if ((/বাংলা|bangla|bengali/.test(n)) && (/প্রথম|1st|first|১ম/.test(n))) return 'bangla_1st';
    if ((/বাংলা|bangla|bengali/.test(n)) && (/দ্বিতীয়|দ্বিতীয়|2nd|second|২য়/.test(n))) return 'bangla_2nd';
    if ((/বাংলা|bangla|bengali/.test(n))) return 'bangla';
    if ((/ইংরেজি|ইংরেজী|english/.test(n)) && (/প্রথম|1st|first|১ম/.test(n))) return 'english_1st';
    if ((/ইংরেজি|ইংরেজী|english/.test(n)) && (/দ্বিতীয়|দ্বিতীয়|2nd|second|২য়/.test(n))) return 'english_2nd';
    if ((/ইংরেজি|ইংরেজী|english/.test(n))) return 'english';
    if (/গণিত|mathematics|math|general math/.test(n)) return 'math';
    if (/বিজ্ঞান|science/.test(n)) return 'science';
    if (/বাংলাদেশ.*বিশ্ব.*(পরিচ(য়|য়)|পরিয়)|bangladesh.*global studies|bgs|সামাজিক\s*বিজ্ঞান|social\s*science/.test(n)) return 'bgs';
    if (/ict|আইসিটি|তথ্য.*যোগাযোগ প্রযুক্তি/.test(n)) return 'ict';
    if (/ধর্ম|religion|moral education|islam|hindu/.test(n)) return 'religion';
    if (/কৃষি|agriculture/.test(n)) return 'agriculture';
    if (/পদার্থ|physics/.test(n)) return 'physics';
    if (/রসায়ন|রসায়ন|chemistry/.test(n)) return 'chemistry';
    if (/জীববিজ্ঞান|biology/.test(n)) return 'biology';
    if (/উচ্চতর গণিত|higher math|higher mathematics/.test(n)) return 'higher_math';
    if (/ইতিহাস|history/.test(n)) return 'history';
    if (/ভূগোল|geography|পরিবেশ/.test(n)) return 'geography';
    if (/পৌরনীতি|civics|নাগরিকতা/.test(n)) return 'civics';
    if (/অর্থনীতি|economics/.test(n)) return 'economics';
    if (/ব্যবসায় উদ্যোগ|business entrepreneurship/.test(n)) return 'business_entrepreneurship';
    if (/ব্যবসায় শিক্ষা|business studies/.test(n)) return 'business_studies';
    if (/হিসাববিজ্ঞান|accounting/.test(n)) return 'accounting';
    if (/ফিন্যান্স|finance|ব্যাংকিং|banking/.test(n)) return 'finance';
    return n;
  };
  const labelForCanonical = (key) => {
    const map = {
      bangla_1st: 'বাংলা-১ম',
      bangla_2nd: 'বাংলা-২য়',
      bangla: 'বাংলা',
      bangla_combined: 'বাংলা ১+২',
      english_1st: 'ইংরেজী-১ম',
      english_2nd: 'ইংরেজি-২য়',
      english: 'ইংরেজি',
      english_combined: 'ইংরেজি ১+২',
      math: 'গণিত',
      science: 'বিজ্ঞান',
      bgs: 'বাংলাদেশ ও বিশ্বপরিচয়',
      ict: 'তথ্য ও যোগাযোগ প্রযুক্তি',
      religion: 'ধর্ম',
      agriculture: 'কৃষি',
      physics: 'পদার্থ',
      chemistry: 'রসায়ন',
      biology: 'জীববিজ্ঞান',
      higher_math: 'উচ্চতর গণিত',
      history: 'ইতিহাস',
      geography: 'ভূগোল',
      civics: 'পৌরনীতি',
      economics: 'অর্থনীতি',
      business_entrepreneurship: 'ব্যবসায় উদ্যোগ',
      business_studies: 'ব্যবসায় শিক্ষা',
      accounting: 'হিসাববিজ্ঞান',
      finance: 'ফিন্যান্স'
    };
    return map[key] || key;
  };
  const isNineTen = React.useMemo(() => {
    const cls = classrooms.find(c => String(c.id) === String(selectedClass));
    const name = String(cls?.name || '').toLowerCase();
    if (!name) return false;
    if (/নবম|দশম/.test(name)) return true;
    if (/class\s*9|class\s*10/.test(name)) return true;
    if (/\b9\b|\b10\b/.test(name)) return true;
    return false;
  }, [classrooms, selectedClass]);
  const displaySubjects = React.useMemo(() => {
    const set = new Set();
    for (const arr of resultsByStudent.values()) {
      for (const r of arr) {
        const nm = normalizeName(r?.subject?.name || r?.subject_name || '');
        const can = canonicalSubjectName(nm);
        if (can) set.add(can);
      }
    }
    const hasB1 = set.has('bangla_1st');
    const hasB2 = set.has('bangla_2nd');
    const hasE1 = set.has('english_1st');
    const hasE2 = set.has('english_2nd');
    if (hasB1 || hasB2) set.delete('bangla');
    if (hasE1 || hasE2) set.delete('english');
    if (isNineTen) {
      if (hasB1 || hasB2) {
        set.delete('bangla_1st');
        set.delete('bangla_2nd');
        set.add('bangla_combined');
      }
      if (hasE1 || hasE2) {
        set.delete('english_1st');
        set.delete('english_2nd');
        set.add('english_combined');
      }
    } else {
      if ((hasB1 || hasB2) && set.has('bangla_combined')) set.delete('bangla_combined');
      if ((hasE1 || hasE2) && set.has('english_combined')) set.delete('english_combined');
    }
    if (!set.has('bgs')) set.add('bgs');
    const arr = Array.from(set);
    const order = [
      'bangla_1st','bangla_2nd','bangla','bangla_combined','english_1st','english_2nd','english','english_combined',
      'math','science','bgs','ict','religion','agriculture',
      'physics','chemistry','biology','higher_math','history',
      'geography','civics','economics','business_entrepreneurship',
      'business_studies','accounting','finance'
    ];
    return arr.sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      const sa = ia === -1 ? 9999 : ia;
      const sb = ib === -1 ? 9999 : ib;
      return sa - sb;
    }).map(can => ({ canonical: can, label: labelForCanonical(can) }));
  }, [resultsByStudent]);
  const getStudentSubjectTotal = (sid, canonical) => {
    const arr = resultsByStudent.get(String(sid)) || [];
    for (const r of arr) {
      const nm = normalizeName(r?.subject?.name || r?.subject_name || '');
      const can = canonicalSubjectName(nm);
      if (can === canonical) {
        const t = parseFloat(r?.total_obtained);
        if (!Number.isNaN(t)) return t;
        const cq = parseFloat(r?.written_marks) || 0;
        const mcq = parseFloat(r?.mcq_marks) || 0;
        const pr = parseFloat(r?.practical_marks) || 0;
        return cq + mcq + pr;
      }
    }
    return null;
  };
  const getStudentDisplayedTotal = (sid) => {
    const map = getStudentResultsMap(sid);
    let sum = 0;
    let hasAny = false;
    for (const item of displaySubjects) {
      const r = resolveResult(sid, item, map);
      const v = r ? resultTotal(r) : null;
      if (typeof v === 'number' && !Number.isNaN(v)) {
        sum += v;
        hasAny = true;
      }
    }
    return hasAny ? Math.round(sum) : null;
  };
  const resultTotal = (res) => {
    if (!res) return 0;
    const t = typeof res.total === 'number' ? res.total : undefined;
    const to = typeof res.total_obtained === 'number' ? res.total_obtained : (typeof res.totalObtained === 'number' ? res.totalObtained : undefined);
    if (typeof t === 'number') return t;
    if (typeof to === 'number') return to;
    const cq = parseFloat(res.written_marks ?? res.cq ?? 0);
    const mcq = parseFloat(res.mcq_marks ?? res.mcq ?? 0);
    const pr = parseFloat(res.practical_marks ?? res.practical ?? 0);
    const sum = (Number.isFinite(cq) ? cq : 0) + (Number.isFinite(mcq) ? mcq : 0) + (Number.isFinite(pr) ? pr : 0);
    return Number.isFinite(sum) ? sum : 0;
  };
  const synonymsForCanonical = (key) => {
    const maps = {
      bgs: ['bgs','বাংলাদেশ ও বিশ্বপরিচয়','বাংলাদেশ ও বিশ্ব পরিচয়','Bangladesh and Global Studies','বাংলাদেশ ও বিশ্বপরিয়','BGS','সামাজিক বিজ্ঞান','social science'],
      ict: ['ict','আইসিটি','তথ্য ও যোগাযোগ প্রযুক্তি','Ict','ICT'],
      science: ['science','বিজ্ঞান','Science'],
      math: ['math','গণিত','Mathematics','সাধারণ গণিত','General Math'],
      religion: ['religion','ধর্ম','ধর্ম ও নৈতিক শিক্ষা','Islam and Moral Education','হিন্দু ধর্ম','Hindu Religion'],
      bangla_1st: ['bangla_1st','বাংলা-১ম','বাংলা প্রথম পত্র','Bangla First Paper'],
      bangla_2nd: ['bangla_2nd','বাংলা-২য়','বাংলা দ্বিতীয় পত্র','Bangla Second Paper'],
      english_1st: ['english_1st','ইংরেজী-১ম','ইংরেজি প্রথম পত্র','English First Paper'],
      english_2nd: ['english_2nd','ইংরেজি-২য়','ইংরেজি দ্বিতীয় পত্র','English Second Paper']
    };
    return maps[key] || [key];
  };
  const getStudentResultsMap = (sid) => {
    const sidStr = String(sid);
    const arr = resultsByStudent.get(sidStr) || [];
    const m = new Map();
    for (const r of arr) {
      let nm = normalizeName(r?.subject?.name || r?.subject_name || '');
      let key = canonicalSubjectName(nm) || nm;
      if (!nm || !key) continue;
      const w = parseFloat(r.written_marks) || 0;
      const mcq = parseFloat(r.mcq_marks) || 0;
      const pr = parseFloat(r.practical_marks) || 0;
      const total = r.total_obtained != null && r.total_obtained !== '' ? (parseFloat(r.total_obtained) || 0) : (w + mcq + pr);
      m.set(key, { total, written_marks: w, mcq_marks: mcq, practical_marks: pr, grade: r.grade });
      const rawKey = normalizeName(nm);
      if (rawKey && rawKey !== key) m.set(rawKey, { total, written_marks: w, mcq_marks: mcq, practical_marks: pr, grade: r.grade });
      const subjId2 = typeof r.subject === 'object' ? r.subject?.id : r.subject;
      if (subjId2) m.set(`id:${String(subjId2)}`, { total, written_marks: w, mcq_marks: mcq, practical_marks: pr, grade: r.grade });
    }
    return m;
  };
  const resolveResult = (sid, item, map) => {
    let r = undefined;
    if (item?.canonical === 'bangla_combined') {
      const r1 = map.get('bangla_1st');
      const r2 = map.get('bangla_2nd');
      if (r1 || r2) r = { total: resultTotal(r1) + resultTotal(r2) };
      return r;
    }
    if (item?.canonical === 'english_combined') {
      const r1 = map.get('english_1st');
      const r2 = map.get('english_2nd');
      if (r1 || r2) r = { total: resultTotal(r1) + resultTotal(r2) };
      return r;
    }
    if (item?.id) r = map.get(`id:${String(item.id)}`);
    if (!r) {
      const cand = [item?.canonical, normalizeName(item?.label || '')].filter(Boolean);
      const syns = synonymsForCanonical(item?.canonical || '');
      for (const k of [...cand, ...syns]) {
        const kk = normalizeName(k);
        r = map.get(k) || map.get(kk);
        if (r) break;
      }
    }
    if (!r) {
      const raw = resultsByStudent.get(String(sid)) || [];
      for (const x of raw) {
        const nm = normalizeName(x?.subject?.name || x?.subject_name || '');
        const can = canonicalSubjectName(nm);
        const subjId = typeof x.subject === 'object' ? x.subject?.id : x.subject;
        if (item?.canonical && can && can === item.canonical) { r = x; break; }
        if (!r && item?.id && subjId && String(subjId) === String(item.id)) { r = x; break; }
        if (!r) {
          const syns = synonymsForCanonical(item?.canonical || '');
          const kk = normalizeName(item?.label || '');
          if (syns.includes(nm) || nm === kk) { r = x; break; }
        }
      }
    }
    return r;
  };

  const getGradeStyle = (grade) => {
    switch (grade) {
      case 'A+': return { bg: '#4CAF50', fg: 'white' };
      case 'A': return { bg: '#8BC34A', fg: 'black' };
      case 'A-': return { bg: '#CDDC39', fg: 'black' };
      case 'B': return { bg: '#FFEB3B', fg: 'black' };
      case 'C': return { bg: '#FFC107', fg: 'black' };
      case 'D': return { bg: '#FF9800', fg: 'black' };
      case 'F': return { bg: '#F44336', fg: 'white' };
      default: return { bg: '#E0E0E0', fg: 'black' };
    }
  };

  const computeNewRolls = (list) => {
    const byStudent = new Map();
    list.forEach(item => {
      const sid = item?.student?.id ?? item?.student_id ?? `${item?.student?.user?.id || ''}-${item?.student?.roll_number || ''}`;
      if (!sid) return;
      const prev = byStudent.get(sid);
      const currScore = Number(item?.total_marks_obtained ?? 0);
      const prevScore = Number(prev?.total_marks_obtained ?? -1);
      if (!prev || currScore > prevScore) byStudent.set(sid, item);
    });
    const unique = Array.from(byStudent.values());
    const sorted = unique.sort((a, b) => {
      const aScore = Number(a?.total_marks_obtained ?? 0);
      const bScore = Number(b?.total_marks_obtained ?? 0);
      if (bScore !== aScore) return bScore - aScore;
      const aFail = Number(a?.failed_subjects_count ?? 0);
      const bFail = Number(b?.failed_subjects_count ?? 0);
      if (aFail !== bFail) return aFail - bFail;
      const aCgpa = Number(a?.cgpa ?? 0);
      const bCgpa = Number(b?.cgpa ?? 0);
      if (bCgpa !== aCgpa) return bCgpa - aCgpa;
      const aName = `${a?.student?.user?.first_name || ''} ${a?.student?.user?.last_name || ''}`.trim();
      const bName = `${b?.student?.user?.first_name || ''} ${b?.student?.user?.last_name || ''}`.trim();
      return aName.localeCompare(bName, 'bn');
    });
    return sorted.map((item, idx) => ({ ...item, _new_roll: idx + 1 }));
  };

  const printRef = useRef(null);

  const getClassName = () => {
    return classrooms.find(c => String(c.id) === String(selectedClass))?.name || '';
  };

  const getSectionName = () => {
    return sections.find(s => String(s.id) === String(selectedSection))?.name || '';
  };

  const displayedRows = React.useMemo(() => {
    const arr = Array.isArray(rankings) ? [...rankings] : [];
    const rollNum = (r) => {
      const s = String(r?.student?.roll_number || '');
      const ascii = toAsciiDigits(s);
      const n = parseInt(ascii.replace(/\D/g, ''), 10);
      return Number.isNaN(n) ? 999999 : n;
    };
    if (sortBy === 'current') {
      arr.sort((a, b) => rollNum(a) - rollNum(b));
    } else if (sortBy === 'total') {
      arr.sort((a, b) => {
        const sa = a?.student?.id ?? a?.student_id ?? a?.student;
        const sb = b?.student?.id ?? b?.student_id ?? b?.student;
        const ta = getStudentDisplayedTotal(sa) ?? -1;
        const tb = getStudentDisplayedTotal(sb) ?? -1;
        if (tb !== ta) return tb - ta;
        return rollNum(a) - rollNum(b);
      });
    } else {
      arr.sort((a, b) => {
        const ra = parseInt(a?._new_roll ?? a?.rank ?? 999999, 10);
        const rb = parseInt(b?._new_roll ?? b?.rank ?? 999999, 10);
        if (ra !== rb) return ra - rb;
        return rollNum(a) - rollNum(b);
      });
    }
    return arr;
  }, [rankings, sortBy, resultsByStudent, displaySubjects]);

  const handlePrint = () => {
    window.print();
  };

  const downloadPDF = async () => {
    const el = printRef.current;
    if (!el) return;
    
    // Temporarily make it visible for html2canvas if needed, 
    // but off-screen rendering usually works if display is not none.
    
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait might be better for fewer columns
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    
    let position = 0;
    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    } else {
      let y = 0;
      const sliceHeight = canvas.height * (pageHeight / imgHeight);
      while (y < canvas.height) {
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(sliceHeight, canvas.height - y);
        const ctx = pageCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, y, pageCanvas.width, pageCanvas.height, 0, 0, pageCanvas.width, pageCanvas.height);
        const pageImgData = pageCanvas.toDataURL('image/png');
        if (y === 0) {
          pdf.addImage(pageImgData, 'PNG', 0, 0, imgWidth, pageCanvas.height * (imgWidth / pageCanvas.width));
        } else {
          pdf.addPage();
          pdf.addImage(pageImgData, 'PNG', 0, 0, imgWidth, pageCanvas.height * (imgWidth / pageCanvas.width));
        }
        y += sliceHeight;
      }
    }
    pdf.save(`rank-list-${getClassName()}-${getSectionName()}.pdf`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ '@media print': { display: 'none' } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4" gutterBottom>Student Rankings</Typography>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>ব্যাক</Button>
      </Stack>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <FormControl fullWidth>
              <InputLabel id="ranklist-exam-label">Examination</InputLabel>
              <Select
                labelId="ranklist-exam-label"
                id="ranklist-exam"
                value={selectedExamType}
                label="Examination"
                onChange={(e) => {
                  setSelectedExamType(e.target.value);
                  setRankings([]);
                  setErrorMessage('');
                }}
              >
                <MenuItem value="">
                  <em>Select Examination</em>
                </MenuItem>
                {examTypes.map(type => (
                  <MenuItem key={type} value={type}>
                    {EXAM_TYPE_LABELS[type] || type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={5}>
            <FormControl fullWidth>
              <InputLabel id="ranklist-class-label">Class</InputLabel>
              <Select
                labelId="ranklist-class-label"
                id="ranklist-class"
                value={selectedClass}
                label="Class"
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedSection('');
                  setRankings([]);
                  setErrorMessage('');
                }}
              >
                <MenuItem value="">
                  <em>Select Class</em>
                </MenuItem>
                {classrooms.map(cls => (
                  <MenuItem key={cls.id} value={String(cls.id)}>
                    {cls.name || cls.class_name || cls.title || cls.className || `Class ${cls.id}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel id="ranklist-year-label">Year</InputLabel>
              <Select
                labelId="ranklist-year-label"
                id="ranklist-year"
                value={String(selectedYear)}
                label="Year"
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
              >
                {Array.from({ length: 12 }, (_, i) => String(new Date().getFullYear() - i)).map(y => (
                  <MenuItem key={y} value={y}>{y}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel id="ranklist-sortby-label">Sort By</InputLabel>
              <Select
                labelId="ranklist-sortby-label"
                id="ranklist-sortby"
                value={sortBy}
                label="Sort By"
                onChange={(e) => setSortBy(e.target.value)}
              >
                <MenuItem value="current">Current Roll</MenuItem>
                <MenuItem value="rank">New Roll (Rank)</MenuItem>
                <MenuItem value="total">Total Marks</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth disabled={!selectedClass}>
              <InputLabel id="ranklist-section-label">Section</InputLabel>
              <Select
                labelId="ranklist-section-label"
                id="ranklist-section"
                value={selectedSection}
                label="Section"
                onChange={(e) => {
                  setSelectedSection(e.target.value);
                  setRankings([]);
                  setErrorMessage('');
                }}
              >
                <MenuItem value="">
                  <em>Select Section</em>
                </MenuItem>
                {sections.map(sec => (
                  <MenuItem key={sec.id} value={String(sec.id)}>
                    {sec.name || `Section ${sec.id}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              onClick={handleFetchRankings}
              disabled={!selectedExamType || !selectedClass || !selectedSection || loading}
              fullWidth
            >
              Show
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
        {errorMessage ? (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography color="error">{errorMessage}</Typography>
          </Paper>
        ) : null}
        {rankings.length > 0 && (
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={downloadPDF}>
              ডাউনলোড PDF
            </Button>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
              প্রিন্ট
            </Button>
          </Stack>
        )}
        <TableContainer component={Paper} ref={tableRef}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Current Roll</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Section</TableCell>
                <TableCell>Group</TableCell>
                <TableCell>Total Marks</TableCell>
                <TableCell>Result Status</TableCell>
                <TableCell>Failed Subjects</TableCell>
                <TableCell>AVG. GPA</TableCell>
                <TableCell>AVG. Grade</TableCell>
                <TableCell>Remarks</TableCell>
                <TableCell>New Roll</TableCell>
                {displaySubjects.map(item => <TableCell key={item.canonical} align="center">{item.label}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedRows.map(row => (
                <TableRow key={row.student?.id || `${row.rank}-${row.student?.roll_number || ''}`}>
                  <TableCell>{row.student?.roll_number ?? 'N/A'}</TableCell>
                  <TableCell>{`${row.student?.user?.first_name || ''} ${row.student?.user?.last_name || ''}`.trim() || row.student?.user?.username || 'N/A'}</TableCell>
                  <TableCell>{row.student?.classroom?.name || classrooms.find(c => String(c.id) === String(selectedClass))?.name || 'N/A'}</TableCell>
                  <TableCell>{row.student?.section?.name ?? 'N/A'}</TableCell>
                  <TableCell>{row.student?.group ?? 'N/A'}</TableCell>
                  <TableCell>{getStudentDisplayedTotal(row?.student?.id ?? row?.student_id ?? row?.student) ?? row.total_marks_obtained ?? 'N/A'}</TableCell>
                  <TableCell>
                    <Chip
                      label={row.is_passed ? 'Passed' : 'Failed'}
                      color={row.is_passed ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{row.failed_subjects_count ?? 0}</TableCell>
                  <TableCell>{row.cgpa ?? 'N/A'}</TableCell>
                  <TableCell>
                    {row.grade ? <Chip
                      label={row.grade}
                      size="small"
                      sx={{
                        backgroundColor: getGradeStyle(row.grade).bg,
                        color: getGradeStyle(row.grade).fg,
                        fontWeight: 'bold'
                      }}
                    /> : 'N/A'}
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell>{row._new_roll ?? 'N/A'}</TableCell>
                  {displaySubjects.map(item => {
                    const sid = row?.student?.id ?? row?.student_id ?? row?.student;
                    const map = getStudentResultsMap(sid);
                    const r = resolveResult(sid, item, map);
                    const val = r ? resultTotal(r) : null;
                    const fail = r ? (
                      (r?.grade === 'F') ||
                      (r?.is_passed === false) ||
                      (typeof val === 'number' && val < passMarks)
                    ) : false;
                    return <TableCell key={item.canonical} align="center" sx={{ color: fail ? '#d32f2f' : 'inherit', fontWeight: fail ? 700 : 400 }}>{val != null ? `${val}` : '—'}</TableCell>;
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        </>
      )}
      </Box>
      <Box
        ref={printRef}
        sx={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '210mm',
          padding: '20px',
          backgroundColor: 'white',
          '@media print': {
            position: 'static',
            left: 'auto',
            top: 'auto',
            width: '100%',
            display: 'block'
          }
        }}
      >
        <Typography variant="h5" align="center" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          Class: {getClassName()} &nbsp;&nbsp; Section: {getSectionName()}
        </Typography>
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #ddd' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>Current Roll</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>Total Marks</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>Failed Subjects</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>New Roll</TableCell>
                {displaySubjects.map(item => <TableCell key={item.canonical} sx={{ fontWeight: 'bold', border: '1px solid #ddd' }} align="center">{item.label}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedRows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell sx={{ border: '1px solid #ddd' }}>{row.student?.roll_number ?? 'N/A'}</TableCell>
                  <TableCell sx={{ border: '1px solid #ddd' }}>{`${row.student?.user?.first_name || ''} ${row.student?.user?.last_name || ''}`.trim() || row.student?.user?.username || 'N/A'}</TableCell>
                  <TableCell sx={{ border: '1px solid #ddd' }}>{getStudentDisplayedTotal(row?.student?.id ?? row?.student_id ?? row?.student) ?? row.total_marks_obtained ?? 'N/A'}</TableCell>
                  <TableCell sx={{ border: '1px solid #ddd' }}>{row.failed_subjects_count ?? 0}</TableCell>
                  <TableCell sx={{ border: '1px solid #ddd' }}>{row._new_roll ?? 'N/A'}</TableCell>
                  {displaySubjects.map(item => {
                    const sid = row?.student?.id ?? row?.student_id ?? row?.student;
                    const map = getStudentResultsMap(sid);
                    const r = resolveResult(sid, item, map);
                    const val = r ? resultTotal(r) : null;
                    const fail = r ? (
                      (r?.grade === 'F') ||
                      (r?.is_passed === false) ||
                      (typeof val === 'number' && val < passMarks)
                    ) : false;
                    return <TableCell key={item.canonical} sx={{ border: '1px solid #ddd', color: fail ? '#d32f2f' : 'inherit', fontWeight: fail ? 700 : 400 }} align="center">{val != null ? `${val}` : '—'}</TableCell>;
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default RankListPage;
