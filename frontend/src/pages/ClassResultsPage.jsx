import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Stack, Button, TextField, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PrintIcon from '@mui/icons-material/Print';
import { Download as DownloadIcon } from '@mui/icons-material';
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
  const [selectedExamType, setSelectedExamType] = useState('all');
  const [selectedExamId, setSelectedExamId] = useState('');
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
  const [autoYearTried, setAutoYearTried] = useState(false);

  const displayStudentsList = useMemo(() => {
    if (Array.isArray(students) && students.length > 0) return students;
    const arr = [];
    for (const [sidStr, resArr] of resultsByStudent.entries()) {
      const first = Array.isArray(resArr) && resArr.length ? resArr[0] : null;
      const stuObj = typeof first?.student === 'object' ? first.student : null;
      const sid = stuObj?.id ?? (typeof first?.student === 'number' ? first?.student : parseInt(sidStr, 10));
      if (!sid) continue;
      const sectionId = stuObj?.section?.id ?? stuObj?.section_id ?? null;
      const sectionName = stuObj?.section?.name ?? null;
      const classroomId = stuObj?.classroom?.id ?? stuObj?.classroom_id ?? null;
      const user = stuObj?.user ? stuObj.user : {
        first_name: stuObj?.first_name || '',
        last_name: stuObj?.last_name || '',
        username: stuObj?.username || ''
      };
      const roll_number = stuObj?.roll_number || '';
      arr.push({
        id: sid,
        user,
        section: sectionId != null ? { id: sectionId, name: sectionName } : null,
        classroom: classroomId != null ? { id: classroomId } : null,
        roll_number
      });
    }
    return arr;
  }, [students, resultsByStudent]);

  const passMarks = useMemo(() => {
    try {
      const ex = (examinations || []).find(e => e && e.pass_marks != null);
      const pm = parseFloat(ex?.pass_marks);
      return Number.isFinite(pm) && pm > 0 ? pm : 33;
    } catch (_) { return 33; }
  }, [examinations]);

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
    (async () => {
      try {
        const all = [];
        let page = 1;
        const pageSize = 500;
        const maxPages = 40;
        for (; page <= maxPages; page++) {
          const params = { classroom: selectedClass, page, page_size: pageSize };
          if (effectiveSection !== undefined) params.section = effectiveSection;
          const r = await scopedGet('/api/academics/students/', id, params, { timeout: 30000 });
          const data = r.data;
          const arr = Array.isArray(data) ? data : (data?.results || []);
          if (!arr.length) break;
          all.push(...arr);
          const hasNext = Boolean((data?.next || '').length);
          if (hasNext) continue;
          if (typeof data?.count === 'number') {
            if (page * pageSize >= data.count) break;
          } else {
            if (arr.length < pageSize) break;
          }
        }
        // Deduplicate by student id in case the backend ignores pagination params
        const byId = new Map();
        for (const s of all) {
          const sid = String(s.id ?? s.student_id ?? '');
          if (!sid) continue;
          if (!byId.has(sid)) byId.set(sid, s);
        }
        const uniq = Array.from(byId.values());
        const sorted = [...uniq].sort((a, b) => {
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
      } catch (_) {
        setStudents([]);
      }
    })();
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
    const effectiveSectionGlobal = (() => {
      const n = parseInt(String(selectedSection), 10);
      return Number.isFinite(n) ? n : undefined;
    })();
    const bnDigitMap = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
    const normalizeDigits = (s) => String(s || '').replace(/[০-৯]/g, (d) => bnDigitMap[d] ?? d);
    const extractYear = (r) => {
      try {
        const y1 = r?.year ?? r?.exam_year ?? r?.examYear;
        if (typeof y1 === 'number') return y1;
        if (typeof y1 === 'string') {
          const ns = normalizeDigits(y1);
          if (/^\d{4}$/.test(ns)) return parseInt(ns, 10);
        }
      } catch (_) {}
      try {
        const ex = r?.examination;
        const y2 = ex?.year ?? ex?.exam_year ?? ex?.examYear;
        if (typeof y2 === 'number') return y2;
        if (typeof y2 === 'string') {
          const ns = normalizeDigits(y2);
          if (/^\d{4}$/.test(ns)) return parseInt(ns, 10);
        }
        const nameStr = normalizeDigits(ex?.name || r?.name || '');
        const nameMatch = nameStr.match(/(20\d{2})/);
        if (nameMatch) return parseInt(nameMatch[1], 10);
        const dt = ex?.exam_date || ex?.date || r?.exam_date || r?.date || r?.created_at;
        if (dt) {
          const d = new Date(dt);
          if (!isNaN(d.getTime())) return d.getFullYear();
        }
      } catch (_) {}
      return null;
    };
    scopedGet('/api/results/examinations/', id, { classroom: selectedClass, page_size: 2000, year: selectedYear }, { timeout: 30000 })
      .then(async res => {
        const all = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const filterType = normalizeExamType(selectedExamType || 'all');
        let exams = filterType === 'all'
          ? all
          : all.filter(e => normalizeExamType(e.exam_type, e.name) === filterType);
        if (selectedExamId) {
          exams = exams.filter(e => String(e.id) === String(selectedExamId));
        }
        setExaminations(exams);
        const examIdSet = new Set((exams || []).map(e => String(e.id)));
        const isResultForSelectedYear = (r) => {
          try {
            const exIdRaw = (typeof r.examination === 'object') ? r.examination?.id : r.examination;
            if (exIdRaw != null && examIdSet.has(String(exIdRaw))) return true;
          } catch (_) {}
          const y = extractYear(r);
          if (y == null) {
            return examIdSet.size === 0;
          }
          return Number(y) === Number(selectedYear);
        };
        const byStudent = new Map();
        const fetchResultsByClassPaginated = async () => {
          const collected = [];
          let page = 1;
          const pageSize = 500;
          const maxPages = 20;
          for (; page <= maxPages; page++) {
            try {
              const params = { classroom: selectedClass, page, page_size: pageSize };
              if (typeof selectedSection === 'number' && Number.isFinite(selectedSection)) params.section = selectedSection;
              const res = await scopedGet('/api/results/results/', id, params, { timeout: 15000 });
              const data = res.data;
              const arr = Array.isArray(data) ? data : (data?.results || []);
          if (!arr.length) break;
              collected.push(...arr.filter(isResultForSelectedYear));
              const hasNext = Boolean((data?.next || '').length);
              if (hasNext) continue;
              if (typeof data?.count === 'number') {
                if (page * pageSize >= data.count) break;
              } else {
                if (arr.length < pageSize) break;
              }
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
              allResults.push(...arr.filter(isResultForSelectedYear));
          const hasNext = Boolean((data?.next || '').length);
          if (hasNext) continue;
          if (typeof data?.count === 'number') {
            if (page * pageSize >= data.count) break;
          } else {
            if (arr.length < pageSize) break;
          }
            } catch (_) {
              break;
            }
          }
          return allResults;
        };
        const loadResultsForExams = async (list, ignoreSection = false) => {
          for (const ex of list) {
            try {
              const params = { examination: ex.id, page_size: 3000 };
              if (!ignoreSection && effectiveSectionGlobal !== undefined) params.section = effectiveSectionGlobal;
              const rRes = await scopedGet('/api/results/results/', id, params, { timeout: 30000 });
              let arr = Array.isArray(rRes.data) ? rRes.data : (rRes.data?.results || []);
              if (!arr.length) {
                arr = await fetchResultsPaginated(ex.id);
              }
              arr = (arr || []).filter(isResultForSelectedYear);
              for (const r of arr) {
                const stuObj = typeof r.student === 'object' ? r.student : null;
                const clsId = stuObj?.classroom?.id || stuObj?.classroom_id;
                const secId = stuObj?.section?.id || stuObj?.section_id;
                if (!ignoreSection && effectiveSectionGlobal !== undefined) {
                  if (secId != null && String(secId) !== String(effectiveSectionGlobal)) continue;
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
        if (!selectedExamId && Array.isArray(all) && all.length > 0) {
          await loadResultsForExams(all);
        }
        // Always augment with class-scoped fetch to increase coverage
        const classArr = await fetchResultsByClassPaginated();
        for (const r of classArr) {
          const stuObj = typeof r.student === 'object' ? r.student : null;
          const clsId = stuObj?.classroom?.id || stuObj?.classroom_id;
          const secId = stuObj?.section?.id || stuObj?.section_id;
          const eff = (() => { const n = parseInt(String(selectedSection), 10); return Number.isFinite(n) ? n : undefined; })();
          if (eff !== undefined) {
            if (secId != null && String(secId) !== String(eff)) continue;
          }
          const sid = typeof r.student === 'object' ? r.student?.id : r.student;
          if (!sid) continue;
          const sidStr = String(sid);
          if (!byStudent.has(sidStr)) byStudent.set(sidStr, []);
          byStudent.get(sidStr).push(r);
        }
        if (byStudent.size === 0) {
          try {
            const rAll = await scopedGet('/api/results/examinations/', id, { page_size: 2000, year: selectedYear }, { timeout: 30000 });
            const arrAll = Array.isArray(rAll.data) ? rAll.data : (rAll.data?.results || []);
            const filterType2 = normalizeExamType(selectedExamType || 'all');
            const examsWide = filterType2 === 'all' ? arrAll : arrAll.filter(e => normalizeExamType(e.exam_type, e.name) === filterType2);
            if (Array.isArray(examsWide) && examsWide.length > 0) {
              await loadResultsForExams(examsWide, true);
            }
          } catch (_) {}
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
              all.push(...arr.filter(isResultForSelectedYear));
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
          if (!autoYearTried) {
            try {
              const p = { page_size: 2000 };
              if (selectedClass) p.classroom = selectedClass;
              const exResp = await scopedGet('/api/results/examinations/', id, p, { timeout: 30000 });
              const exArr = Array.isArray(exResp.data) ? exResp.data : (exResp.data?.results || []);
              const filterType3 = normalizeExamType(selectedExamType || 'all');
              const filtered = filterType3 === 'all' ? exArr : exArr.filter(e => normalizeExamType(e.exam_type, e.name) === filterType3);
              const years = filtered.map(e => {
                const y1 = e.exam_year != null ? parseInt(String(e.exam_year), 10) : null;
                const y2 = e.year != null ? parseInt(String(e.year), 10) : null;
                const y3 = e.exam_date ? new Date(e.exam_date).getFullYear() : null;
                return [y1, y2, y3].find(v => Number.isFinite(v) && v > 0) || null;
              }).filter(v => v != null);
              if (years.length > 0) {
                const latest = years.sort((a, b) => b - a)[0];
                if (latest && latest !== selectedYear) {
                  setAutoYearTried(true);
                  setSelectedYear(latest);
                  return;
                }
              }
              setAutoYearTried(true);
            } catch (_) {
              setAutoYearTried(true);
            }
          }
        } else {
          setNoYearMessage('');
          setAutoYearTried(false);
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
              if (effectiveSectionGlobal !== undefined) params.section = effectiveSectionGlobal;
              if (selectedClass) params.classroom = selectedClass;
              const resp = await scopedGet('/api/results/overall/', id, params, { timeout: 30000 });
              const data = resp.data;
              const arr = Array.isArray(data) ? data : (data?.results || []);
              if (!arr.length) {
                try {
                  const resp2 = await scopedGet('/api/results/overall/', id, { examination: exId, page_size: 2000, year: selectedYear }, { timeout: 30000 });
                  const data2 = resp2.data;
                  const arr2 = Array.isArray(data2) ? data2 : (data2?.results || []);
                  if (!arr2.length) continue;
                  const m2 = new Map();
                  const mt2 = new Map();
                  for (const o of arr2 || []) {
                    const sid = typeof o.student === 'object' ? o.student?.id : o.student;
                    const rk = o.rank || o.position || null;
                    if (sid && rk) m2.set(String(sid), parseInt(rk, 10));
                    const tot = o.total_marks_obtained != null ? parseFloat(o.total_marks_obtained) : null;
                    if (sid && tot != null) mt2.set(String(sid), tot);
                  }
                  pickedId = exId;
                  pickedRanks = m2;
                  pickedTotals = mt2;
                  break;
                } catch (_) { continue; }
              }
              const m = new Map();
              const mt = new Map();
              for (const o of arr || []) {
                if (effectiveSectionGlobal !== undefined) {
                  const secId = o?.student?.section?.id || o?.student?.section_id;
                  if (secId != null && String(secId) !== String(effectiveSectionGlobal)) continue;
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
      english_1st: ['english_1st','ইংরেজী-১ম','ইংরেজি প্রথম পত্র','English First Paper','ইংরেজি ১ম','ইংরেজী ১ম'],
      english_2nd: ['english_2nd','ইংরেজি-২য়','ইংরেজি দ্বিতীয় পত্র','English Second Paper','ইংরেজি ২য়','ইংরেজী ২য়']
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
    const buckets = new Map();
                    const allowedExamId = selectedExamId || activeExamId || null;
    const addToBucket = (key, exId, w, mcq, pr, totalExplicit, grade, passed) => {
      if (!key) return;
      let b = buckets.get(key);
      if (!b) {
        b = new Map();
        buckets.set(key, b);
      }
      const prev = b.get(exId) || { w: 0, mcq: 0, pr: 0, totalExplicit: 0, gradeExplicit: '', passExplicit: undefined };
      const wNew = Number.isFinite(w) ? w : 0;
      const mcqNew = Number.isFinite(mcq) ? mcq : 0;
      const prNew = Number.isFinite(pr) ? pr : 0;
      const totNew = Number.isFinite(totalExplicit) ? totalExplicit : 0;
      const gradeNew = String(grade || '');
      const passNew = (passed === true);
      const gradePrev = String(prev.gradeExplicit || '');
      const passPrev = (prev.passExplicit === true);
      const next = {
        w: Math.max(prev.w || 0, wNew),
        mcq: Math.max(prev.mcq || 0, mcqNew),
        pr: Math.max(prev.pr || 0, prNew),
        totalExplicit: Math.max(prev.totalExplicit || 0, totNew),
        gradeExplicit: ( (prev.totalExplicit || 0) >= totNew ) ? gradePrev : gradeNew,
        passExplicit: ( (prev.totalExplicit || 0) >= totNew ) ? passPrev : passNew
      };
      b.set(exId, next);
    };
    for (const r of arr) {
      const exId = typeof r.examination === 'object' ? r.examination?.id : r.examination;
      if (allowedExamId != null && String(exId) !== String(allowedExamId)) continue;
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
      addToBucket(key, exId, w, mcq, pr, total, grade, r.is_passed);
      const rawKey = normalizeName(nm);
      if (rawKey && rawKey !== key) addToBucket(rawKey, exId, w, mcq, pr, total, grade, r.is_passed);
      // Also key by subject id if available
      const subjId2 = typeof r.subject === 'object' ? r.subject?.id : r.subject;
      if (subjId2) addToBucket(`id:${String(subjId2)}`, exId, w, mcq, pr, total, grade, r.is_passed);
    }
    for (const [key, byExam] of buckets.entries()) {
      let bestPass = { total: -1, grade: 'D', is_passed: true };
      let bestFail = { total: -1, grade: 'F', is_passed: false };
      for (const [, obj] of byExam.entries()) {
        const compSum = (parseFloat(obj?.w) || 0) + (parseFloat(obj?.mcq) || 0) + (parseFloat(obj?.pr) || 0);
        const ct = Math.max(parseFloat(obj?.totalExplicit) || 0, compSum);
        const cg = String(obj?.gradeExplicit || '').toUpperCase();
        const cp = (obj?.passExplicit === true) || (cg !== 'F');
        if (cp) {
          if (ct > (parseFloat(bestPass.total) || 0)) {
            bestPass = { total: ct, grade: (cg && cg !== 'F') ? cg : 'D', is_passed: true };
          }
        } else {
          if (ct > (parseFloat(bestFail.total) || 0)) {
            bestFail = { total: ct, grade: 'F', is_passed: false };
          }
        }
      }
      const pick = (bestPass.total > -1) ? bestPass : bestFail;
      m.set(key, { total: pick.total, grade: pick.grade, is_passed: pick.is_passed });
    }
    return m;
  };

  const totalsMap = useMemo(() => {
    const m = new Map();
    for (const s of displayStudentsList || []) {
      const map = getStudentResultsMap(s.id);
      let sum = 0;
      for (const item of displaySubjects) {
        const r = resolveResult(s.id, item, map);
        if (r) sum += resultTotal(r);
      }
      if (!sum || sum === 0) {
        const ov = overallTotals.get(String(s.id));
        if (ov != null) sum = ov;
      }
      m.set(String(s.id), sum);
    }
    return m;
  }, [displayStudentsList, resultsByStudent, displaySubjects, activeExamId, selectedExamId]);

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
    const hasAnyResult = (s) => {
      const arr = resultsByStudent.get(String(s.id)) || [];
      return Array.isArray(arr) && arr.length > 0;
    };
    const hasFail = (s) => {
      const map = getStudentResultsMap(s.id);
      for (const item of displaySubjects) {
        const r = resolveResult(s.id, item, map);
        if (!r) continue;
        const g = String(r?.grade || '').toUpperCase();
        const p = r?.is_passed;
        if (g === 'F' || p === false) return true;
      }
      return false;
    };
    const statusRankOf = (s) => {
      if (!hasAnyResult(s)) return 2;       // no results -> bottom
      if (hasFail(s)) return 1;             // failed -> after passed
      return 0;                              // passed -> top
    };
    const secNum = (() => { const n = parseInt(String(selectedSection), 10); return Number.isFinite(n) ? n : undefined; })();
    if (secNum !== undefined) {
      const list = (displayStudentsList || []).filter(s => String(getSecId(s)) === String(secNum));
      const arr = list.map(s => ({ s, total: totalsMap.get(String(s.id)) || 0, rollNum: rollNumOf(s), rankCode: statusRankOf(s) }));
      arr.sort((a, b) => {
        if (a.rankCode !== b.rankCode) return a.rankCode - b.rankCode;
        if (b.total !== a.total) return b.total - a.total;
        return a.rollNum - b.rollNum;
      });
      let rk = 1;
      for (const it of arr) m.set(String(it.s.id), rk++);
      return m;
    }
    const bySection = new Map();
    for (const s of displayStudentsList || []) {
      const secId = getSecId(s) ?? 'none';
      if (!bySection.has(secId)) bySection.set(secId, []);
      bySection.get(secId).push(s);
    }
    for (const [secId, list] of bySection.entries()) {
      const arr = list.map(s => ({ s, total: totalsMap.get(String(s.id)) || 0, rollNum: rollNumOf(s), rankCode: statusRankOf(s) }));
      arr.sort((a, b) => {
        if (a.rankCode !== b.rankCode) return a.rankCode - b.rankCode;
        if (b.total !== a.total) return b.total - a.total;
        return a.rollNum - b.rollNum;
      });
      let rk = 1;
      for (const it of arr) m.set(String(it.s.id), rk++);
    }
    if (m.size === 0) {
      if (overallRanks && overallRanks.size > 0) {
        for (const s of displayStudentsList || []) {
          const rk = overallRanks.get(String(s.id));
          if (rk != null) m.set(String(s.id), parseInt(rk, 10));
        }
      }
      if (m.size === 0) {
        const arr = (displayStudentsList || []).map(s => ({ s, total: totalsMap.get(String(s.id)) || 0, rollNum: rollNumOf(s), rankCode: statusRankOf(s) }));
        arr.sort((a, b) => {
          if (a.rankCode !== b.rankCode) return a.rankCode - b.rankCode;
          if (b.total !== a.total) return b.total - a.total;
          return a.rollNum - b.rollNum;
        });
        let rk = 1;
        for (const it of arr) m.set(String(it.s.id), rk++);
      }
    }
    return m;
  }, [displayStudentsList, totalsMap, selectedSection, displaySubjects, passMarks, resultsByStudent, overallRanks, activeExamId, selectedExamId]);

  const finalRankMap = useMemo(() => {
    const out = new Map(newRollMap);
    const needFill = (displayStudentsList || []).filter(s => !out.has(String(s.id)));
    if (needFill.length > 0) {
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
      const hasAnyResult = (s) => {
        const arr = resultsByStudent.get(String(s.id)) || [];
        return Array.isArray(arr) && arr.length > 0;
      };
    const hasFail = (s) => {
      const map = getStudentResultsMap(s.id);
      for (const item of displaySubjects) {
        const r = resolveResult(s.id, item, map);
        if (!r) continue;
        const g = String(r?.grade || '').toUpperCase();
        const p = r?.is_passed;
        if (g === 'F' || p === false) return true;
      }
      return false;
    };
      const statusRankOf = (s) => {
        if (!hasAnyResult(s)) return 2;
        if (hasFail(s)) return 1;
        return 0;
      };
      const secNum = (() => { const n = parseInt(String(selectedSection), 10); return Number.isFinite(n) ? n : undefined; })();
      let pool = secNum !== undefined
        ? (displayStudentsList || []).filter(s => String(getSecId(s)) === String(secNum))
        : (displayStudentsList || []);
      if (!pool || pool.length === 0) {
        pool = (displayStudentsList || []);
      }
      const arr = pool.map(s => ({ s, total: totalsMap.get(String(s.id)) || 0, rollNum: rollNumOf(s), rankCode: statusRankOf(s) }));
      arr.sort((a, b) => {
        if (a.rankCode !== b.rankCode) return a.rankCode - b.rankCode;
        if (b.total !== a.total) return b.total - a.total;
        return a.rollNum - b.rollNum;
      });
      let rk = 1;
      for (const it of arr) {
        const sidStr = String(it.s.id);
        if (!out.has(sidStr)) out.set(sidStr, rk);
        rk++;
      }
    }
    return out;
  }, [newRollMap, displayStudentsList, totalsMap, selectedSection, displaySubjects, passMarks, resultsByStudent, activeExamId, selectedExamId]);

  const sortedStudents = useMemo(() => {
    let list = Array.isArray(displayStudentsList) ? [...displayStudentsList] : [];
    const getSecIdLocal = (s) => {
      const sec = s?.section;
      if (typeof sec === 'object') return sec?.id ?? sec?.section_id ?? null;
      return s?.section_id ?? null;
    };
    const secNum = (() => { const n = parseInt(String(selectedSection), 10); return Number.isFinite(n) ? n : undefined; })();
    if (secNum !== undefined) {
      list = list.filter(s => String(getSecIdLocal(s)) === String(secNum));
    }
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
    list.sort((a, b) => {
      const ra = finalRankMap.get(String(a.id)) ?? 999999;
      const rb = finalRankMap.get(String(b.id)) ?? 999999;
      if (ra !== rb) return ra - rb;
      const ta = totalsMap.get(String(a.id)) || 0;
      const tb = totalsMap.get(String(b.id)) || 0;
      if (tb !== ta) return tb - ta;
      return rollNumOf(a) - rollNumOf(b);
    });
    return list;
  }, [displayStudentsList, finalRankMap, totalsMap, selectedSection]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    try {
      const headers = ['Roll', 'Student', 'প্রাপ্ত মোট', 'নতুন রোল', ...displaySubjects.map(s => s.label)];
      const rows = [];
      for (const stu of (sortedStudents || [])) {
        const map = getStudentResultsMap(stu.id);
        const row = [];
        row.push(String(stu.roll_number || ''));
        row.push(String(`${stu.user?.first_name || ''} ${stu.user?.last_name || ''}`.trim() || stu.user?.username || ''));
        row.push(String(totalsMap.get(String(stu.id)) || 0));
        row.push(String(finalRankMap.get(String(stu.id)) || ''));
        for (const item of displaySubjects) {
          const r = resolveResult(stu.id, item, map);
          row.push(r ? String(resultTotal(r)) : '');
        }
        rows.push(row);
      }
      const esc = (v) => {
        const s = String(v ?? '');
        if (/[",\n]/.test(s)) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n');
      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().slice(0,10);
      a.href = url;
      a.download = `class_results_${selectedClass || 'all'}_${selectedSection || 'all'}_${selectedExamType || 'all'}_${selectedYear || ''}_${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (_) {}
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
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownload}>ডাউনলোড</Button>
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
            select
            label="পরীক্ষা নির্বাচন করুন"
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            sx={{ minWidth: 260 }}
            disabled={!selectedClass}
          >
            <MenuItem value="">সব পরীক্ষা (টাইপ অনুযায়ী)</MenuItem>
            {examinations.map(ex => (
              <MenuItem key={ex.id} value={ex.id}>
                {ex.name} {ex.exam_date ? `(${new Date(ex.exam_date).toLocaleDateString()})` : ''}
              </MenuItem>
            ))}
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
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          শিক্ষার্থী: {(displayStudentsList || []).length} | রেজাল্ট পাওয়া গেছে: {
            Array.from(resultsByStudent.keys()).length
          }
        </Typography>
      </Paper>

      {(Array.isArray(sortedStudents) && sortedStudents.length > 0) ? (
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
            {(sortedStudents || []).map(stu => {
              const map = getStudentResultsMap(stu.id);
              return (
                <TableRow key={stu.id}>
                  <TableCell>{stu.roll_number || 'N/A'}</TableCell>
                  <TableCell>{`${stu.user?.first_name || ''} ${stu.user?.last_name || ''}`.trim() || stu.user?.username || 'N/A'}</TableCell>
                  <TableCell align="center">{totalsMap.get(String(stu.id)) || 0}</TableCell>
                  <TableCell align="center">{finalRankMap.get(String(stu.id)) || ''}</TableCell>
                  {displaySubjects.map(item => {
                    const r = resolveResult(stu.id, item, map);
                    const valNum = r ? resultTotal(r) : null;
                    const allowedExamId = selectedExamId || activeExamId || null;
                    const raw = getStudentRawResults(stu.id).filter(x => {
                      const exId = typeof x.examination === 'object' ? x.examination?.id : x.examination;
                      if (allowedExamId != null && String(exId) !== String(allowedExamId)) return false;
                      const nm = normalizeName(x.subject?.name || x.subject_name || '');
                      const can = canonicalSubjectName(nm);
                      const subjId = typeof x.subject === 'object' ? x.subject?.id : x.subject;
                      if (item?.canonical && can && can === item.canonical) return true;
                      if (item?.id && subjId && String(subjId) === String(item.id)) return true;
                      const syns = synonymsForCanonical(item?.canonical || '');
                      const kk = normalizeName(item?.label || '');
                      return syns.includes(nm) || nm === kk;
                    });
                    const g = String(r?.grade || '').toUpperCase();
                    const p = r?.is_passed;
                    const fail = r ? ((g === 'F') || (p === false)) : false;
                    const txt = (valNum != null) ? `${valNum}` : '—';
                    return <TableCell key={item.canonical || item.label} align="center" sx={{ color: fail ? '#d32f2f' : 'inherit', fontWeight: fail ? 700 : 400 }}>{txt}</TableCell>;
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      ) : (
        <Paper sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {noYearMessage || 'এই বছরের জন্য কোনো রেজাল্ট পাওয়া যায়নি'}
          </Typography>
        </Paper>
      )}
      {loading && (
        <Typography variant="body2" sx={{ mt: 2 }}>লোড হচ্ছে...</Typography>
      )}
      {!loading && selectedClass && noYearMessage && (
        <Typography variant="body2" sx={{ mt: 2, color: 'error.main' }}>{noYearMessage}</Typography>
      )}
    </Box>
  );
}
