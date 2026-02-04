import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Paper,
  Tabs,
  Tab,
  MenuItem,
  Grid,
  Chip,
  Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import BadgeIcon from '@mui/icons-material/Badge';
import IDCard from '../components/IDCard';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { CardSkeleton } from '../components/LoadingSkeleton';

export default function IDCardGenerator() {
  const { id } = useParams();
  const toast = useToast();
  
  const [tabValue, setTabValue] = useState(0); // 0 = Student, 1 = Teacher
  const [searchType, setSearchType] = useState('single'); // single or bulk
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  
  // Generated cards
  const [cards, setCards] = useState([]);

  useEffect(() => {
    if (!id) return;
    loadSchool();
    loadClassrooms();
  }, [id]);

  const loadSchool = () => {
    api.get(`/api/schools/${id}/`)
      .then(res => setSchool(res.data))
      .catch(err => console.error(err));
  };

  const loadClassrooms = () => {
    api.get(`/api/academics/classrooms/?school=${id}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setClassrooms(data);
      })
      .catch(err => console.error(err));
  };

  const loadSections = (classroomId) => {
    if (!classroomId) {
      setSections([]);
      return;
    }
    api.get(`/api/academics/sections/?classroom=${classroomId}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setSections(data);
      })
      .catch(err => console.error(err));
  };

  const handleSearch = async () => {
    if (tabValue === 0) {
      // Student search
      await searchStudents();
    } else {
      // Teacher search
      await searchTeachers();
    }
  };

  const searchStudents = async () => {
    setLoading(true);
    try {
      let url = `/api/academics/students/?school=${id}`;
      
      if (searchType === 'single' && searchQuery) {
        // Support searching by roll number, name, or username
        if (/^\d+$/.test(searchQuery)) {
          url += `&roll_number=${searchQuery}`;
        } else {
          url += `&search=${searchQuery}`;
        }
      } else if (searchType === 'bulk') {
        if (classFilter) url += `&classroom=${classFilter}`;
        if (sectionFilter) url += `&section=${sectionFilter}`;
      }

      const res = await api.get(url);
      let data = Array.isArray(res.data) ? res.data : res.data.results || [];
      
      // Map student data to ensure photo URL is in the correct format
      data = data.map(student => {
        // Get photo URL from possible locations
        const photoUrl = student.photo || 
                        student.user?.photo || 
                        student.user?.photo_url ||
                        (student.user?.photo && `${String((api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : ''))).replace(/\/+$/,'')}${student.user.photo}`);

        return {
          ...student,
          user: {
            ...student.user,
            photo_url: photoUrl,
            photo: photoUrl, // Set both photo and photo_url for backward compatibility
            // Ensure first_name and last_name are available
            first_name: student.user?.first_name || student.name?.split(' ')[0] || '',
            last_name: student.user?.last_name || student.name?.split(' ').slice(1).join(' ') || ''
          }
        };
      });
      
      if (data.length === 0) {
        toast.warning('No students found with the specified criteria');
        setCards([]);
      } else {
        // Sort by roll number if available
        const sortedData = [...data].sort((a, b) => {
          if (a.roll_number && b.roll_number) {
            return parseInt(a.roll_number) - parseInt(b.roll_number);
          }
          return 0;
        });
        
        setCards(sortedData);
        toast.success(`Generated ${sortedData.length} student ID card(s)`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load students');
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const searchTeachers = async () => {
    setLoading(true);
    try {
      let url = `/api/academics/assignments/?classroom__school=${id}`;
      
      if (searchQuery) {
        url += `&search=${searchQuery}`;
      }

      const res = await api.get(url);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      
      // Extract unique teachers
      const teacherMap = new Map();
      data.forEach(assignment => {
        if (assignment.teacher) {
          teacherMap.set(assignment.teacher.id, assignment.teacher);
        }
      });
      
      const teachers = Array.from(teacherMap.values());
      
      if (teachers.length === 0) {
        toast.warning('No teachers found');
        setCards([]);
      } else {
        setCards(teachers);
        toast.success(`Generated ${teachers.length} teacher ID card(s)`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load teachers');
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (cards.length === 0) {
      toast.warning('Please generate ID cards first');
      return;
    }
    
    // Add print-specific styling
    const style = document.createElement('style');
    style.id = 'print-style';
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        .id-card-container, .id-card-container * {
          visibility: visible;
        }
        .id-card-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
          padding: 20px;
        }
        .no-print {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    toast.info('Opening print dialog...');
    setTimeout(() => {
      window.print();
      // Remove the style after printing
      document.head.removeChild(style);
    }, 300);
  };

  const handleReset = () => {
    setSearchQuery('');
    setClassFilter('');
    setSectionFilter('');
    setCards([]);
    toast.info('Form reset');
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper 
        elevation={0}
        sx={{ 
          mb: 3, 
          p: 3, 
          background: 'linear-gradient(135deg, #00b09b 0%, #96c93d 100%)',
          color: 'white',
          borderRadius: 3
        }}
        className="no-print"
      >
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          alignItems={{ xs: 'stretch', sm: 'center' }} 
          justifyContent="space-between" 
          spacing={2}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center' }}>
              <BadgeIcon sx={{ mr: 1, fontSize: 40 }} />
              আইডি কার্ড জেনারেটর
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              শিক্ষার্থী ও শিক্ষকদের জন্য প্রফেশনাল আইডি কার্ড তৈরি ও প্রিন্ট করুন
            </Typography>
            {cards.length > 0 && (
              <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
                {cards.length} card(s) generated | School: {school?.name || id}
              </Typography>
            )}
          </Box>
          {cards.length > 0 && (
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              className="no-print"
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                backdropFilter: 'blur(10px)'
              }}
            >
              সব কার্ড প্রিন্ট করুন
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Search Form */}
      <Paper sx={{ p: 3, mb: 3 }} className="no-print">
        {/* Tabs */}
        <Tabs value={tabValue} onChange={(e, v) => { setTabValue(v); setCards([]); }} sx={{ mb: 2 }}>
          <Tab label="শিক্ষার্থী আইডি কার্ড" />
          <Tab label="শিক্ষক আইডি কার্ড" />
        </Tabs>

        {/* Student Search */}
        {tabValue === 0 && (
          <Box>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Button
                variant={searchType === 'single' ? 'contained' : 'outlined'}
                onClick={() => setSearchType('single')}
                size="small"
              >
                একক শিক্ষার্থী
              </Button>
              <Button
                variant={searchType === 'bulk' ? 'contained' : 'outlined'}
                onClick={() => setSearchType('bulk')}
                size="small"
              >
                একাধিক (শ্রেণি অনুযায়ী)
              </Button>
            </Stack>

            {searchType === 'single' ? (
              <TextField
                label="শিক্ষার্থী অনুসন্ধান"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="রোল নম্বর, নাম বা ইউজারনেম লিখুন"
                fullWidth
                sx={{ mb: 2 }}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                helperText="রোল নম্বর, নাম বা ইউজারনেম দিয়ে অনুসন্ধান করুন"
              />
            ) : (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  select
                  label="শ্রেণি নির্বাচন"
                  value={classFilter}
                  onChange={(e) => {
                    setClassFilter(e.target.value);
                    loadSections(e.target.value);
                    setSectionFilter('');
                  }}
                  fullWidth
                >
                  <MenuItem value="">সব শ্রেণি</MenuItem>
                  {classrooms.map((cls) => (
                    <MenuItem key={cls.id} value={cls.id}>{cls.name}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="সেকশন নির্বাচন"
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  fullWidth
                  disabled={!classFilter}
                >
                  <MenuItem value="">সব সেকশন</MenuItem>
                  {sections.map((sec) => (
                    <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>
                  ))}
                </TextField>
              </Stack>
            )}
          </Box>
        )}

        {/* Teacher Search */}
        {tabValue === 1 && (
          <TextField
            label="Search Teacher"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter teacher name or leave empty for all"
            fullWidth
            sx={{ mb: 2 }}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
        )}

        {/* Action Buttons */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'তৈরি হচ্ছে...' : 'আইডি কার্ড তৈরি করুন'}
          </Button>
          <Button variant="text" onClick={handleReset}>
            রিসেট
          </Button>
        </Stack>

        {cards.length > 0 && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {cards.length} টি আইডি কার্ড তৈরি হয়েছে। নিচে স্ক্রল করে দেখুন ও প্রিন্ট করুন।
          </Alert>
        )}
      </Paper>

      {/* ID Cards Display */}
      {loading && <CardSkeleton count={4} />}

      {!loading && cards.length === 0 && (
        <EmptyState
          icon={BadgeIcon}
          title="কোনো আইডি কার্ড তৈরি হয়নি"
          message={`${tabValue === 0 ? 'শিক্ষার্থী' : 'শিক্ষক'} নির্বাচন করে "আইডি কার্ড তৈরি করুন" বাটনে ক্লিক করুন`}
        />
      )}

      {!loading && cards.length > 0 && (
        <Box className="id-card-container" sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 3, 
          justifyContent: 'center',
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 1
        }}>
          {cards.map((item, idx) => (
            <IDCard
              key={idx}
              type={tabValue === 0 ? 'student' : 'teacher'}
              data={item}
              school={school}
              overridePhone={String(id) === '16' ? '01712923054' : undefined}
              signatureUrl={String(id) === '16' ? `${window.location.origin}/signature.png` : undefined}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
