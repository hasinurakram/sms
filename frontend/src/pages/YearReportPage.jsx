import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, Grid, FormControl, InputLabel, Select, MenuItem, TextField, Chip, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Stack, CircularProgress, Alert, Button } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAcademics } from '../context/AcademicsContext';
import { scopedGet } from '../utils/schoolApi';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';

export default function YearReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { classrooms: contextClassrooms, sections: contextSections, refreshAll } = useAcademics();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendData, setTrendData] = useState([]);

  useEffect(() => {
    refreshAll(id);
  }, [id]);

  const sectionsForClass = useMemo(() => {
    if (!selectedClass) return [];
    const cid = parseInt(String(selectedClass), 10);
    return (contextSections || []).filter(sec => parseInt(String(sec.classroom?.id ?? sec.classroom), 10) === cid);
  }, [selectedClass, contextSections]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = { school: id, year: String(selectedYear) };
      if (selectedClass) params.classroom = parseInt(String(selectedClass), 10);
      if (selectedSection) params.section = parseInt(String(selectedSection), 10);
      const res = await api.get('/api/academics/students/year_report/', { params });
      const data = res.data || {};
      setSummary(data.summary || null);
      setRecords(Array.isArray(data.records) ? data.records : []);
      if (!Array.isArray(data.records) || data.records.length === 0) {
        toast.info(`দুঃখিত ${selectedYear} সালের রিপোর্টে কোনো তথ্য পাওয়া যায়নি`);
      }
    } catch (e) {
      toast.error('রিপোর্ট লোড ব্যর্থ হয়েছে');
      setSummary(null);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post('/api/academics/students/sync_year_records/', {
        school: id,
        year: String(selectedYear)
      });
      toast.success('ডাটা সিঙ্ক সম্পন্ন হয়েছে');
      loadReport();
    } catch (e) {
      toast.error('সিঙ্ক ব্যর্থ হয়েছে');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedClass, selectedSection, selectedYear]);

  const computePercentageBuckets = () => {
    const buckets = [
      { label: '0-40', min: 0, max: 40 },
      { label: '40-50', min: 40, max: 50 },
      { label: '50-60', min: 50, max: 60 },
      { label: '60-70', min: 60, max: 70 },
      { label: '70-80', min: 70, max: 80 },
      { label: '80-90', min: 80, max: 90 },
      { label: '90-100', min: 90, max: 100.0001 }
    ];
    const arr = buckets.map(b => ({ label: b.label, count: 0 }));
    for (const r of records) {
      const p = typeof r.percentage === 'number' ? r.percentage : (r.percentage != null ? parseFloat(r.percentage) : null);
      if (p == null || Number.isNaN(p)) continue;
      for (let i = 0; i < buckets.length; i++) {
        const b = buckets[i];
        if (p >= b.min && p < b.max) { arr[i].count += 1; break; }
      }
    }
    return arr;
  };

  const computeClasswiseStatus = () => {
    const map = new Map();
    for (const r of records) {
      const cls = r.classroom || 'Unknown';
      if (!map.has(cls)) map.set(cls, { className: cls, promoted: 0, retained: 0, not_passed: 0 });
      const obj = map.get(cls);
      if (r.status === 'promoted') obj.promoted += 1;
      else if (r.status === 'retained') obj.retained += 1;
      else if (r.status === 'not_passed') obj.not_passed += 1;
    }
    return Array.from(map.values()).sort((a, b) => String(a.className).localeCompare(String(b.className)));
  };

  const loadTrend = async () => {
    setTrendLoading(true);
    try {
      const span = 5;
      const base = parseInt(String(selectedYear), 10) || new Date().getFullYear();
      const years = Array.from({ length: span }, (_, i) => base - (span - 1 - i));
      const data = [];
      for (const y of years) {
        const params = { school: id, year: String(y) };
        if (selectedClass) params.classroom = parseInt(String(selectedClass), 10);
        if (selectedSection) params.section = parseInt(String(selectedSection), 10);
        try {
          const res = await api.get('/api/academics/students/year_report/', { params });
          const s = res.data?.summary || {};
          data.push({
            year: String(y),
            avg_cgpa: s.avg_cgpa ?? null,
            promoted_rate: s.total ? Math.round(((s.promoted || 0) / s.total) * 100) : 0
          });
        } catch (_) {
          data.push({ year: String(y), avg_cgpa: null, promoted_rate: 0 });
        }
      }
      setTrendData(data);
    } finally {
      setTrendLoading(false);
    }
  };

  useEffect(() => {
    loadTrend();
  }, [selectedClass, selectedSection, selectedYear]);

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssessmentIcon /> বছরভিত্তিক রিপোর্ট
        </Typography>
        <Button 
          variant="contained" 
          color="secondary" 
          startIcon={syncing ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
          onClick={handleSync}
          disabled={syncing || loading}
        >
          {syncing ? 'সিঙ্ক হচ্ছে...' : 'ডাটা আপডেট/সিঙ্ক করুন'}
        </Button>
      </Stack>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel id="yrp-class-label">শ্রেণি</InputLabel>
              <Select
                labelId="yrp-class-label"
                value={String(selectedClass)}
                label="শ্রেণি"
                onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection(''); }}
              >
                <MenuItem value=""><em>সব শ্রেণি</em></MenuItem>
                {(contextClassrooms || []).map(cls => (
                  <MenuItem key={cls.id} value={String(cls.id)}>
                    {cls.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth disabled={!selectedClass}>
              <InputLabel id="yrp-section-label">সেকশন</InputLabel>
              <Select
                labelId="yrp-section-label"
                value={String(selectedSection)}
                label="সেকশন"
                onChange={(e) => setSelectedSection(e.target.value)}
              >
                <MenuItem value=""><em>সব সেকশন</em></MenuItem>
                {sectionsForClass.map(sec => (
                  <MenuItem key={sec.id} value={String(sec.id)}>{sec.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              type="number"
              label="সাল"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value || String(new Date().getFullYear()), 10) || new Date().getFullYear())}
              fullWidth
              inputProps={{ min: 2000, max: 2100 }}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        {loading && <CircularProgress />}
        {!loading && summary && (
          <>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
              <Chip label={`মোট: ${summary.total}`} color="primary" />
              <Chip label={`প্রমোটেড: ${summary.promoted}`} color="success" />
              <Chip label={`রিটেইনড: ${summary.retained}`} color="warning" />
              <Chip label={`নাপাস: ${summary.not_passed}`} color="error" />
              <Chip label={`গড় CGPA: ${summary.avg_cgpa ?? '-'}`} />
              <Chip label={`গড় শতাংশ: ${summary.avg_percentage ?? '-'}`} />
            </Stack>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>স্ট্যাটাস ডিস্ট্রিবিউশন</Typography>
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'প্রমোটেড', value: summary.promoted },
                          { name: 'রিটেইনড', value: summary.retained },
                          { name: 'নাপাস', value: summary.not_passed }
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        <Cell fill="#4caf50" />
                        <Cell fill="#ff9800" />
                        <Cell fill="#f44336" />
                      </Pie>
                      <RTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>CGPA বালতি ডিস্ট্রিবিউশন</Typography>
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={(summary.cgpa_buckets || []).map(x => ({ label: x.label, count: x.count }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <RTooltip />
                      <Legend />
                      <Bar dataKey="count" name="সংখ্যা" fill="#3f51b5" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>শতাংশ বালতি ডিস্ট্রিবিউশন</Typography>
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={computePercentageBuckets()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <RTooltip />
                      <Legend />
                      <Bar dataKey="count" name="সংখ্যা" fill="#009688" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>ক্লাসভিত্তিক তুলনা (স্ট্যাকড)</Typography>
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={computeClasswiseStatus()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="className" />
                      <YAxis allowDecimals={false} />
                      <RTooltip />
                      <Legend />
                      <Bar dataKey="promoted" stackId="a" name="প্রমোটেড" fill="#4caf50" />
                      <Bar dataKey="retained" stackId="a" name="রিটেইনড" fill="#ff9800" />
                      <Bar dataKey="not_passed" stackId="a" name="নাপাস" fill="#f44336" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>ট্রেন্ড লাইন (গত ৫ বছর)</Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <RTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="avg_cgpa" name="গড় CGPA" stroke="#3f51b5" />
                      <Line type="monotone" dataKey="promoted_rate" name="প্রমোশন হার (%)" stroke="#4caf50" />
                    </LineChart>
                  </ResponsiveContainer>
                  {trendLoading && <CircularProgress size={24} sx={{ position: 'absolute', mt: -4, ml: 2 }} />}
                </Box>
              </Grid>
            </Grid>
          </>
        )}
        {!loading && (!summary || summary.total === 0) && (
          <Alert severity="info" sx={{ mt: 1 }}>
            কোনো তথ্য পাওয়া যায়নি
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>নাম</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>শ্রেণি</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>সেকশন</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>রোল</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>স্ট্যাটাস</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>CGPA</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>গ্রেড</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>শতাংশ</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>র‌্যাংক</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>প্রমোশন ক্লাস</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.student_name}</TableCell>
                  <TableCell>{r.classroom || '-'}</TableCell>
                  <TableCell>{r.section || '-'}</TableCell>
                  <TableCell>{r.roll_number || '-'}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{r.result_cgpa ?? '-'}</TableCell>
                  <TableCell>{r.result_grade ?? '-'}</TableCell>
                  <TableCell>{r.percentage ?? '-'}</TableCell>
                  <TableCell>{r.rank ?? '-'}</TableCell>
                  <TableCell>{r.promoted_to_classroom || '-'}</TableCell>
                </TableRow>
              ))}
              {records.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={10} align="center">তালিকা খালি</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
