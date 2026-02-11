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
  const [students, setStudents] = useState([]);
  const [examinations, setExaminations] = useState([]);
  const [resultsByStudent, setResultsByStudent] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [fallbackSubjects, setFallbackSubjects] = useState([]);

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
    if (!selectedClass || !selectedExamType) {
      setExaminations([]);
      setResultsByStudent(new Map());
      return;
    }
    setLoading(true);
    scopedGet('/api/results/examinations/', id, { classroom: selectedClass, page_size: 2000 }, { timeout: 30000 })
      .then(async res => {
        const all = Array.isArray(res.data) ? res.data : (res.data?.results || []);
    const exams = selectedExamType === 'all'
      ? all
      : all.filter(e => normalizeExamType(e.exam_type, e.name) === normalizeExamType(selectedExamType));
        setExaminations(exams);
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
              const params = { student: stuId, page, page_size: pageSize };
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
      })
      .catch(() => {
        setExaminations([]);
        setResultsByStudent(new Map());
      })
      .finally(() => setLoading(false));
  }, [id, selectedClass, selectedExamType, selectedSection]);

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
  const normalizeName = (s) => String(s || '').replace(/\s*\(.*?\)\s*/g, '').trim();
  const canonicalSubjectName = (s) => {
    const n = String(s || '').toLowerCase();
    if (!n) return '';
    if ((/বাংলা|bangla|bengali/.test(n)) && (/প্রথম|1st|first/.test(n))) return 'bangla_1st';
    if ((/বাংলা|bangla|bengali/.test(n)) && (/দ্বিতীয়|দ্বিতীয়|2nd|second/.test(n))) return 'bangla_2nd';
    if ((/ইংরেজি|ইংরেজী|english/.test(n)) && (/প্রথম|1st|first/.test(n))) return 'english_1st';
    if ((/ইংরেজি|ইংরেজী|english/.test(n)) && (/দ্বিতীয়|দ্বিতীয়|2nd|second/.test(n))) return 'english_2nd';
    if (/গণিত|mathematics|math|general math/.test(n)) return 'math';
    if (/বিজ্ঞান|science/.test(n)) return 'science';
    if (/বাংলাদেশ.*বিশ্বপরিচয়|bangladesh.*global studies|bgs/.test(n)) return 'bgs';
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
      english_1st: 'ইংরেজী-১ম',
      english_2nd: 'ইংরেজি-২য়',
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

  const displaySubjects = useMemo(() => {
    const orderKeys = [
      'bangla_1st','bangla_2nd','english_1st','english_2nd',
      'math','science','bgs','ict','religion','agriculture',
      'physics','chemistry','biology','higher_math','history',
      'geography','civics','economics','business_entrepreneurship',
      'business_studies','accounting','finance'
    ];
    const sortScore = (label) => {
      const key = canonicalSubjectName(label);
      const idx = orderKeys.indexOf(key);
      return idx === -1 ? 9999 : idx;
    };
    const merged = new Map();
    for (const s of (subjects || [])) {
      const can = canonicalSubjectName(s);
      if (can && !merged.has(can)) merged.set(can, labelForCanonical(can));
    }
    for (const item of (fallbackSubjects || [])) {
      const can = item.canonical;
      const label = item.label;
      if (can && !merged.has(can)) merged.set(can, label);
    }
    if (!merged.size) {
      for (const s of defaultSubjects) {
        const can = canonicalSubjectName(s);
        if (can && !merged.has(can)) merged.set(can, s);
      }
    }
    const arr = Array.from(merged.values());
    return arr.sort((a, b) => sortScore(a) - sortScore(b));
  }, [subjects, fallbackSubjects]);

  const getStudentResultsMap = (sid) => {
    const sidStr = String(sid);
    const arr = resultsByStudent.get(sidStr) || [];
    const m = new Map();
    for (const r of arr) {
      let nm = normalizeName(r.subject?.name || r.subject_name || '');
      let key = canonicalSubjectName(nm) || nm;
      if (!nm || !key) {
        const subjId = typeof r.subject === 'object' ? r.subject?.id : r.subject;
        if (subjId) {
          const match = (fallbackSubjects || []).find(it => String(it.id) === String(subjId));
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
      m.set(key, { total, grade });
    }
    return m;
  };

  const totalsMap = useMemo(() => {
    const m = new Map();
    for (const s of students || []) {
      const map = getStudentResultsMap(s.id);
      let sum = 0;
      for (const sub of displaySubjects) {
        const r = map.get(canonicalSubjectName(sub)) || map.get(normalizeName(sub));
        if (r && typeof r.total === 'number') sum += r.total;
      }
      m.set(String(s.id), sum);
    }
    return m;
  }, [students, resultsByStudent, displaySubjects]);

  const newRollMap = useMemo(() => {
    const arr = (students || []).map(s => {
      const total = totalsMap.get(String(s.id)) || 0;
      const rollStr = String(s.roll_number || '');
      const rollNum = parseInt(rollStr.replace(/\D/g, ''), 10);
      return { id: s.id, total, rollNum: Number.isNaN(rollNum) ? 999999 : rollNum };
    });
    arr.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.rollNum - b.rollNum;
    });
    const m = new Map();
    let rank = 1;
    for (const item of arr) {
      m.set(String(item.id), rank++);
    }
    return m;
  }, [students, totalsMap]);


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
                  {displaySubjects.map(sub => <TableCell key={sub} align="center">{sub}</TableCell>)}
              <TableCell align="center">প্রাপ্ত মোট নাম্বার</TableCell>
              <TableCell align="center">নতুন রোল</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(students || []).map(stu => {
              const map = getStudentResultsMap(stu.id);
              return (
                <TableRow key={stu.id}>
                  <TableCell>{stu.roll_number || 'N/A'}</TableCell>
                  <TableCell>{`${stu.user?.first_name || ''} ${stu.user?.last_name || ''}`.trim() || stu.user?.username || 'N/A'}</TableCell>
                  {displaySubjects.map(sub => {
                    const r = map.get(canonicalSubjectName(sub)) || map.get(normalizeName(sub));
                    const txt = r ? `${r.total}` : '—';
                    return <TableCell key={sub} align="center">{txt}</TableCell>;
                  })}
                  <TableCell align="center">{totalsMap.get(String(stu.id)) || 0}</TableCell>
                  <TableCell align="center">{newRollMap.get(String(stu.id)) || ''}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {loading && (
        <Typography variant="body2" sx={{ mt: 2 }}>লোড হচ্ছে...</Typography>
      )}
      {!loading && selectedClass && subjects.length === 0 && (
        <Typography variant="body2" sx={{ mt: 2 }}>এই ক্লাসের জন্য কোনো বিষয়ভিত্তিক রেজাল্ট পাওয়া যায়নি।</Typography>
      )}
    </Box>
  );
}
