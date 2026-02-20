import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Stack, Button, Grid, Alert, Chip, Divider, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import api from '../utils/api';
import { getExaminations } from '../utils/schoolApi';

const SoftwareAssistant = () => {
  const { id } = useParams();
  const [q, setQ] = useState('');
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  const toLowerBn = (s) => String(s || '').toLowerCase();
  const todayStr = () => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  };

  const bn2enDigits = (s) => String(s || '').replace(/[০-৯]/g, (d) => '0123456789'['০১২৩৪৫৬৭৮৯'.indexOf(d)]);
  const parseDateMonth = (text) => {
    const t = bn2enDigits(String(text || ''));
    const dateMatch = t.match(/\b(20[0-9]{2})[-/\.](0[1-9]|1[0-2])[-/\.]([0-2][0-9]|3[01])\b/);
    const monthMatch = t.match(/\b(20[0-9]{2})[-/\.](0[1-9]|1[0-2])\b/);
    const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';
    const month = monthMatch ? `${monthMatch[1]}-${monthMatch[2]}` : '';
    return { date, month };
  };
  const parseIntent = (text) => {
    const t = toLowerBn(text);
    const isAttendance = /(attendance|উপস্থিতি|অনুপস্থিতি)/.test(t);
    const isFees = /(fee|fees|ফি|আদায়|collection|বকেয়া)/.test(t);
    const isResults = /(result|results|ফলাফল|পরীক্ষা|exam)/.test(t);
    const isBlood = /(blood|রক্ত|গ্রুপ)/.test(t);
    const asksYears = /(year|বছর|সাল)\b/.test(t);
    let type = null;
    if (isAttendance) type = 'attendance';
    else if (isFees) type = 'fees';
    else if (isResults) type = 'results';
    let bloodGroup = null;
    if (isBlood) {
      const m = String(text || '').toUpperCase().match(/\b(AB|A|B|O)\s*([+-])\b/);
      if (m) bloodGroup = `${m[1]}${m[2]}`;
      if (bloodGroup) type = 'blood';
    }
    const { date, month } = parseDateMonth(text);
    return { type, bloodGroup, date, month, asksYears: isResults && asksYears };
  };
  const parseExamType = (text) => {
    const t = toLowerBn(text);
    if (/(annual|final|বার্ষিক)/.test(t)) return 'annual';
    if (/(half|mid|অর্ধ|অর্ধ-বার্ষিক|অর্ধবার্ষিক)/.test(t)) return 'half_yearly';
    if (/(terminal|term|টার্মিনাল)/.test(t)) return 'terminal';
    if (/(model|মডেল)/.test(t)) return 'model';
    if (/(test|monthly|টেস্ট|বিশেষ)/.test(t)) return 'test';
    return null;
  };
  const normalizeExamType = (type, name = '') => {
    const s = String(type || '').toLowerCase();
    const rn = String(name || '').toLowerCase();
    const hasAny = (str, keys) => keys.some(k => str.includes(k));
    if (s) {
      if (hasAny(s, ['final','annual','yearly','বার্ষিক'])) return 'annual';
      if (hasAny(s, ['half','half_yearly','mid','half-yearly','অর্ধ'])) return 'half_yearly';
      if (hasAny(s, ['terminal','term','টার্মিনাল'])) return 'terminal';
      if (hasAny(s, ['model','model_test','model-test','মডেল'])) return 'model';
      if (hasAny(s, ['test','monthly','টেস্ট','বিশেষ'])) return 'test';
      if (hasAny(s, ['first_term','first','first-term','প্রথম'])) return 'first_term';
      return s;
    }
    if (hasAny(rn, ['final','annual','yearly','বার্ষিক'])) return 'annual';
    if (hasAny(rn, ['half','half_yearly','mid','half-yearly','অর্ধ'])) return 'half_yearly';
    if (hasAny(rn, ['terminal','term','টার্মিনাল'])) return 'terminal';
    if (hasAny(rn, ['model','model_test','model-test','মডেল'])) return 'model';
    if (hasAny(rn, ['test','monthly','টেস্ট','বিশেষ'])) return 'test';
    if (hasAny(rn, ['first_term','first','first-term','প্রথম'])) return 'first_term';
    return 'annual';
  };
  const examTypeLabel = (type, name = '') => {
    const t = normalizeExamType(type, name);
    const map = {
      annual: 'বার্ষিক',
      half_yearly: 'অর্ধ-বার্ষিক',
      terminal: 'টার্মিনাল',
      model: 'মডেল টেস্ট',
      test: 'বিশেষ মূল্যায়ন',
      first_term: 'প্রথম টার্ম'
    };
    return map[t] || (type || 'পরীক্ষা');
  };
  const fetchExamsListFallback = async (text, dateStr, monthStr) => {
    const examType = parseExamType(text);
    const filters = {};
    if (examType) filters.exam_type = examType;
    const res = await getExaminations(id, filters);
    const arr = Array.isArray(res.data) ? res.data : (res.data?.results || []);
    let list = arr.map(e => ({
      id: e.id,
      name: e.name,
      type: e.exam_type || e.type,
      date: e.exam_date,
      class: e.classroom?.name || e.classroom_name || '',
      section: e.section?.name || e.section_name || ''
    }));
    const matchesDate = (d, ymd) => {
      if (!d || !ymd) return true;
      const s = String(d);
      if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return s.startsWith(ymd);
      if (/^\d{4}-\d{2}$/.test(ymd)) return s.startsWith(ymd);
      return true;
    };
    const useDate = dateStr || '';
    const useMonth = monthStr || '';
    if (useDate) list = list.filter(e => matchesDate(e.date, useDate));
    else if (useMonth) list = list.filter(e => matchesDate(e.date, useMonth));
    return {
      text: 'পরীক্ষার তালিকা (লোকাল ফfallback)',
      exams: list
    };
  };

  const fetchAttendanceSummary = async (dt) => {
    const theDate = dt || todayStr();
    const params = new URLSearchParams();
    if (id) params.append('school', id);
    if (theDate) params.append('date', theDate);
    const res = await api.get(`/api/attendance/records/?${params.toString()}`);
    const arr = Array.isArray(res.data) ? res.data : (res.data?.results || []);
    const present = arr.filter(r => r.present === true).length;
    const absent = arr.filter(r => r.present === false).length;
    const total = arr.length;
    const percentage = total ? Math.round((present / total) * 100) : 0;
    return {
      text: 'উপস্থিতির সারাংশ',
      present,
      absent,
      total,
      percentage
    };
  };

  const fetchMonthlyCollection = async (mn) => {
    const res = await api.get(`/api/fees/payments/?school=${id}`);
    const arr = Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.data || []);
    const monthStr = mn || (new Date().toISOString().slice(0, 7));
    const filtered = arr.filter(p => {
      const d = p.payment_date || p.date || p.created_at || '';
      return String(d).startsWith(monthStr);
    });
    const total_collected = filtered.reduce((sum, p) => {
      const amt = parseFloat(p.amount ?? p.paid_amount ?? p.value ?? 0);
      return sum + (Number.isFinite(amt) ? amt : 0);
    }, 0);
    return {
      text: 'ফি আদায়ের সারাংশ',
      month: monthStr,
      total_collected
    };
  };

  const fetchBloodGroupCount = async (group) => {
    const res = await api.get(`/api/academics/students/?school=${id}`);
    const arr = Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.data || []);
    const norm = (x) => String(x || '').replace(/\s+/g, '').toUpperCase();
    const target = norm(group);
    const count = arr.filter(s => {
      const bg = s.blood_group ?? s.user?.blood_group ?? '';
      return norm(bg) === target;
    }).length;
    return {
      text: `${group} রক্তের গ্রুপের শিক্ষার্থী: ${count} জন`,
      students_count: count,
      total_students: arr.length
    };
  };

  const localHandle = async () => {
    const { type, bloodGroup } = parseIntent(q);
    if (!type) return null;
    if (type === 'attendance') {
      return await fetchAttendanceSummary(date);
    }
    if (type === 'fees') {
      return await fetchMonthlyCollection(month);
    }
    if (type === 'blood' && bloodGroup) {
      return await fetchBloodGroupCount(bloodGroup);
    }
    return null;
  };

  const handleAsk = async () => {
    setLoading(true);
    setError('');
    setResponse(null);
    try {
      const parsed = parseIntent(q);
      const params = { q, school: id || undefined };
      const useDate = date || parsed.date;
      const useMonth = month || parsed.month;
      if (useDate) params.date = useDate;
      if (useMonth) params.month = useMonth;
      const res = await api.get('/api/users/assistant/', { params });
      const backend = res.data;
      const intent = parsed;
      const notUnderstood =
        (typeof backend?.text === 'string' && /বুঝতে\s*পারিনি|অনুরোধ/i.test(backend.text)) ||
        (typeof backend?.error === 'string' && /বুঝতে\s*পারিনি|অনুরোধ/i.test(backend.error));
      if (notUnderstood && intent.type === 'blood') {
        const fb = await localHandle();
        setResponse(fb || backend);
      } else {
        setResponse(backend);
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'অনুরোধ ব্যর্থ হয়েছে';
      try {
        const intent = parseIntent(q);
        let fallback = await localHandle();
        if (!fallback && intent.type === 'results') {
          fallback = await fetchExamsListFallback(q, date || intent.date, month || intent.month);
        }
        if (fallback) {
          setResponse(fallback);
          setError('');
        } else {
          setError(msg);
        }
      } catch (_) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderFriendly = (res) => {
    if (!res) return null;
    const items = [];
    if (res.text) {
      items.push(
        <Typography key="text" variant="h6" sx={{ mb: 1 }}>{res.text}</Typography>
      );
    }
    if (res.topper) {
      items.push(
        <Stack key="topper" direction="row" spacing={2} sx={{ mt: 1 }}>
          <Chip label={`নাম: ${res.topper.name || ''}`} color="primary" />
          <Chip label={`GPA: ${res.topper.gpa}`} />
          <Chip label={`শতাংশ: ${res.topper.percentage}%`} />
        </Stack>
      );
    }
    if (typeof res.students_count === 'number' || typeof res.teachers_count === 'number') {
      items.push(
        <Stack key="counts" direction="row" spacing={2} sx={{ mt: 1 }}>
          <Chip label={`শিক্ষার্থী: ${res.students_count ?? '-'}`} color="primary" />
          <Chip label={`শিক্ষক: ${res.teachers_count ?? '-'}`} />
        </Stack>
      );
    }
    if (typeof res.present === 'number' || typeof res.absent === 'number' || typeof res.total === 'number' || typeof res.percentage === 'number') {
      items.push(
        <Stack key="attendance" direction="row" spacing={2} sx={{ mt: 1 }}>
          <Chip label={`উপস্থিত: ${res.present ?? '-'}`} color="success" />
          <Chip label={`অনুপস্থিত: ${res.absent ?? '-'}`} color="error" />
          <Chip label={`মোট: ${res.total ?? res.total_days_marked ?? '-'}`} />
          {typeof res.percentage === 'number' && <Chip label={`শতাংশ: ${res.percentage}%`} />}
        </Stack>
      );
    }
    if (typeof res.total_expected === 'number' || typeof res.total_collected === 'number' || typeof res.total_pending === 'number') {
      items.push(
        <Stack key="fees_collection" direction="row" spacing={2} sx={{ mt: 1 }}>
          <Chip label={`মোট দাবী: ${res.total_expected ?? '-'}`} />
          <Chip label={`আদায়: ${res.total_collected ?? '-'}`} color="primary" />
          <Chip label={`বাকি: ${res.total_pending ?? '-'}`} color="warning" />
          {typeof res.collection_percentage === 'number' && <Chip label={`শতাংশ: ${res.collection_percentage}%`} />}
        </Stack>
      );
    }
    if (typeof res.total_due === 'number') {
      items.push(
        <Stack key="fees_due" direction="row" spacing={2} sx={{ mt: 1 }}>
          <Chip label={`মাস: ${res.month ?? '-'}`} />
          <Chip label={`মোট বকেয়া: ${res.total_due}`} color="warning" />
        </Stack>
      );
    }
    if (typeof res.total_students === 'number') {
      items.push(
        <Stack key="students_total" direction="row" spacing={2} sx={{ mt: 1 }}>
          <Chip label={`মোট শিক্ষার্থী: ${res.total_students}`} color="primary" />
        </Stack>
      );
    }
    if (typeof res.students_with_results === 'number') {
      items.push(
        <Stack key="students_with_results" direction="row" spacing={2} sx={{ mt: 1 }}>
          <Chip label={`রেজাল্ট ইনপুট: ${res.students_with_results}`} color="primary" />
        </Stack>
      );
    }
    if (Array.isArray(res.years) && res.years.length > 0) {
      items.push(
        <Stack key="years" direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap' }}>
          <Chip label="বছরগুলো:" />
          {res.years.map((y, idx) => <Chip key={idx} label={String(y)} />)}
        </Stack>
      );
    }
    if (Array.isArray(res.subjects) && res.subjects.length > 0) {
      items.push(
        <Box key="subject_table" sx={{ mt: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>বিষয়ভিত্তিক ফলাফল</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>বিষয়</TableCell>
                <TableCell align="right">অর্জিত নম্বর</TableCell>
                <TableCell align="right">গ্রেড</TableCell>
                <TableCell align="right">GPA</TableCell>
                <TableCell align="right">স্ট্যাটাস</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {res.subjects.map((s, idx) => (
                <TableRow key={idx}>
                  <TableCell>{s.subject}</TableCell>
                  <TableCell align="right">{s.obtained}</TableCell>
                  <TableCell align="right">{s.grade}</TableCell>
                  <TableCell align="right">{s.gpa}</TableCell>
                  <TableCell align="right">{s.passed ? 'পাস' : 'ফেল'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      );
    }
    if (Array.isArray(res.exams) && res.exams.length > 0) {
      items.push(
        <Box key="exams_list" sx={{ mt: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>পরীক্ষার তালিকা</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>পরীক্ষা</TableCell>
                <TableCell>টাইপ</TableCell>
                <TableCell>ক্লাস</TableCell>
                <TableCell>সেকশন</TableCell>
                <TableCell>তারিখ</TableCell>
                <TableCell align="right">ফলাফল সংখ্যা</TableCell>
                <TableCell align="right">শিক্ষার্থী সংখ্যা</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {res.exams.map((e, idx) => (
                <TableRow key={idx}>
                  <TableCell>{e.name}</TableCell>
                  <TableCell>{examTypeLabel(e.type, e.name)}</TableCell>
                  <TableCell>{e.class}</TableCell>
                  <TableCell>{e.section || '-'}</TableCell>
                  <TableCell>{e.date || '-'}</TableCell>
                  <TableCell align="right">{typeof e.results_count === 'number' ? e.results_count : '-'}</TableCell>
                  <TableCell align="right">{typeof e.students_count === 'number' ? e.students_count : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      );
    }
    if (Array.isArray(res.users_list) && res.users_list.length > 0) {
      items.push(
        <Box key="users_list_table" sx={{ mt: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>ব্যবহারকারীদের তালিকা</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>নাম</TableCell>
                <TableCell>পদবী</TableCell>
                <TableCell align="right">মোবাইল</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {res.users_list.map((u, idx) => (
                <TableRow key={idx}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.role}</TableCell>
                  <TableCell align="right">{u.phone || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      );
    }
    if (res.student && (res.student.name || res.student.roll || res.student.class || res.student.section)) {
      items.unshift(
        <Stack key="student_info" direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap' }}>
          {res.student.name && <Chip label={`নাম: ${res.student.name}`} color="primary" />}
          {typeof res.student.roll !== 'undefined' && res.student.roll !== null && <Chip label={`রোল: ${res.student.roll}`} />}
          {res.student.class && <Chip label={`ক্লাস: ${res.student.class}`} />}
          {res.student.section && <Chip label={`সেকশন: ${res.student.section}`} />}
        </Stack>
      );
    }
    if (items.length === 0) {
      items.push(
        <Typography key="fallback" sx={{ mt: 1 }}>তথ্য পাওয়া যায়নি বা প্রদর্শনের জন্য উপযুক্ত ফরম্যাট নেই।</Typography>
      );
    }
    return <>{items}</>;
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>সফটওয়ার এ্যাসিসটেন্ট</Typography>
      <Paper sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="আপনার কমান্ড লিখুন"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="উদাহরণ: ক্লাস ৭ annual exam, আজকের উপস্থিতি, ফি 2026-01, AB+ গ্রুপ"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="তারিখ (ঐচ্ছিক, YYYY-MM-DD)"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="2026-01-12"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="মাস (ঐচ্ছিক, YYYY-MM)"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              placeholder="2026-01"
            />
          </Grid>
          <Grid item xs={12}>
            <Stack direction="row" spacing={2}>
              <Button variant="contained" onClick={handleAsk} disabled={loading || !q}>
                {loading ? 'লোড হচ্ছে...' : 'জিজ্ঞেস কর'}
              </Button>
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </Grid>
        </Grid>
      </Paper>
      {response && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>উত্তর</Typography>
          {renderFriendly(response)}
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={() => setShowRaw(s => !s)}>
              {showRaw ? 'র অ JSON লুকান' : 'র অ JSON দেখান'}
            </Button>
          </Stack>
          {showRaw && (
            <Box sx={{ mt: 2 }}>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                {JSON.stringify(response, null, 2)}
              </pre>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default SoftwareAssistant;
