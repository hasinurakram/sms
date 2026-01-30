import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Paper,
  Grid,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Card,
  CardContent,
  Stack,
  Divider,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
  IconButton,
  Collapse,
  Box as MuiBox,
  TableSortLabel
} from '@mui/material';
import {
  Download as DownloadIcon,
  Print as PrintIcon,
  Visibility as VisibilityIcon,
  CalendarMonth as CalendarIcon,
  School as SchoolIcon,
  Class as ClassIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as PresentIcon,
  Cancel as AbsentIcon,
  Help as UnknownIcon
} from '@mui/icons-material';
import api from '../utils/api';
import { scopedGet } from '../utils/schoolApi';
import { useToast } from '../components/Toast';
import dayjs from 'dayjs';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import ImageWithFallback from '../components/ImageWithFallback';

export default function AttendanceReportCard() {
  const { id } = useParams(); // School ID
  const toast = useToast();
  const reportRef = useRef();

  // State
  const [schoolInfo, setSchoolInfo] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [photoMap, setPhotoMap] = useState({}); // student_id -> resolved photo URL
  const [students, setStudents] = useState([]);
  const [guardianMap, setGuardianMap] = useState({}); // student_id -> guardian name
  const [selectedStudent, setSelectedStudent] = useState(''); // optional
  const [expandedRows, setExpandedRows] = useState({});

  useEffect(() => {
    loadSchoolInfo();
    loadClassrooms();

    // Hydrate saved filters (class/section/month/student) so the UI remains consistent after navigation
    try {
      const key = `attendanceReportFilters_${id}`;
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved) {
        if (saved.classroom) setSelectedClassroom(String(saved.classroom));
        if (saved.section !== undefined) setSelectedSection(String(saved.section || ''));
        if (saved.month) setSelectedMonth(String(saved.month));
        if (saved.student !== undefined) setSelectedStudent(String(saved.student || ''));
      }
    } catch (_) {}
  }, [id]);

  useEffect(() => {
    if (selectedClassroom) {
      loadSections(selectedClassroom);
      loadStudents(selectedClassroom, selectedSection);
    } else {
      setSections([]);
      setStudents([]);
      setSelectedStudent('');
    }
  }, [selectedClassroom]);

  // Reload students when section changes
  useEffect(() => {
    if (selectedClassroom) {
      loadStudents(selectedClassroom, selectedSection);
    }
  }, [selectedSection]);

  // Persist filters on change so navigating away/back restores them
  useEffect(() => {
    try {
      const key = `attendanceReportFilters_${id}`;
      localStorage.setItem(key, JSON.stringify({
        classroom: selectedClassroom ? parseInt(selectedClassroom) : '',
        section: selectedSection ? parseInt(selectedSection) : '',
        month: selectedMonth,
        student: selectedStudent ? parseInt(selectedStudent) : ''
      }));
    } catch (_) {}
  }, [id, selectedClassroom, selectedSection, selectedMonth, selectedStudent]);

  const loadSchoolInfo = async () => {
    try {
      const res = await api.get(`/api/schools/${id}/`);
      setSchoolInfo(res.data);
    } catch (error) {
      console.error('Failed to load school info:', error);
    }
  };

  // Resolve photo URL similar to StudentCard logic
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

  const loadClassrooms = async () => {
    try {
      const res = await scopedGet('/api/academics/classrooms/', id, {}, { timeout: 15000 });
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || res.data || []);
      setClassrooms(data);
    } catch (error) {
      console.error('Failed to load classrooms:', error);
      toast.error('Failed to load classrooms');
    }
  };

  const loadSections = async (classroomId) => {
    try {
      const res = await scopedGet('/api/academics/sections/', id, { classroom: classroomId }, { timeout: 15000 });
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || res.data || []);
      setSections(data);
    } catch (error) {
      console.error('Failed to load sections:', error);
      setSections([]);
    }
  };

  // Load students for classroom/section (used for student filter and photos)
  const loadStudents = async (classroomId, sectionId) => {
    if (!classroomId) { setStudents([]); return; }
    try {
      const res = await scopedGet('/api/academics/students/', id, { classroom: classroomId, section: sectionId || undefined }, { timeout: 15000 });
      const items = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      const sorted = [...items].sort((a, b) => {
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
    } catch (error) {
      console.error('Failed to load students:', error);
      setStudents([]);
    }
  };

  const generateReport = async () => {
    if (!selectedClassroom) {
      toast.warning('দয়া করে একটি শ্রেণি নির্বাচন করুন');
      return;
    }

    setLoading(true);
    try {
      const res = await scopedGet('/api/attendance/records/monthly_report/', id, { month: selectedMonth, classroom: selectedClassroom, section: selectedSection || undefined }, { timeout: 15000 });
      let data = res.data || [];
      // If a specific student is selected, filter to that student only
      if (selectedStudent) {
        const sid = parseInt(selectedStudent);
        data = Array.isArray(data) ? data.filter(r => r.student_id === sid) : data;
      }
      setReportData(data);
      setShowReport(true); // Show the report after data is loaded

      // Also load student photos for this classroom/section
      try {
        // Build photo map from already loaded students list
        const map = {};
        const gmap = {};
        (students || []).forEach(s => {
          const u = s.user || {};
          const raw = u.photo_url || u.photo || u.profile_picture || null;
          const resolved = resolvePhotoUrl(raw);
          map[s.id] = resolved;
          const gname = s.guardian_name || s.parent_name || s.father_name || s.mother_name || s.guardian?.name || u.guardian_name || '';
          if (gname) gmap[s.id] = gname;
        });
        setPhotoMap(map);
        setGuardianMap(gmap);
      } catch (e) {
        console.warn('Failed to build student photos map:', e?.response?.data || e);
        setPhotoMap({});
        setGuardianMap({});
      }

      if (res.data.length === 0) {
        toast.info('No attendance data found for the selected period');
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    const cards = document.querySelectorAll('.student-report-card');
    if (!cards.length) {
      toast.warning('No report cards to download');
      return;
    }

    toast.info('Generating PDF... Please wait (this may take a moment for many students)');

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < cards.length; i++) {
        if (i > 0) pdf.addPage();

        const card = cards[i];
        const canvas = await html2canvas(card, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        
        // Calculate dimensions to fit A4 width, maintaining aspect ratio
        const ratio = pdfWidth / imgWidth;
        const finalWidth = pdfWidth;
        const finalHeight = imgHeight * ratio;

        // If height exceeds page, we might need to handle it (but report cards usually fit)
        // For now, just add it at top-left
        pdf.addImage(imgData, 'PNG', 0, 10, finalWidth, finalHeight);
      }
      
      const fileName = `Attendance_Report_${selectedMonth}_${selectedClassroom}.pdf`;
      pdf.save(fileName);
      
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const printReport = () => {
    window.print();
  };

  const getAttendanceColor = (percentage) => {
    if (percentage >= 90) return 'success';
    if (percentage >= 75) return 'primary';
    if (percentage >= 60) return 'warning';
    return 'error';
  };

  const getAttendanceGrade = (percentage) => {
    if (percentage >= 95) return 'চমৎকার';
    if (percentage >= 85) return 'খুব ভালো';
    if (percentage >= 75) return 'ভালো';
    if (percentage >= 60) return 'সন্তোষজনক';
    return 'উন্নতির প্রয়োজন';
  };

  // Get attendance status for a specific date
  const getAttendanceStatus = (student, date) => {
    if (!student.attendance_details || !Array.isArray(student.attendance_details)) {
      return null;
    }
    
    const attendance = student.attendance_details.find(a => a.date === date);
    return attendance ? attendance.status : null;
  };

  // Render attendance status icon
  const renderStatusIcon = (status) => {
    switch (status) {
      case 'present':
        return <PresentIcon color="success" fontSize="small" />;
      case 'absent':
        return <AbsentIcon color="error" fontSize="small" />;
      case 'late':
        return <Typography color="warning.main" fontSize="small">L</Typography>;
      case 'excused':
        return <Typography color="info.main" fontSize="small">E</Typography>;
      default:
        return <UnknownIcon color="disabled" fontSize="small" />;
    }
  };

  const classroomName = classrooms.find(c => c.id === parseInt(selectedClassroom))?.name || '';
  const sectionName = sections.find(s => s.id === parseInt(selectedSection))?.name || 'All Sections';
  const monthName = dayjs(selectedMonth).format('MMMM YYYY');
  
  // Generate all dates in the selected month
  const daysInMonth = useMemo(() => {
    if (!selectedMonth) return [];
    const year = dayjs(selectedMonth).year();
    const month = dayjs(selectedMonth).month();
    const days = [];
    const daysCount = new Date(year, month + 1, 0).getDate();
    
    for (let day = 1; day <= daysCount; day++) {
      const date = new Date(year, month, day);
      // Skip weekends (optional)
      // if (date.getDay() === 0 || date.getDay() === 6) continue;
      days.push({
        date: dayjs(date).format('YYYY-MM-DD'),
        day: day,
        dayName: dayjs(date).format('dd'),
        isWeekend: [0, 6].includes(date.getDay())
      });
    }
    return days;
  }, [selectedMonth]);

  // Toggle row expansion
  const toggleRow = (studentId) => {
    setExpandedRows(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  // Get month name in Bengali
  const monthNameBn = useMemo(() => {
    const months = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const monthIndex = dayjs(selectedMonth).month();
    return months[monthIndex] || '';
  }, [selectedMonth]);

  // Get classroom and section names for display
  const { classroomName: classroomNameDisplay, sectionName: sectionNameDisplay } = useMemo(() => {
    const classroom = classrooms.find(c => c.id === parseInt(selectedClassroom));
    const section = sections.find(s => s.id === parseInt(selectedSection));
    return {
      classroomName: classroom ? classroom.name : 'নির্বাচিত শ্রেণি',
      sectionName: section ? section.name : 'সকল শাখা'
    };
  }, [selectedClassroom, selectedSection, classrooms, sections]);

  // Calculate class average attendance and other statistics
  const { classAverage, attendanceStats } = useMemo(() => {
    if (!reportData.length) return { classAverage: 0, attendanceStats: {} };
    
    const total = reportData.reduce((sum, student) => sum + (student.attendance_percentage || 0), 0);
    const average = total / reportData.length;
    
    // Calculate attendance statistics by day of week
    const stats = {
      byDay: Array(7).fill(0).map(() => ({ present: 0, total: 0 })),
      consecutiveAbsences: {}
    };
    
    reportData.forEach(student => {
      // Track consecutive absences
      if (student.attendance_details) {
        let currentStreak = 0;
        let maxStreak = 0;
        
        student.attendance_details.forEach(day => {
          const date = dayjs(day.date);
          const dayOfWeek = date.day(); // 0 (Sunday) to 6 (Saturday)
          
          // Update day-wise stats
          stats.byDay[dayOfWeek].total++;
          if (day.status === 'present') {
            stats.byDay[dayOfWeek].present++;
            currentStreak = 0; // Reset absence streak
          } else {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
          }
        });
        
        if (maxStreak > 0) {
          stats.consecutiveAbsences[student.student_id] = maxStreak;
        }
      }
    });
    
    return {
      classAverage: average,
      attendanceStats: stats
    };
  }, [reportData]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: { xs: 2, sm: 3 },
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 3,
          display: { print: 'none' }
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
          <CalendarIcon sx={{ fontSize: { xs: 32, sm: 40 } }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', fontSize: { xs: '১.৫rem', sm: '২.১২৫rem' } }}>
              মাসিক হাজিরা প্রতিবেদন
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              মাসিক হাজিরা প্রতিবেদন তৈরি, দেখা ও ডাউনলোড করুন
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2, display: { print: 'none' } }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          প্রতিবেদন প্যারামিটার নির্বাচন করুন
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              label="শ্রেণি *"
              value={selectedClassroom}
              onChange={(e) => setSelectedClassroom(e.target.value)}
            >
              <MenuItem value="">-- শ্রেণি নির্বাচন করুন --</MenuItem>
              {classrooms.map(classroom => (
                <MenuItem key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              label="শাখা (ঐচ্ছিক)"
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              disabled={!selectedClassroom}
            >
              <MenuItem value="">-- সব শাখা --</MenuItem>
              {sections.map(section => (
                <MenuItem key={section.id} value={section.id}>
                  {section.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Optional Student Filter */}
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              label="শিক্ষার্থী (ঐচ্ছিক)"
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              disabled={!selectedClassroom || students.length === 0}
            >
              <MenuItem value="">-- সবাই --</MenuItem>
              {students.map(stu => (
                <MenuItem key={stu.id} value={stu.id}>
                  {stu.user?.first_name} {stu.user?.last_name} ({stu.roll_number || '-'})
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              type="month"
              fullWidth
              label="মাস"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <VisibilityIcon />}
              onClick={generateReport}
              disabled={!selectedClassroom || loading}
              sx={{ height: '56px' }}
            >
              {loading ? 'লোড হচ্ছে...' : 'প্রতিবেদন দেখুন'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Action Buttons */}
      {showReport && reportData.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ mb: 3, display: { print: 'none' } }} justifyContent="center">
          <Button
            variant="contained"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={downloadPDF}
            size="large"
          >
            ডাউনলোড PDF
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<PrintIcon />}
            onClick={printReport}
            size="large"
          >
            প্রিন্ট প্রতিবেদন
          </Button>
        </Stack>
      )}

      {/* Report Card */}
      {showReport && reportData.length > 0 && (
        <Paper
          ref={reportRef}
          sx={{
            p: { xs: 2, sm: 4 },
            borderRadius: 2,
            '@media print': {
              boxShadow: 'none',
              p: 0,
              backgroundColor: 'transparent'
            }
          }}
          id="attendance-report-card"
        >
          {/* Report Header - Hidden in Print (Each card has its own header) */}
          <Box sx={{ mb: 4, display: 'block', '@media print': { display: 'none' } }}>
            <Grid container spacing={2} alignItems="center" justifyContent="space-between">
              {/* School Logo */}
              <Grid item xs={3} sx={{ textAlign: 'left' }}>
                {schoolInfo?.logo && (
                  <Box sx={{ width: 80, height: 80, mb: 2 }}>
                    <img 
                      src={resolvePhotoUrl(schoolInfo.logo)} 
                      alt="School Logo" 
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  </Box>
                )}
              </Grid>
              
              {/* School Info */}
              <Grid item xs={6} sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                  {schoolInfo?.name || 'School Name'}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                  {schoolInfo?.address || 'School Address'}
                </Typography>
                {schoolInfo?.phone && (
                  <Typography variant="body2" color="text.secondary">
                    ফোন: {schoolInfo.phone}
                  </Typography>
                )}
                <Divider sx={{ my: 2 }} />
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                  মাসিক হাজিরা প্রতিবেদন
                </Typography>
              </Grid>
              
              {/* Report Info */}
              <Grid item xs={3} sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  প্রতিবেদন নম্বর: {`REP-${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  তারিখ: {dayjs().format('DD MMMM YYYY')}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  সময়: {dayjs().format('h:mm A')}
                </Typography>
              </Grid>
            </Grid>
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
              <Chip
                icon={<ClassIcon />}
                label={`শ্রেণি: ${classroomName}`}
                color="primary"
                sx={{ fontWeight: 'bold' }}
              />
              <Chip
                icon={<PersonIcon />}
                label={`শাখা: ${sectionName}`}
                color="secondary"
                sx={{ fontWeight: 'bold' }}
              />
              <Chip
                icon={<CalendarIcon />}
                label={`মাস: ${monthName}`}
                color="info"
                sx={{ fontWeight: 'bold' }}
              />
              {selectedStudent && (
                <Chip
                  icon={<PersonIcon />}
                  label={`শিক্ষার্থী: ${(() => { const s = students.find(x => x.id === parseInt(selectedStudent)); return s ? `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim() : selectedStudent; })()}`}
                  color="success"
                  sx={{ fontWeight: 'bold' }}
                />
              )}
            </Stack>
          </Box>

          {/* Summary Statistics */}
          <Grid container spacing={2} sx={{ mb: 4, display: { print: 'none' } }}>
            <Grid item xs={12} sm={3}>
              <Card sx={{ bgcolor: 'primary.50', height: '100%' }}>
                <CardContent>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    {reportData.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    মোট শিক্ষার্থী
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card sx={{ bgcolor: 'success.50', height: '100%' }}>
                <CardContent>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    {reportData.filter(r => r.attendance_percentage >= 75).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ভালো উপস্থিতি (≥৭৫%)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card sx={{ bgcolor: 'warning.50', height: '100%' }}>
                <CardContent>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                    {reportData.filter(r => r.attendance_percentage >= 60 && r.attendance_percentage < 75).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    গড় উপস্থিতি (৬০–৭৪%)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card sx={{ bgcolor: 'error.50', height: '100%' }}>
                <CardContent>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                    {reportData.filter(r => r.attendance_percentage < 60).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    দুর্বল উপস্থিতি (&lt;৬০%)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Main Report Card */}
          <Grid container spacing={3}>
            {reportData.map((student, index) => {
              const presentDates = student.attendance_details
                ?.filter(a => a.status === 'present')
                .map(a => dayjs(a.date).date()) || [];
              
              // Get all days in the selected month
              const daysInMonth = [];
              const weekDays = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'];
              
              if (selectedMonth) {
                const year = dayjs(selectedMonth).year();
                const month = dayjs(selectedMonth).month();
                const daysCount = new Date(year, month + 1, 0).getDate();
                const firstDay = new Date(year, month, 1).getDay();
                
                // Add empty cells for days before the 1st of the month
                for (let i = 0; i < firstDay; i++) {
                  daysInMonth.push({ day: '', isCurrentMonth: false });
                }
                
                // Add all days of the month
                for (let i = 1; i <= daysCount; i++) {
                  daysInMonth.push({ 
                    day: i, 
                    isCurrentMonth: true,
                    isPresent: presentDates.includes(i),
                    date: new Date(year, month, i)
                  });
                }
                
                // Add empty cells to complete the last week
                const remainingCells = (7 - ((daysCount + firstDay) % 7)) % 7;
                for (let i = 0; i < remainingCells; i++) {
                  daysInMonth.push({ day: '', isCurrentMonth: false });
                }
              }
              
              return (
                <Grid item xs={12} key={student.student_id} className="student-report-card-wrapper">
                  <Card 
                    variant="outlined" 
                    className="student-report-card"
                    sx={{ 
                      borderRadius: 2, 
                      overflow: 'hidden',
                      '@media print': {
                        breakInside: 'avoid',
                        pageBreakInside: 'avoid',
                        mb: 4,
                        border: '1px solid #000'
                      }
                    }}
                  >
                    {/* School Header */}
                    <Box sx={{ 
                      bgcolor: '#1976d2', 
                      color: 'white', 
                      p: 2,
                      borderBottom: '1px solid #1565c0',
                      position: 'relative',
                      minHeight: '120px',
                      '@media print': {
                        bgcolor: '#1976d2 !important',
                        color: 'white !important',
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact'
                      }
                    }}>
                      {/* School Logo (Left) */}
                      <Box sx={{ 
                        position: 'absolute', 
                        left: 16, 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        width: 70,
                        height: 70,
                        borderRadius: '4px',
                        border: '2px solid white',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'white',
                        padding: '4px'
                      }}>
                        <Box 
                          component="img"
                          src="/logo.png"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzE5NzZkMiIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MxLjY2IDAgMyAxLjM0IDMgM3MtMS4zNCAzLTMgMy0zLTEuMzQtMy0zIDEuMzQtMyAzLTN6bTAgMTQuMmMtMi41IDAtNC43MS0xLjI4LTYtMy4yMi4wMy0xLjk5IDQtMy4wOCA2LTMuMDggMS45OSAwIDUuOTcgMS4wOSA2IDMuMDgtMS4yOSAxLjk0LTMuNSAzLjIyLTYgMy4yeiIvPjwvc3ZnPg==';
                          }}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain'
                          }}
                          alt="School Logo"
                        />
                      </Box>
                      
                      {/* School Info (Center) */}
                      <Box sx={{ 
                        textAlign: 'center',
                        maxWidth: '60%',
                        mx: 'auto',
                        position: 'relative',
                        zIndex: 1
                      }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          {schoolInfo?.name || 'স্কুল নাম'}
                        </Typography>
                        <Typography variant="subtitle2" sx={{ opacity: 0.9, mb: 0.5 }}>
                          {schoolInfo?.address || ''}
                        </Typography>
                        <Typography variant="h6" sx={{ mt: 1, fontWeight: 'bold', mb: 0.5 }}>
                          মাসিক হাজিরা প্রতিবেদন
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {dayjs(selectedMonth).format('MMMM YYYY')} • {student.classroom} - {student.section}
                        </Typography>
                      </Box>
                      
                      {/* Student Photo (Right) */}
                      <Box sx={{ 
                        position: 'absolute', 
                        right: 16, 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        width: 80,
                        height: 100,
                        border: '2px solid white',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        bgcolor: 'white'
                      }}>
                        <ImageWithFallback 
                          src={photoMap[student.student_id]} 
                          alt={student.student_name}
                          width={80}
                          height={100}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover' 
                          }}
                        />
                      </Box>
                    </Box>

                    
                    {/* Student Info */}
                    <Box sx={{ p: 3, borderBottom: '1px solid #e0e0e0' }}>
                      <Grid container spacing={2}>
                        {/* Student Photo */}
                        <Grid item xs={12} sm={4} md={3}>
                          <Box sx={{ 
                            width: 100, 
                            height: 100, 
                            borderRadius: '50%', 
                            overflow: 'hidden',
                            border: '2px solid #e0e0e0',
                            mx: 'auto'
                          }}>
                            <ImageWithFallback 
                              src={photoMap[student.student_id]} 
                              alt={student.student_name}
                              width={100}
                              height={100}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </Box>
                        </Grid>
                        
                        {/* Student Details */}
                        <Grid item xs={12} sm={8} md={9}>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                            {student.student_name}
                          </Typography>
                          <Typography variant="body1" sx={{ mb: 0.5 }}>
                            <Box component="span" sx={{ fontWeight: 'medium' }}>রোল:</Box> {student.roll_number || 'N/A'}
                          </Typography>
                          {guardianMap[student.student_id] && (
                            <Typography variant="body1" sx={{ mb: 2 }}>
                              <Box component="span" sx={{ fontWeight: 'medium' }}>পিতার নাম:</Box> {guardianMap[student.student_id]}
                            </Typography>
                          )}
                          
                          {/* Attendance Summary */}
                          <Grid container spacing={1} sx={{ mt: 1 }}>
                            <Grid item xs={6} sm={3}>
                              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{student.total_days}</Typography>
                                <Typography variant="body2">মোট দিন</Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#e8f5e9', borderRadius: 1 }}>
                                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>{student.present_days}</Typography>
                                <Typography variant="body2">উপস্থিত</Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#ffebee', borderRadius: 1 }}>
                                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#c62828' }}>{student.absent_days}</Typography>
                                <Typography variant="body2">অনুপস্থিত</Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                                <Typography variant="h6" sx={{ 
                                  fontWeight: 'bold', 
                                  color: '#1565c0'
                                }}>
                                  {student.attendance_percentage}%
                                </Typography>
                                <Typography variant="body2">শতকরা</Typography>
                              </Box>
                            </Grid>
                          </Grid>
                        </Grid>
                      </Grid>
                    </Box>

                    {/* Calendar View */}
                    <Box sx={{ p: 3 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center' }}>
                        {dayjs(selectedMonth).format('MMMM YYYY')}
                      </Typography>
                      
                      {/* Day Headers */}
                      <Grid container spacing={0} sx={{ mb: 1, borderBottom: '1px solid #e0e0e0', pb: 1 }}>
                        {weekDays.map((day) => (
                          <Grid 
                            item 
                            xs 
                            key={day} 
                            sx={{ 
                              textAlign: 'center', 
                              fontWeight: 'bold',
                              py: 1,
                              color: '#424242',
                              fontSize: '0.9rem'
                            }}
                          >
                            {day}
                          </Grid>
                        ))}
                      </Grid>
                      
                      {/* Calendar Days */}
                      <Grid container spacing={0}>
                        {daysInMonth.map((dayObj, idx) => (
                          <Grid 
                            item 
                            xs 
                            key={idx}
                            sx={{ 
                              aspectRatio: '1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              border: '1px solid #f5f5f5',
                              bgcolor: dayObj.isPresent ? '#e8f5e9' : 'white',
                              '&:hover': {
                                bgcolor: dayObj.isPresent ? '#c8e6c9' : '#f5f5f5',
                              },
                              ...(!dayObj.isCurrentMonth && {
                                bgcolor: '#fafafa',
                                color: '#bdbdbd'
                              })
                            }}
                          >
                            {dayObj.day || ''}
                            {dayObj.isPresent && (
                              <Box sx={{
                                position: 'absolute',
                                bottom: 2,
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: '#2e7d32'
                              }} />
                            )}
                          </Grid>
                        ))}
                      </Grid>
                      
                      {/* Legend */}
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        gap: 3, 
                        mt: 3, 
                        pt: 2, 
                        borderTop: '1px dashed #e0e0e0',
                        fontSize: '0.8rem'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 14, height: 14, bgcolor: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '2px' }} />
                          <span>উপস্থিত</span>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 14, height: 14, bgcolor: 'white', border: '1px solid #e0e0e0', borderRadius: '2px' }} />
                          <span>অনুপস্থিত</span>
                        </Box>
                      </Box>
                    </Box>
                    
                    {/* Footer */}
                    <Box sx={{ p: 3, bgcolor: '#f5f5f5', borderTop: '1px solid #e0e0e0' }}>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
                              প্রধান শিক্ষক
                            </Typography>
                            <Box sx={{ 
                              width: '80%', 
                              height: 1, 
                              borderBottom: '1px solid #9e9e9e',
                              mx: 'auto',
                              mb: 0.5
                            }} />
                            <Typography variant="caption" sx={{ color: '#616161' }}>
                              স্বাক্ষর ও সীল
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
                              প্রতিবেদনের তারিখ
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                              {dayjs().format('DD/MM/YYYY')}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                      
                      {/* Class Comparison */}
                      <Box sx={{ mt: 4, mb: 3, p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center', color: '#424242' }}>
                          শ্রেণির গড় উপস্থিতির তুলনা
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="body2">শ্রেণির গড়:</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#1565c0' }}>{classAverage}%</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2">{student.student_name.split(' ')[0]}:</Typography>
                          <Typography variant="body1" sx={{ 
                            fontWeight: 'bold',
                            color: getAttendanceColor(student.attendance_percentage) === 'success' ? '#2e7d32' : 
                                  getAttendanceColor(student.attendance_percentage) === 'warning' ? '#ef6c00' : '#c62828'
                          }}>
                            {student.attendance_percentage}%
                          </Typography>
                        </Box>
                      </Box>
                      
                      {/* Signatures */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3, pt: 2, borderTop: '1px dashed #bdbdbd' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          স্বাক্ষর, শ্রেণি শিক্ষক
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          স্বাক্ষর, প্রধান শিক্ষক
                        </Typography>
                      </Box>
                      
                      {/* Report Info */}
                      <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid #e0e0e0', textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#757575', display: 'block', mb: 1 }}>
                          প্রতিবেদন প্রস্তুত: {dayjs().format('DD MMMM YYYY, hh:mm A')}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#424242', fontWeight: 'medium' }}>
                          {schoolInfo?.name || 'স্কুল নাম'} - সকল অধিকার সংরক্ষিত © {dayjs().year()}
                        </Typography>
                      </Box>
                      
                      {/* Grading System */}
                      <Box sx={{ mt: 3, pt: 2, borderTop: '1px dashed #bdbdbd' }}>
                        <Typography variant="overline" sx={{ 
                          display: 'block', 
                          textAlign: 'center', 
                          fontWeight: 'bold',
                          color: '#616161',
                          mb: 1
                        }}>
                          হাজিরা গ্রেডিং ব্যবস্থা:
                        </Typography>
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'center', 
                          gap: 2, 
                          flexWrap: 'wrap', 
                          fontSize: '0.75rem',
                          color: '#424242'
                        }}>
                          <span>চমৎকার (≥৯৫%)</span>
                          <span>খুব ভালো (৮৫–৯৪%)</span>
                          <span>ভালো (৭৫–৮৪%)</span>
                          <span>সন্তোষজনক (৬০–৭৪%)</span>
                          <span>উন্নতির প্রয়োজন (&lt;৬০%)</span>
                        </Box>
                      </Box>
                    </Box>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {/* Footer */}
          <Box sx={{ mt: 4, pt: 2, color: 'text.secondary', fontSize: '0.875rem' }}>
            <Grid container spacing={2}>
              {/* Class Average Comparison */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    শ্রেণির গড় উপস্থিতির তুলনা
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ width: '40%' }}>শ্রেণির গড়:</Box>
                    <Box sx={{ width: '60%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ width: '100%', mr: 1 }}>
                          <Box 
                            sx={{
                              height: 20,
                              borderRadius: 1,
                              bgcolor: 'success.light',
                              width: `${classAverage}%`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              pr: 1,
                              color: 'white',
                              fontSize: '0.75rem'
                            }}
                          >
                            {classAverage.toFixed(1)}%
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                  {reportData.map((student) => (
                    <Box key={student.student_id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ width: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {student.student_name}
                      </Box>
                      <Box sx={{ width: '60%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ width: '100%', mr: 1 }}>
                            <Box 
                              sx={{
                                height: 20,
                                borderRadius: 1,
                                bgcolor: student.attendance_percentage >= 75 ? 'success.main' : 
                                         student.attendance_percentage >= 60 ? 'warning.main' : 'error.main',
                                width: `${student.attendance_percentage}%`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                pr: 1,
                                color: 'white',
                                fontSize: '0.75rem',
                                transition: 'width 0.5s ease-in-out'
                              }}
                            >
                              {student.attendance_percentage.toFixed(1)}%
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Card>
              </Grid>
              
              {/* Signatures */}
              <Grid item xs={12} md={6}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center', mt: 4 }}>
                      <Typography variant="body2" sx={{ borderTop: '1px solid', pt: 1, mt: 4, width: '80%', mx: 'auto' }}>
                        স্বাক্ষর, শ্রেণি শিক্ষক
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center', mt: 4 }}>
                      <Typography variant="body2" sx={{ borderTop: '1px solid', pt: 1, mt: 4, width: '80%', mx: 'auto' }}>
                        স্বাক্ষর, প্রধান শিক্ষক
                      </Typography>
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        নাম: {schoolInfo?.principal_name || '________________'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 4, textAlign: 'center' }}>
                  <Typography variant="caption" display="block">
                    প্রতিবেদন প্রস্তুত: {dayjs().format('DD MMMM YYYY, hh:mm A')}
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    {schoolInfo?.name} - সকল অধিকার সংরক্ষিত &copy; {new Date().getFullYear()}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* Legend */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              হাজিরা গ্রেডিং ব্যবস্থা:
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Chip label="চমৎকার (≥৯৫%)" color="success" size="small" />
              <Chip label="খুব ভালো (৮৫–৯৪%)" color="primary" size="small" />
              <Chip label="ভালো (৭৫–৮৪%)" color="info" size="small" />
              <Chip label="সন্তোষজনক (৬০–৭৪%)" color="warning" size="small" />
              <Chip label="উন্নতির প্রয়োজন (<৬০%)" color="error" size="small" />
            </Stack>
          </Box>
        </Paper>
      )}

      {/* No Data Message */}
      {showReport && reportData.length === 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          No attendance records found for the selected classroom, section, and month.
          Please ensure attendance has been marked for this period.
        </Alert>
      )}
    </Box>
  );
}
