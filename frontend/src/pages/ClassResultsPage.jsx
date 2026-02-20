import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Stack, Button, TextField, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PrintIcon from '@mui/icons-material/Print';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import api from '../utils/api';
import { scopedGet } from '../utils/schoolApi';
import { useAcademics } from '../context/AcademicsContext';

export default function ClassResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { classrooms, refreshClassrooms } = useAcademics();
  const [selectedClass, setSelectedClass] = useState('');
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [examTypes] = useState([
    { value: 'all', label: 'সব পরীক্ষা' },
    { value: 'annual', label: 'বার্ষিক' },
    { value: 'half_yearly', label: 'অর্ধবার্ষিক' },
    { value: 'terminal', label: 'টার্মিনাল' },
    { value: 'test', label: 'বিশেষ মূল্যায়ন' },
    { value: 'model', label: 'মডেল টেস্ট' },
    { value: 'first_term', label: 'প্রথম টার্ম' },
    { value: 'final', label: 'ফাইনাল' }
  ]);
  const [selectedExamType, setSelectedExamType] = useState('annual');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [students, setStudents] = useState([]);
  const [examinations, setExaminations] = useState([]);
  const [resultsByStudent, setResultsByStudent] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [fallbackSubjects, setFallbackSubjects] = useState([]);
  const [schoolSubjects, setSchoolSubjects] = useState([]);
  const [overallRanks, setOverallRanks] = useState(new Map());
  const [overallTotals, setOverallTotals] = useState(new Map());
  const [activeExamId, setActiveExamId] = useState(null);
  const [noYearMessage, setNoYearMessage] = useState('');

  useEffect(() => {
    if (!id) return;
    refreshClassrooms(id).catch(() => {});
  }, [id, refreshClassrooms]);

  useEffect(() => {
    if (!selectedClass) {
      setSections([]);
      setStudents([]);
      setExaminations([]);
      setResultsByStudent(new Map());
      return;
    }
    scopedGet('/api/academics/sections/', id, { classroom: selectedClass }, { timeout: 15000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setSections(Array.isArray(data) ? data : []);
      })
      .catch(() => setSections([]));
    const effectiveSection = (typeof selectedSection === 'number' && Number.isFinite(selectedSection)) ? selectedSection : undefined;
    scopedGet('/api/academics/students/', id, { classroom: selectedClass, section: effectiveSection }, { timeout: 30000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
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
  }, [id, selectedClass, selectedSection, refreshClassrooms]);

  const normalizeExamType = (t, name = '') => {
    const x = String(t || '').toLowerCase();
    const n = String(name || '').toLowerCase();
    if (x) return x;
    if (/বার্ষিক|annual|final/.test(n)) return 'annual';
    if (/অর্ধ|half|mid/.test(n)) return 'half_yearly';
    if (/টার্মিনাল|terminal|term/.test(n)) return 'terminal';
    if (/মডেল|model/.test(n)) return 'model';
    if (/first\s*term|প্রথম\s*টার্ম/.test(n)) return 'first_term';
    if (/টেস্ট|test|monthly/.test(n)) return 'test';
    return x || 'annual';
  };

  useEffect(() => {
    if (!selectedClass) {
      setExaminations([]);
      setResultsByStudent(new Map());
      return;
    }
    setLoading(true);
    scopedGet('/api/results/examinations/', id, { classroom: selectedClass, page_size: 2000, year: selectedYear }, { timeout: 30000 })
      .then(async res => {
        const all = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const filterType = normalizeExamType(selectedExamType || 'all');
        const exams = filterType === 'all'
          ? all
          : all.filter(e => normalizeExamType(e.exam_type, e.name) === filterType);
        setExaminations(exams);
        const byStudent = new Map();
        const fetchResultsByClassPaginated = async () => {
          const collected = [];
          let page = 1;
          const pageSize = 500;
          const maxPages = 20;
          for (; page <= maxPages; page++) {
            try {
              const params = { classroom: selectedClass, page, page_size: pageSize, year: selectedYear };
              if (typeof selectedSection === 'number' && Number.isFinite(selectedSection)) params.section = selectedSection;
              const res = await scopedGet('/api/results/results/', id, params, { timeout: 15000 });
              const data = res.data;
              const arr = Array.isArray(data) ? data : (data?.results || []);
              if (!arr.length) break;
              collected.push(...arr);
              const hasNext = Boolean((data?.next || '').length);
              if (!hasNext && (!data?.count || arr.length < pageSize)) break;
            } catch (_) { break; }
          }
          return collected;
        };
        const fetchResultsPaginated = async (examId) => {
          const allResults = [];
          let page = 1;
          const pageSize = 500;
          const maxPages = 15;
          for (; page <= maxPages; page++) {
            try {
              const res = await scopedGet('/api/results/results/', id, { examination: examId, page, page_size: pageSize }, { timeout: 15000 });
              const data = res.data;
              const arr = Array.isArray(data) ? data : (data?.results || []);
              if (!arr.length) break;
              allResults.push(...arr);
              const hasNext = Boolean((data?.next || '').length);
              if (!hasNext && (!data?.count || arr.length < pageSize)) break;
            } catch (_) {
              break;
            }
          }
          return allResults;
        };
        const loadResultsForExams = async (list) => {
          for (const ex of list) {
            try {
              const params = { examination: ex.id, page_size: 3000 };
              if (typeof selectedSection === 'number' && Number.isFinite(selectedSection)) params.section = selectedSection;
              const rRes = await scopedGet('/api/results/results/', id, params, { timeout: 30000 });
              let arr = Array.isArray(rRes.data) ? rRes.data : (rRes.data?.results || []);
              if (!arr.length) {
                arr = await fetchResultsPaginated(ex.id);
              }
              for (const r of arr) {
                const stuObj = typeof r.student === 'object' ? r.student : null;
                const clsId = stuObj?.classroom?.id || stuObj?.classroom_id;
                const secId = stuObj?.section?.id || stuObj?.section_id;
                if (selectedClass && clsId && String(clsId) !== String(selectedClass)) continue;
                if (typeof selectedSection === 'number' && Number.isFinite(selectedSection)) {
                  if (secId != null && String(secId) !== String(selectedSection)) continue;
                }
                const sid = typeof r.student === 'object' ? r.student?.id : r.student;
                if (!sid) continue;
                const sidStr = String(sid);
                if (!byStudent.has(sidStr)) byStudent.set(sidStr, []);
                byStudent.get(sidStr).push(r);
              }
            } catch (_) {}
          }
        };
        await loadResultsForExams(exams);
        if (byStudent.size === 0 && Array.isArray(all) && all.length > 0) {
          await loadResultsForExams(all);
        }
        if (byStudent.size === 0) {
          const classArr = await fetchResultsByClassPaginated();
          for (const r of classArr) {
            const stuObj = typeof r.student === 'object' ? r.student : null;
            const clsId = stuObj?.classroom?.id || stuObj?.classroom_id;
            const secId = stuObj?.section?.id || stuObj?.section_id;
            if (selectedClass && clsId && String(clsId) !== String(selectedClass)) continue;
            if (typeof selectedSection === 'number' && Number.isFinite(selectedSection)) {
              if (secId != null && String(secId) !== String(selectedSection)) continue;
            }
            const sid = typeof r.student === 'object' ? r.student?.id : r.student;
            if (!sid) continue;
            const sidStr = String(sid);
            if (!byStudent.has(sidStr)) byStudent.set(sidStr, []);
            byStudent.get(sidStr).push(r);
          }
        }
        const fetchResultsByStudentPaginated = async (stuId) => {
          const all = [];
          let page = 1;
          const pageSize = 500;
          const maxPages = 20;
          for (; page <= maxPages; page++) {
            try {
              const params = { student: stuId, page, page_size: pageSize, year: selectedYear };
              const res = await scopedGet('/api/results/results/', id, params, { timeout: 15000 });
              const data = res.data;
              const arr = Array.isArray(data) ? data : (data?.results || []);
              if (!arr.length) break;
              all.push(...arr);
              const hasNext = Boolean((data?.next || '').length);
              if (!hasNext && (!data?.count || arr.length < pageSize)) break;
            } catch (_) { break; }
          }
          return all;
        };
        if (byStudent.size === 0 && (students || []).length > 0) {
          for (const s of students) {
            try {
              const sidStr = String(s.id);
              const arr = await fetchResultsByStudentPaginated(s.id);
              if (arr && arr.length) {
                if (!byStudent.has(sidStr)) byStudent.set(sidStr, []);
                for (const it of arr) byStudent.get(sidStr).push(it);
              }
            } catch (_) {}
          }
        }
        setResultsByStudent(byStudent);
        if (byStudent.size === 0) {
          setNoYearMessage(`দুঃখিত ${selectedYear} সালের রেজাল্ট এই স্কুলে এখনও ইনপুট দেওয়া হয়নি, দয়া করে অত্র বিদ্যালয়ের প্রধান শিক্ষক অথবা এ্যাডমিনের সাথে যোগাযোগ করুন। ধন্যবাদ।`);
        } else {
          setNoYearMessage('');
        }
        // Load overall ranks/totals for the examination that matches loaded results best
        try {
          const examCounts = new Map();
          for (const arr of byStudent.values()) {
            for (const r of arr) {
              const exId = typeof r.examination === 'object' ? r.examination?.id : r.examination;
              if (!exId) continue;
              const key = String(exId);
              examCounts.set(key, (examCounts.get(key) || 0) + 1);
            }
          }
          const examsSorted = [...(Array.isArray(exams) ? exams : [])].sort((a, b) => {
            const ad = a.exam_date ? new Date(a.exam_date).getTime() : 0;
            const bd = b.exam_date ? new Date(b.exam_date).getTime() : 0;
            if (bd !== ad) return bd - ad;
            return b.id - a.id;
          });
          const candidateIds = [];
          if (examCounts.size > 0) {
            for (const [k] of [...examCounts.entries()].sort((a, b) => b[1] - a[1])) candidateIds.push(k);
          }
          for (const ex of examsSorted) {
            const k = String(ex.id);
            if (!candidateIds.includes(k)) candidateIds.push(k);
          }
          let pickedId = null;
          let pickedRanks = new Map();
          let pickedTotals = new Map();
          for (const exId of candidateIds) {
            try {
              const params = { examination: exId, page_size: 2000 };
              if (typeof selectedSection === 'number' && Number.isFinite(selectedSection)) params.section = selectedSection;
              if (selectedClass) params.classroom = selectedClass;
              const resp = await scopedGet('/api/results/overall/', id, params, { timeout: 30000 });
              const data = resp.data;
              const arr = Array.isArray(data) ? data : (data?.results || []);
              if (!arr.length) continue;
              const m = new Map();
              const mt = new Map();
              for (const o of arr || []) {
                if (typeof selectedSection === 'number' && Number.isFinite(selectedSection)) {
                  const secId = o?.student?.section?.id || o?.student?.section_id;
                  if (secId != null && String(secId) !== String(selectedSection)) continue;
                }
                const sid = typeof o.student === 'object' ? o.student?.id : o.student;
                const rk = o.rank || o.position || null;
                if (sid && rk) m.set(String(sid), parseInt(rk, 10));
                const tot = o.total_marks_obtained != null ? parseFloat(o.total_marks_obtained) : null;
                if (sid && tot != null) mt.set(String(sid), tot);
              }
              pickedId = exId;
              pickedRanks = m;
              pickedTotals = mt;
              break;
            } catch (_) {}
          }
          setActiveExamId(pickedId || null);
          setOverallRanks(pickedRanks);
          setOverallTotals(pickedTotals);
        } catch (_) {
          setActiveExamId(null);
          setOverallRanks(new Map());
          setOverallTotals(new Map());
        }
      })
      .catch(() => {
        setExaminations([]);
        setResultsByStudent(new Map());
        setOverallRanks(new Map());
        setOverallTotals(new Map());
        setNoYearMessage(`দুঃখিত ${selectedYear} সালের রেজাল্ট এই স্কুলে এখনও ইনপুট দেওয়া হয়নি, দয়া করে অত্র বিদ্যালয়ের প্রধান শিক্ষক অথবা এ্যাডমিনের সাথে যোগাযোগ করুন। ধন্যবাদ।`);
      })
      .finally(() => setLoading(false));
  }, [id, selectedClass, selectedExamType, selectedSection, students, selectedYear]);

  const subjectOrder = [
    'বাংলা','Bangla','Bengali',
    'বাংলা প্রথম পত্র','Bangla First Paper','বাংলা-১ম','Bangla 1st Paper',
    'বাংলা দ্বিতীয় পত্র','Bangla Second Paper','বাংলা-২য়','Bangla 2nd Paper',
    'বাংলা ১+২','Bangla 1+2',
    'ইংরেজি','ইংরেজী','English',
    'ইংরেজি প্রথম পত্র','English First Paper','ইংরেজী-১ম','English 1st Paper',
    'ইংরেজি দ্বিতীয় পত্র','English Second Paper','ইংরেজী-২য়','English 2nd Paper','ইংরেজি-২য়',
    'ইংরেজি ১+২','English 1+2',
    'গণিত','Mathematics','সাধারণ গণিত','General Math',
    'বিজ্ঞান','Science',
    'বাংলাদেশ ও বিশ্বপরিচয়','Bangladesh and Global Studies','বাংলাদেশ ও বিশ্বপরিয়',
    'তথ্য ও যোগাযোগ প্রযুক্তি','Ict','ICT','আইসিটি',
    'ধর্ম','Religion','ধর্ম ও নৈতিক শিক্ষা','Islam and Moral Education','হিন্দু ধর্ম','Hindu Religion',
    'কৃষি','Agriculture','কৃষি শিক্ষা',
    'পদার্থ','Physics','পদার্থবিজ্ঞান',
    'রসায়ন','Chemistry',
    'জীববিজ্ঞান','Biology',
    'উচ্চতর গণিত','Higher Math','Higher Mathematics',
    'ইতিহাস','History','বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা',
    'ভূগোল','Geography','ভূগোল ও পরিবেশ',
    'পৌরনীতি','Civics','পৌরনীতি ও নাগরিকতা',
    'অর্থনীতি','Economics',
    'ব্যবসায় উদ্যোগ','Business Entrepreneurship',
    'ব্যবসায় শিক্ষা','Business Studies',
    'হিসাববিজ্ঞান','Accounting',
    'ফিন্যান্স','Finance','ফিন্যান্স ও ব্যাংকিং'
  ];
  const defaultSubjects = [
    'বাংলা','ইংরেজি','গণিত','বিজ্ঞান','বাংলাদেশ ও বিশ্বপরিচয়',
    'তথ্য ও যোগাযোগ প্রযুক্তি','ধর্ম','কৃষি','পদার্থ','রসায়ন','জীববিজ্ঞান','উচ্চতর গণিত'
  ];
  const normalizeName = (s) => String(s || '')
    .replace(/\u200c|\u200d/g, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
      bgs: [
        'bgs',
        'বাংলাদেশ ও বিশ্বপরিচয়',
        'বাংলাদেশ ও বিশ্ব পরিচয়',
        'Bangladesh and Global Studies',
        'বাংলাদেশ ও বিশ্বপরিয়',
        'BGS'
      ],
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
  const getStudentRawResults = (sid) => {
    const arrRaw = resultsByStudent.get(String(sid)) || [];
    return arrRaw;
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
      const raw = getStudentRawResults(sid);
      for (const x of raw) {
        const nm = normalizeName(x.subject?.name || x.subject_name || '');
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
  const isNineTen = useMemo(() => {
    const cls = classrooms.find(c => String(c.id) === String(selectedClass));
    const name = String(cls?.name || '').toLowerCase();
    if (!name) return false;
    if (/নবম|দশম/.test(name)) return true;
    if (/class\s*9|class\s*10/.test(name)) return true;
    if (/\b9\b|\b10\b/.test(name)) return true;
    return false;
  }, [classrooms, selectedClass]);
  const subjects = useMemo(() => {
    const set = new Set();
    for (const arr of resultsByStudent.values()) {
      for (const r of arr) {
        const nm = normalizeName(r.subject?.name || r.subject_name || '');
        if (nm) set.add(nm);
      }
    }
    const list = Array.from(set);
    const idx = (name) => {
      if (!name) return 9999;
      const i1 = subjectOrder.indexOf(name);
      if (i1 !== -1) return i1;
      return 9000 + list.indexOf(name);
    };
    return list.sort((a, b) => idx(a) - idx(b));
  }, [resultsByStudent]);

  useEffect(() => {
    if (!selectedClass) { setFallbackSubjects([]); return; }
    api.get(`/api/academics/classrooms/${selectedClass}/subjects/`)
      .then(res => {
        const arr = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const items = [];
        const seen = new Set();
        for (const s of arr) {
          const raw = normalizeName(s.name || s.subject_name || '');
          const can = canonicalSubjectName(raw);
          if (!can) continue;
          const label = raw || labelForCanonical(can);
          const key = `${can}::${label}`;
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({ id: s.id, label, canonical: can });
        }
        setFallbackSubjects(items);
      })
      .catch(() => setFallbackSubjects([]));
  }, [id, selectedClass]);

  useEffect(() => {
    if (!id) { setSchoolSubjects([]); return; }
    api.get(`/api/academics/subjects/?school=${id}`)
      .then(res => {
        const arr = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const items = [];
        const seen = new Set();
        for (const s of arr || []) {
          const raw = normalizeName(s.name || s.subject_name || '');
          const can = canonicalSubjectName(raw);
          const key = `${s.id}::${can}`;
          if (!can || seen.has(key)) continue;
          seen.add(key);
          items.push({ id: s.id, label: raw || labelForCanonical(can), canonical: can });
        }
        setSchoolSubjects(items);
      })
      .catch(() => setSchoolSubjects([]));
  }, [id]);

  const resultsCanonical = useMemo(() => {
    const set = new Set();
    for (const arr of resultsByStudent.values()) {
      for (const r of arr) {
        let nm = normalizeName(r.subject?.name || r.subject_name || '');
        let can = canonicalSubjectName(nm);
        if (!can || can === nm) {
          const subjId = typeof r.subject === 'object' ? r.subject?.id : r.subject;
          if (subjId) {
            const match = (fallbackSubjects || []).find(it => String(it.id) === String(subjId));
            if (match) {
              can = match.canonical || canonicalSubjectName(match.label);
            }
          }
        }
        if (can) set.add(can);
      }
    }
    return set;
  }, [resultsByStudent, fallbackSubjects]);

  const displaySubjects = useMemo(() => {
    const orderKeys = [
      'bangla_1st','bangla_2nd','bangla','bangla_combined','english_1st','english_2nd','english','english_combined',
      'math','science','bgs','ict','religion','agriculture',
      'physics','chemistry','biology','higher_math','history',
      'geography','civics','economics','business_entrepreneurship',
      'business_studies','accounting','finance'
    ];
    const endKeys = ['agriculture','physics','chemistry','history','geography','business_entrepreneurship','finance'];
    const sortScore = (label) => {
      const key = canonicalSubjectName(label);
      const base = orderKeys.indexOf(key);
      if (base === -1) return 9999;
      const endIdx = endKeys.indexOf(key);
      return endIdx !== -1 ? 10000 + endIdx : base;
    };
    const merged = new Map();
    const allowed = new Set((fallbackSubjects || []).map(item => item.canonical));
    const schoolAllowed = new Set((schoolSubjects || []).map(item => item.canonical));
    const addCan = (can, srcItem = null) => {
      if (can && !merged.has(can)) {
        const id = srcItem && srcItem.id ? srcItem.id : undefined;
        const label = srcItem && srcItem.label ? srcItem.label : labelForCanonical(can);
        merged.set(can, { id, label, canonical: can });
      }
    };
    const expandGeneric = (can) => {
      const lower = String(can || '').toLowerCase();
      if (lower === 'bangla' || lower === 'বাংলা' || lower === 'bengali') {
        const has1 = resultsCanonical.has('bangla_1st');
        const has2 = resultsCanonical.has('bangla_2nd');
        if (has1) addCan('bangla_1st');
        if (has2) addCan('bangla_2nd');
        if (!has1 && !has2) addCan('bangla');
        return true;
      }
      if (lower === 'english' || lower === 'ইংরেজি' || lower === 'ইংরেজী') {
        const has1 = resultsCanonical.has('english_1st');
        const has2 = resultsCanonical.has('english_2nd');
        if (has1) addCan('english_1st');
        if (has2) addCan('english_2nd');
        if (!has1 && !has2) addCan('english');
        return true;
      }
      return false;
    };
    if (allowed.size) {
      for (const item of fallbackSubjects) {
        const can = item.canonical;
        if (!can) continue;
        if (!expandGeneric(can)) addCan(can, item);
      }
      for (const item of schoolSubjects || []) {
        const can = item.canonical;
        if (!can) continue;
        if (!expandGeneric(can)) addCan(can, item);
      }
      for (const s of (subjects || [])) {
        const can = canonicalSubjectName(s);
        if (!expandGeneric(can)) addCan(can);
      }
      for (const key of resultsCanonical) {
        if (!expandGeneric(key)) addCan(key);
      }
    } else {
      for (const s of (subjects || [])) {
        const can = canonicalSubjectName(s);
        if (!expandGeneric(can)) addCan(can);
      }
      for (const item of schoolSubjects || []) {
        const can = item.canonical;
        if (!can) continue;
        if (!expandGeneric(can)) addCan(can, item);
      }
      for (const key of resultsCanonical) {
        if (!expandGeneric(key)) addCan(key);
      }
      if (merged.size === 0) {
        for (const s of (defaultSubjects || [])) {
          const can = canonicalSubjectName(s);
          if (!expandGeneric(can)) addCan(can);
        }
      }
    }
    if (isNineTen) {
      const hasB = merged.has('bangla_1st') || merged.has('bangla_2nd') || resultsCanonical.has('bangla_1st') || resultsCanonical.has('bangla_2nd');
      if (hasB) {
        merged.delete('bangla_1st');
        merged.delete('bangla_2nd');
        addCan('bangla_combined');
      }
      const hasE = merged.has('english_1st') || merged.has('english_2nd') || resultsCanonical.has('english_1st') || resultsCanonical.has('english_2nd');
      if (hasE) {
        merged.delete('english_1st');
        merged.delete('english_2nd');
        addCan('english_combined');
      }
    }
    // Ensure BGS column always exists (common mandatory subject)
    if (!merged.has('bgs')) addCan('bgs');
    const arr = Array.from(merged.values());
    return arr.sort((a, b) => sortScore(a.label) - sortScore(b.label));
  }, [subjects, fallbackSubjects, resultsCanonical, resultsByStudent, schoolSubjects, isNineTen]);

  const getStudentResultsMap = (sid) => {
    const sidStr = String(sid);
    const arrRaw = resultsByStudent.get(sidStr) || [];
    const arr = arrRaw;
    const m = new Map();
    for (const r of arr) {
      let nm = normalizeName(r.subject?.name || r.subject_name || '');
      let key = canonicalSubjectName(nm) || nm;
      if (!nm || !key) {
        const subjId = typeof r.subject === 'object' ? r.subject?.id : r.subject;
        if (subjId) {
          let match = (fallbackSubjects || []).find(it => String(it.id) === String(subjId));
          if (!match) match = (schoolSubjects || []).find(it => String(it.id) === String(subjId));
          if (match) {
            nm = match.label;
            key = match.canonical || canonicalSubjectName(match.label) || match.label;
          }
        }
      }
      if (!nm || !key) continue;
      const w = parseFloat(r.written_marks) || 0;
      const mcq = parseFloat(r.mcq_marks) || 0;
      const pr = parseFloat(r.practical_marks) || 0;
      const total = r.total_obtained != null && r.total_obtained !== '' ? (parseFloat(r.total_obtained) || 0) : (w + mcq + pr);
      const grade = r.grade || '';
      // Key by canonical and by normalized label
      m.set(key, { total, grade });
      const rawKey = normalizeName(nm);
      if (rawKey && rawKey !== key) m.set(rawKey, { total, grade });
      // Also key by subject id if available
      const subjId2 = typeof r.subject === 'object' ? r.subject?.id : r.subject;
      if (subjId2) m.set(`id:${String(subjId2)}`, { total, grade });
    }
    return m;
  };

  const totalsMap = useMemo(() => {
    const m = new Map();
    for (const s of students || []) {
      const map = getStudentResultsMap(s.id);
      let sum = 0;
      for (const item of displaySubjects) {
        const r = resolveResult(s.id, item, map);
        if (r) sum += resultTotal(r);
      }
      m.set(String(s.id), sum);
    }
    return m;
  }, [students, resultsByStudent, displaySubjects]);

  const newRollMap = useMemo(() => {
    const m = new Map();
    const toAsciiDigits = (s) => {
      return String(s || '')
        .replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
        .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    };
    const rollNumOf = (s) => {
      const rollStr = String(s.roll_number || '');
      const ascii = toAsciiDigits(rollStr);
      const n = parseInt(ascii.replace(/\D/g, ''), 10);
      return Number.isNaN(n) ? 999999 : n;
    };
    const getSecId = (s) => {
      const sec = s?.section;
      if (typeof sec === 'object') return sec?.id ?? sec?.section_id ?? null;
      return s?.section_id ?? null;
    };
    if (typeof selectedSection === 'number' && Number.isFinite(selectedSection)) {
      const list = (students || []).filter(s => String(getSecId(s)) === String(selectedSection));
      const arr = list.map(s => ({ s, total: totalsMap.get(String(s.id)) || 0, rollNum: rollNumOf(s) }));
      arr.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.rollNum - b.rollNum;
      });
      let rk = 1;
      for (const it of arr) m.set(String(it.s.id), rk++);
      return m;
    }
    const bySection = new Map();
    for (const s of students || []) {
      const secId = getSecId(s) ?? 'none';
      if (!bySection.has(secId)) bySection.set(secId, []);
      bySection.get(secId).push(s);
    }
    for (const [secId, list] of bySection.entries()) {
      const arr = list.map(s => ({ s, total: totalsMap.get(String(s.id)) || 0, rollNum: rollNumOf(s) }));
      arr.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.rollNum - b.rollNum;
      });
      let rk = 1;
      for (const it of arr) m.set(String(it.s.id), rk++);
    }
    return m;
  }, [students, totalsMap, selectedSection]);


  const handlePrint = () => {
    window.print();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4">
          <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          ক্লাস রেজাল্টস (সকল শিক্ষার্থী, সকল বিষয়)
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>ব্যাক</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>প্রিন্ট</Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack spacing={2} direction={{ xs: 'column', md: 'row' }}>
          <TextField select label="শ্রেণি" value={selectedClass} onChange={(e) => setSelectedClass(parseInt(e.target.value, 10) || '')} sx={{ minWidth: 220 }}>
            <MenuItem value="">{classrooms.length ? 'শ্রেণি নির্বাচন করুন' : 'লোড হচ্ছে...'}</MenuItem>
            {classrooms.map(cls => <MenuItem key={cls.id} value={cls.id}>{cls.name}</MenuItem>)}
          </TextField>
          <TextField select label="সেকশন" value={selectedSection} onChange={(e) => setSelectedSection(parseInt(e.target.value, 10) || '')} sx={{ minWidth: 200 }} disabled={!selectedClass}>
            <MenuItem value="">{sections.length ? 'সেকশন নির্বাচন করুন' : 'কোনো সেকশন নেই'}</MenuItem>
            {sections.map(sec => <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>)}
          </TextField>
          <TextField select label="পরীক্ষার ধরন" value={selectedExamType} onChange={(e) => setSelectedExamType(e.target.value)} sx={{ minWidth: 200 }} disabled={!selectedClass}>
            {examTypes.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </TextField>
          <TextField
            type="number"
            label="সাল"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value || String(new Date().getFullYear()), 10) || new Date().getFullYear())}
            sx={{ minWidth: 140 }}
            disabled={!selectedClass}
            inputProps={{ min: 2000, max: 2100 }}
          />
          <Button variant="contained" onClick={() => setSelectedExamType('all')} disabled={!selectedClass}>
            সব দেখাও
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Roll</TableCell>
              <TableCell>Student</TableCell>
              <TableCell align="center">প্রাপ্ত মোট নাম্বার</TableCell>
              <TableCell align="center">নতুন রোল</TableCell>
                  {displaySubjects.map(item => <TableCell key={item.canonical || item.label} align="center">{item.label}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {(students || []).map(stu => {
              const map = getStudentResultsMap(stu.id);
              return (
                <TableRow key={stu.id}>
                  <TableCell>{stu.roll_number || 'N/A'}</TableCell>
                  <TableCell>{`${stu.user?.first_name || ''} ${stu.user?.last_name || ''}`.trim() || stu.user?.username || 'N/A'}</TableCell>
                  <TableCell align="center">{totalsMap.get(String(stu.id)) || 0}</TableCell>
                  <TableCell align="center">{newRollMap.get(String(stu.id)) || ''}</TableCell>
                  {displaySubjects.map(item => {
                    const r = resolveResult(stu.id, item, map);
                    const txt = r ? `${resultTotal(r)}` : '—';
                    return <TableCell key={item.canonical || item.label} align="center">{txt}</TableCell>;
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {loading && (
        <Typography variant="body2" sx={{ mt: 2 }}>লোড হচ্ছে...</Typography>
      )}
      {!loading && selectedClass && noYearMessage && (
        <Typography variant="body2" sx={{ mt: 2, color: 'error.main' }}>{noYearMessage}</Typography>
      )}
    </Box>
  );
}
