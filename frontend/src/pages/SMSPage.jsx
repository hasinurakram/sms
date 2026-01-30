import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { scopedGet } from '../utils/schoolApi';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Stack,
  Tabs,
  Tab,
  MenuItem,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Divider,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress
} from '@mui/material';
import SmsIcon from '@mui/icons-material/Sms';
import SendIcon from '@mui/icons-material/Send';
import GroupIcon from '@mui/icons-material/Group';
import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import MicIcon from '@mui/icons-material/Mic';
import { useToast } from '../components/Toast';
import { CardSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import VoiceRecorder from '../components/VoiceRecorder';

export default function SMSPage() {
  const { id } = useParams();
  const toast = useToast();
  
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Data
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  
  // Form data
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateData, setTemplateData] = useState({});
  
  // Manual selection
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  
  // Class selection
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [sections, setSections] = useState([]);
  
  // Results
  const [sendResults, setSendResults] = useState(null);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  
  // Voice message
  const [voiceRecorderOpen, setVoiceRecorderOpen] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState(null);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappLinks, setWhatsappLinks] = useState([]);
  const [voiceDownloadUrl, setVoiceDownloadUrl] = useState(null);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentsRes, parentsRes, teachersRes, classroomsRes] = await Promise.all([
        scopedGet('/api/academics/students/', id, {}, { timeout: 15000 }),
        scopedGet('/api/users/parents/', id, {}, { timeout: 15000 }),
        scopedGet('/api/academics/assignments/', id, { classroom__school: id }, { timeout: 15000 }),
        scopedGet('/api/academics/classrooms/', id, {}, { timeout: 15000 })
      ]);
      
      setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : studentsRes.data.results || []);
      setParents(Array.isArray(parentsRes.data) ? parentsRes.data : parentsRes.data.results || []);
      
      // Extract unique teachers
      const assignments = Array.isArray(teachersRes.data) ? teachersRes.data : teachersRes.data.results || [];
      const teacherMap = new Map();
      assignments.forEach(a => {
        if (a.teacher) teacherMap.set(a.teacher.id, a.teacher);
      });
      setTeachers(Array.from(teacherMap.values()));
      
      setClassrooms(Array.isArray(classroomsRes.data) ? classroomsRes.data : classroomsRes.data.results || []);
      
      setLoading(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load data');
      setLoading(false);
    }
  };

  const loadSections = async (classroomId) => {
    if (!classroomId) {
      setSections([]);
      return;
    }
    try {
      const res = await scopedGet('/api/academics/sections/', id, { classroom: classroomId }, { timeout: 15000 });
      setSections(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClassChange = (classId) => {
    setSelectedClass(classId);
    setSelectedSection('');
    loadSections(classId);
  };

  const toggleRecipient = (phone) => {
    if (selectedRecipients.includes(phone)) {
      setSelectedRecipients(selectedRecipients.filter(p => p !== phone));
    } else {
      setSelectedRecipients([...selectedRecipients, phone]);
    }
  };

  const selectAll = (type) => {
    let phones = [];
    if (type === 'parents') {
      phones = parents.filter(p => p.user?.phone_number).map(p => p.user.phone_number);
    } else if (type === 'teachers') {
      phones = teachers.filter(t => t.phone_number).map(t => t.phone_number);
    }
    setSelectedRecipients([...new Set([...selectedRecipients, ...phones])]);
  };

  const clearSelection = () => {
    setSelectedRecipients([]);
  };

  const getClassStudents = () => {
    let filtered = students;
    if (selectedClass) {
      filtered = filtered.filter(s => s.classroom?.id === parseInt(selectedClass));
    }
    if (selectedSection) {
      filtered = filtered.filter(s => s.section?.id === parseInt(selectedSection));
    }
    return filtered;
  };

  const getClassParentPhones = () => {
    const classStudents = getClassStudents();
    const phones = classStudents
      .filter(s => s.guardian?.phone_number)
      .map(s => s.guardian.phone_number);
    return [...new Set(phones)];
  };

  const getAllSchoolPhones = () => {
    const parentPhones = parents.filter(p => p.user?.phone_number).map(p => p.user.phone_number);
    const teacherPhones = teachers.filter(t => t.phone_number).map(t => t.phone_number);
    return [...new Set([...parentPhones, ...teacherPhones])];
  };

  const handleVoiceSave = (audioFile) => {
    setVoiceMessage(audioFile);
    toast.success('Voice message attached! Click send to deliver.');
  };

  const normalizePhoneForWhatsApp = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    if (/^01\d{9}$/.test(digits)) {
      return `880${digits.slice(1)}`;
    }
    if (/^0\d+$/.test(digits)) {
      return `880${digits.replace(/^0+/, '')}`;
    }
    return digits;
  };

  const handleSendViaWhatsApp = () => {
    if (selectedRecipients.length === 0) {
      toast.warning('Please select at least one recipient');
      return;
    }
    if (!message.trim() && !voiceMessage) {
      toast.warning('Please enter a message or record a voice message');
      return;
    }
    const text = message.trim() || 'Voice message';
    const encodedText = encodeURIComponent(text);
    const links = [];
    selectedRecipients.forEach((p) => {
      const formatted = normalizePhoneForWhatsApp(p);
      if (formatted) {
        links.push({
          phone: p,
          wa: `https://wa.me/${formatted}?text=${encodedText}`,
        });
      }
    });
    if (links.length === 0) {
      toast.error('No valid phone numbers for WhatsApp');
      return;
    }
    if (voiceMessage) {
      try {
        const url = URL.createObjectURL(voiceMessage);
        setVoiceDownloadUrl(url);
      } catch (_) {
        setVoiceDownloadUrl(null);
      }
    } else {
      setVoiceDownloadUrl(null);
    }
    setWhatsappLinks(links);
    setWhatsappDialogOpen(true);
  };

  const handleSendManual = async () => {
    if (selectedRecipients.length === 0) {
      toast.warning('Please select at least one recipient');
      return;
    }
    
    if (!message.trim() && !voiceMessage) {
      toast.warning('Please enter a message or record a voice message');
      return;
    }

    setSending(true);
    try {
      if (voiceMessage) {
        // TODO: Implement voice message sending via WhatsApp/Telegram API
        // For now, just show success message
        toast.info('Voice message feature coming soon! Will be sent via WhatsApp/Telegram.');
        setVoiceMessage(null);
      } else {
        const res = await api.post('/api/users/sms/bulk/', {
          phone_numbers: selectedRecipients,
          message: message
        });
        
        setSendResults(res.data);
        setResultsDialogOpen(true);
        toast.success(`SMS sent to ${res.data.sent} recipients!`);
      }
      
      setMessage('');
      setSelectedRecipients([]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSendToClass = async () => {
    if (!selectedClass) {
      toast.warning('Please select a class');
      return;
    }
    if (!message.trim()) {
      toast.warning('Please enter a message');
      return;
    }

    const phones = getClassParentPhones();
    if (phones.length === 0) {
      toast.warning('No parent phone numbers found for this class');
      return;
    }

    setSending(true);
    try {
      const res = await api.post('/api/users/sms/bulk/', {
        phone_numbers: phones,
        message: message
      });
      
      setSendResults(res.data);
      setResultsDialogOpen(true);
      toast.success(`SMS sent to ${res.data.sent} parents!`);
      setMessage('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const handleSendToSchool = async () => {
    if (!message.trim()) {
      toast.warning('Please enter a message');
      return;
    }

    const phones = getAllSchoolPhones();
    if (phones.length === 0) {
      toast.warning('No phone numbers found');
      return;
    }

    setSending(true);
    try {
      const res = await api.post('/api/users/sms/bulk/', {
        phone_numbers: phones,
        message: message
      });
      
      setSendResults(res.data);
      setResultsDialogOpen(true);
      toast.success(`SMS sent to ${res.data.sent} recipients across the school!`);
      setMessage('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const templates = [
    { value: '', label: 'No Template (Custom Message)' },
    { value: 'result', label: 'Result Published' },
    { value: 'fee_reminder', label: 'Fee Reminder' },
    { value: 'attendance', label: 'Attendance Alert' },
    { value: 'exam_schedule', label: 'Exam Schedule' },
    { value: 'meeting', label: 'Meeting Invitation' },
  ];

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <CardSkeleton count={3} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper 
        elevation={0}
        sx={{ 
          mb: 3, 
          p: 3, 
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: 'white',
          borderRadius: 3
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
              <SmsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              এসএমএস নোটিফিকেশন
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              অভিভাবক ও শিক্ষকদের কাছে তাৎক্ষণিক বার্তা পাঠান
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip 
              label={`${parents.length} অভিভাবক`} 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                fontWeight: 'bold'
              }} 
            />
            <Chip 
              label={`${teachers.length} শিক্ষক`} 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                fontWeight: 'bold'
              }} 
            />
          </Stack>
        </Stack>
      </Paper>

      {/* Cost Warning */}
      <Alert 
        severity="info" 
        sx={{ 
          mb: 3, 
          borderRadius: 2,
          '& .MuiAlert-icon': { fontSize: 28 }
        }}
      >
        <Typography variant="body2">
          <strong>💰 খরচ:</strong> প্রতি এসএমএস ~০.২৫ টাকা (~$০.০০২ ইউএসডি)।
          বর্তমানে <strong>কনসোল মোড</strong> (ফ্রি - বার্তাগুলো কনসোলে প্রদর্শিত হয়)।
          প্রোডাকশনের জন্য settings.py-তে এসএমএস প্রোভাইডার কনফিগার করুন।
        </Typography>
      </Alert>

      {/* Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 3, boxShadow: 2 }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, v) => setTabValue(v)} 
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              py: 2,
              fontSize: '0.95rem',
              fontWeight: 500
            }
          }}
        >
          <Tab icon={<PersonIcon />} label="ম্যানুয়াল নির্বাচন" iconPosition="start" />
          <Tab icon={<GroupIcon />} label="শ্রেণী অনুযায়ী" iconPosition="start" />
          <Tab icon={<SchoolIcon />} label="সকল স্কুল" iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Grid container spacing={3}>
        {/* Left: Message Composer */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 3 }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
              ✍️ বার্তা লিখুন
            </Typography>
            
            {/* Template Selection */}
            <TextField
              select
              label="টেমপ্লেট ব্যবহার করুন (ঐচ্ছিক)"
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            >
              {templates.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>

            {/* Message Input */}
            <TextField
              label="Message"
              multiline
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              fullWidth
              placeholder="এখানে আপনার বার্তা লিখুন..."
              helperText={`${message.length} অক্ষর`}
              sx={{ mb: 2 }}
            />

            {/* Voice Message Section */}
            <Box sx={{ mb: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Button
                  variant="outlined"
                  startIcon={<MicIcon />}
                  onClick={() => setVoiceRecorderOpen(true)}
                  sx={{ borderRadius: 2 }}
                >
                  ভয়েস মেসেজ রেকর্ড করুন
                </Button>
                {voiceMessage && (
                  <Chip
                    label="🎤 ভয়েস মেসেজ সংযুক্ত"
                    onDelete={() => setVoiceMessage(null)}
                    color="success"
                  />
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                হোয়াটসঅ্যাপ/টেলিগ্রামের মাধ্যমে পাঠাতে ভয়েস মেসেজ রেকর্ড করুন
              </Typography>
            </Box>

            {/* Tab 0: Manual Selection */}
            {tabValue === 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  নির্বাচিত: {selectedRecipients.length} প্রাপক
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Button size="small" onClick={() => selectAll('parents')}>
                    সব অভিভাবক নির্বাচন
                  </Button>
                  <Button size="small" onClick={() => selectAll('teachers')}>
                    সব শিক্ষক নির্বাচন
                  </Button>
                  <Button size="small" onClick={clearSelection} color="error">
                    মুছে দিন
                  </Button>
                </Stack>
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={handleSendManual}
                  disabled={sending || selectedRecipients.length === 0 || !message.trim()}
                  fullWidth
                  size="large"
                >
                  {sending ? 'পাঠানো হচ্ছে...' : `${selectedRecipients.length} জনকে পাঠান`}
                </Button>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={handleSendViaWhatsApp}
                    disabled={selectedRecipients.length === 0 || (!message.trim() && !voiceMessage)}
                  >
                    WhatsApp Web-এ পাঠান
                  </Button>
                  {voiceMessage && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => {
                        try {
                          const url = voiceDownloadUrl || URL.createObjectURL(voiceMessage);
                          setVoiceDownloadUrl(url);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = voiceMessage.name || 'voice_message.webm';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          toast.info('Voice file downloaded. Attach it in WhatsApp manually.');
                        } catch (e) {
                          toast.error('Failed to prepare download for voice message');
                        }
                      }}
                    >
                      ভয়েস ফাইল ডাউনলোড করুন
                    </Button>
                  )}
                </Stack>
              </Box>
            )}

            {/* Tab 1: By Class */}
            {tabValue === 1 && (
              <Box>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="শ্রেণী নির্বাচন করুন"
                      value={selectedClass}
                      onChange={(e) => handleClassChange(e.target.value)}
                      fullWidth
                    >
                      <MenuItem value="">সব শ্রেণী</MenuItem>
                      {classrooms.map((c) => (
                        <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="সেকশন নির্বাচন করুন"
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      fullWidth
                      disabled={!selectedClass}
                    >
                      <MenuItem value="">সব সেকশন</MenuItem>
                      {sections.map((s) => (
                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                </Grid>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  এই শ্রেণীর {getClassParentPhones().length} জন অভিভাবককে পাঠানো হবে
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={handleSendToClass}
                  disabled={sending || !selectedClass || !message.trim()}
                  fullWidth
                  size="large"
                >
                  {sending ? 'পাঠানো হচ্ছে...' : `শ্রেণীর অভিভাবকদের পাঠান`}
                </Button>
              </Box>
            )}

            {/* Tab 2: Entire School */}
            {tabValue === 2 && (
              <Box>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <strong>সতর্কতা:</strong> এটি স্কুলের সমস্ত অভিভাবক ও শিক্ষককে এসএমএস পাঠাবে!
                </Alert>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  মোট {getAllSchoolPhones().length} জন প্রাপক (অভিভাবক + শিক্ষক) এর কাছে পাঠানো হবে
                </Typography>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<SendIcon />}
                  onClick={handleSendToSchool}
                  disabled={sending || !message.trim()}
                  fullWidth
                  size="large"
                >
                  {sending ? 'পাঠানো হচ্ছে...' : `সকলের কাছে পাঠান (${getAllSchoolPhones().length} জন)`}
                </Button>
              </Box>
            )}

            {sending && <LinearProgress sx={{ mt: 2 }} />}
          </Paper>
        </Grid>

        {/* Right: Recipient List (Manual Tab Only) */}
        <Grid size={{ xs: 12, md: 4 }}>
          {tabValue === 0 && (
            <Paper sx={{ p: 2, maxHeight: 600, overflow: 'auto', borderRadius: 3, boxShadow: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                👥 প্রাপক নির্বাচন করুন
              </Typography>
              
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>অভিভাবক:</Typography>
              <List dense>
                {parents.filter(p => p.user?.phone_number).map((parent) => (
                  <ListItem
                    key={parent.id}
                    button
                    onClick={() => toggleRecipient(parent.user.phone_number)}
                  >
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={selectedRecipients.includes(parent.user.phone_number)}
                        tabIndex={-1}
                        disableRipple
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${parent.user.first_name || ''} ${parent.user.last_name || ''}`.trim() || parent.user.username}
                      secondary={parent.user.phone_number}
                    />
                  </ListItem>
                ))}
              </List>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1 }}>শিক্ষক:</Typography>
              <List dense>
                {teachers.filter(t => t.phone_number).map((teacher) => (
                  <ListItem
                    key={teacher.id}
                    button
                    onClick={() => toggleRecipient(teacher.phone_number)}
                  >
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={selectedRecipients.includes(teacher.phone_number)}
                        tabIndex={-1}
                        disableRipple
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.username}
                      secondary={teacher.phone_number}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}

          {tabValue === 1 && selectedClass && (
            <Paper sx={{ p: 2, borderRadius: 3, boxShadow: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                📊 শ্রেণী সারসংক্ষেপ
              </Typography>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">শ্রেণিতে শিক্ষার্থী সংখ্যা:</Typography>
                  <Typography variant="h4">{getClassStudents().length}</Typography>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" color="text.secondary">যে অভিভাবকদের জানানো হবে:</Typography>
                  <Typography variant="h4">{getClassParentPhones().length}</Typography>
                </CardContent>
              </Card>
            </Paper>
          )}

          {tabValue === 2 && (
            <Paper sx={{ p: 2, borderRadius: 3, boxShadow: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                🏫 স্কুল সারসংক্ষেপ
              </Typography>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">মোট অভিভাবক:</Typography>
                  <Typography variant="h4">{parents.filter(p => p.user?.phone_number).length}</Typography>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">মোট শিক্ষক:</Typography>
                  <Typography variant="h4">{teachers.filter(t => t.phone_number).length}</Typography>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" color="text.secondary">মোট প্রাপক:</Typography>
                  <Typography variant="h4" color="primary">{getAllSchoolPhones().length}</Typography>
                </CardContent>
              </Card>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* WhatsApp Links Dialog */}
      <Dialog open={whatsappDialogOpen} onClose={() => setWhatsappDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>WhatsApp Web লিংকসমূহ</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            ভয়েস মেসেজ স্বয়ংক্রিয়ভাবে পাঠানো যায় না। অনুগ্রহ করে WhatsApp-এ গিয়ে ফাইলটি ম্যানুয়ালি সংযুক্ত করুন।
          </Alert>
          {voiceDownloadUrl && (
            <Alert severity="success" sx={{ mb: 2 }}>
              ভয়েস ফাইলটি ডাউনলোড করা হয়েছে/করুন, তারপর চ্যাটে এটাচ করুন।
            </Alert>
          )}
          <List dense>
            {whatsappLinks.map((item, idx) => (
              <ListItem key={idx} component="a" href={item.wa} target="_blank" rel="noopener noreferrer" button>
                <ListItemText primary={item.phone} secondary={item.wa} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWhatsappDialogOpen(false)}>বন্ধ করুন</Button>
        </DialogActions>
      </Dialog>

      {/* Results Dialog */}
      <Dialog open={resultsDialogOpen} onClose={() => setResultsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>এসএমএস পাঠানোর ফলাফল</DialogTitle>
        <DialogContent>
          {sendResults && (
            <Box>
              <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                <Card sx={{ flex: 1, bgcolor: 'success.light' }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CheckCircleIcon color="success" />
                      <Box>
                        <Typography variant="h4">{sendResults.sent}</Typography>
                        <Typography variant="caption">সফল</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
                <Card sx={{ flex: 1, bgcolor: 'error.light' }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <ErrorIcon color="error" />
                      <Box>
                        <Typography variant="h4">{sendResults.failed}</Typography>
                        <Typography variant="caption">ব্যর্থ</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>

              {sendResults.failed > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  কিছু বার্তা পাঠানো যায়নি। নিচের বিস্তারিত দেখুন।
                </Alert>
              )}

              <Typography variant="subtitle2" gutterBottom>বিস্তারিত:</Typography>
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {sendResults.results?.map((result, idx) => (
                  <ListItem key={idx}>
                    <ListItemIcon>
                      {result.success ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <ErrorIcon color="error" fontSize="small" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={result.phone}
                      secondary={result.message}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResultsDialogOpen(false)}>বন্ধ করুন</Button>
        </DialogActions>
      </Dialog>

      {/* Voice Recorder Dialog */}
      <VoiceRecorder
        open={voiceRecorderOpen}
        onClose={() => setVoiceRecorderOpen(false)}
        onSave={handleVoiceSave}
      />
    </Box>
  );
}
