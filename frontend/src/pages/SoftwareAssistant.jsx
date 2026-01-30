import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Stack, Button, Grid, Alert, Chip, Divider, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import api from '../utils/api';

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

  const parseIntent = (text) => {
    const t = toLowerBn(text);
    const isAttendance = /(attendance|উপস্থিতি|অনুপস্থিতি)/.test(t);
    const isFees = /(fee|fees|ফি|আদায়|collection|বকেয়া)/.test(t);
    const isResults = /(result|results|ফলাফল)/.test(t);
    const isBlood = /(blood|রক্ত|গ্রুপ)/.test(t);
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
    return { type, bloodGroup };
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
      const params = { q, school: id || undefined };
      if (date) params.date = date;
      if (month) params.month = month;
      const res = await api.get('/api/users/assistant/', { params });
      const backend = res.data;
      const intent = parseIntent(q);
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
        const fallback = await localHandle();
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
              placeholder="উদাহরণ: Class 7 annual exam, attendance 2026-01-12, fee collection 2026-01"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="তারিখ (YYYY-MM-DD)"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="2026-01-12"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="মাস (YYYY-MM)"
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
