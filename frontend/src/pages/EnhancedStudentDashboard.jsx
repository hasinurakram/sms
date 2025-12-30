import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, CircularProgress, Grid, Chip, Avatar,
  Tabs, Tab, Alert, Button, Container, AppBar, Toolbar,
  useTheme, useMediaQuery
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { ArrowBack } from '@mui/icons-material';
import dayjs from 'dayjs';
import { useToast } from '../components/Toast';
import api from '../utils/api';

// Styled Components
const HeaderCard = styled(Paper)(({ theme }) => ({
  background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
  color: 'white',
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  borderRadius: theme.shape.borderRadius * 2,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '" "',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'radial-gradient(circle at 90% 10%, rgba(255,255,255,0.1) 0%, transparent 20%)',
    pointerEvents: 'none',
  },
}));

const StyledAvatar = styled(Avatar)(({ theme }) => ({
  width: 120,
  height: 120,
  border: '4px solid white',
  boxShadow: theme.shadows[4],
  [theme.breakpoints.down('sm')]: {
    width: 100,
    height: 100,
    margin: '0 auto',
  },
}));

const SchoolLogo = styled('img')(({ theme }) => ({
  maxHeight: 80,
  maxWidth: 200,
  objectFit: 'contain',
  [theme.breakpoints.down('sm')]: {
    maxHeight: 60,
  },
}));

// Placeholder components
const StudentProfile = ({ student }) => {
  if (!student) return <CircularProgress />;
  const user = student.user || {};
  
  return (
    <Paper sx={{ p: 3, mt: 2 }}>
      <Typography variant="h6" gutterBottom>Student Profile</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Typography variant="body2" color="text.secondary">Name</Typography>
          <Typography variant="body1">
            {`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username}
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant="body2" color="text.secondary">Email</Typography>
          <Typography variant="body1">{user.email || 'N/A'}</Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant="body2" color="text.secondary">Phone</Typography>
          <Typography variant="body1">{user.phone_number || 'N/A'}</Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant="body2" color="text.secondary">Roll Number</Typography>
          <Typography variant="body1">{student.roll_number || 'N/A'}</Typography>
        </Grid>
      </Grid>
    </Paper>
  );
};

// Main Component
const StudentDashboard = () => {
  const params = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [student, setStudent] = React.useState(null);
  const [schoolInfo, setSchoolInfo] = React.useState(null);
  const [selectedTab, setSelectedTab] = React.useState(0);

  // Fetch student and school data
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const { id, studentId } = params;
        
        // Fetch student data
        const studentRes = await api.get(`/api/academics/students/${studentId}/`);
        setStudent(studentRes.data);
        
        // Fetch school info
        if (id) {
          try {
            const schoolRes = await api.get(`/api/schools/${id}/`);
            setSchoolInfo(schoolRes.data);
          } catch (err) {
            console.error('Error fetching school info:', err);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load student data');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [params]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button 
          onClick={() => window.location.reload()} 
          variant="contained" 
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  if (!student) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Student not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: '#f5f7fa',
      pb: 4
    }}>
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate(-1)}
            color="inherit"
            sx={{ color: 'text.primary' }}
          >
            Back
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg">
        <HeaderCard elevation={3}>
          <Grid container spacing={3} alignItems="center">
            {/* Student Avatar */}
            <Grid item xs={12} sm="auto" sx={{ textAlign: isMobile ? 'center' : 'left' }}>
              <StyledAvatar
                src={student.profile_picture ? `${String((api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : ''))).replace(/\/+$/,'')}/media/${String(student.profile_picture).replace(/\\/g,'/')}` : null}
                alt={student.user?.first_name || 'Student'}
              />
            </Grid>

            {/* Student Info */}
            <Grid item xs={12} sm>
              <Typography 
                variant="h4" 
                component="h1" 
                sx={{ 
                  color: 'white', 
                  fontWeight: 600, 
                  mb: 1,
                  textAlign: isMobile ? 'center' : 'left'
                }}
              >
                {`${student.user?.first_name || ''} ${student.user?.last_name || ''}`.trim() || 'Student Dashboard'}
              </Typography>
              
              <Box sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 2, 
                alignItems: 'center',
                justifyContent: isMobile ? 'center' : 'flex-start'
              }}>
                {student.roll_number && (
                  <Chip 
                    label={`রোল: ${student.roll_number}`} 
                    color="primary" 
                    variant="outlined" 
                    sx={{ 
                      bgcolor: 'rgba(255,255,255,0.15)', 
                      color: 'white',
                      borderColor: 'rgba(255,255,255,0.3)'
                    }} 
                  />
                )}
                {student.classroom?.name && (
                  <Chip 
                    label={`শ্রেণী: ${student.classroom.name}`} 
                    color="primary" 
                    variant="outlined" 
                    sx={{ 
                      bgcolor: 'rgba(255,255,255,0.15)', 
                      color: 'white',
                      borderColor: 'rgba(255,255,255,0.3)'
                    }} 
                  />
                )}
              </Box>
            </Grid>

            {/* School Logo */}
            {schoolInfo?.logo && (
              <Grid item xs={12} sm="auto" sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: isMobile ? 'center' : 'flex-end',
                mt: isMobile ? 2 : 0,
                width: isMobile ? '100%' : 'auto',
                textAlign: isMobile ? 'center' : 'right'
              }}>
                <SchoolLogo 
                  src={schoolInfo.logo.startsWith('http') ? schoolInfo.logo : `${String((api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : ''))).replace(/\/+$/,'')}/media/${String(schoolInfo.logo).replace(/\\/g,'/')}`}
                  alt={schoolInfo.name || 'School Logo'}
                />
                {schoolInfo.name && (
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)', mt: 1 }}>
                    {schoolInfo.name}
                  </Typography>
                )}
              </Grid>
            )}
          </Grid>
        </HeaderCard>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={selectedTab}
            onChange={(e, newValue) => setSelectedTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTabs-indicator': {
                height: 4,
                borderRadius: '4px 4px 0 0',
              },
            }}
          >
            <Tab label="Profile" />
            <Tab label="Attendance" />
            <Tab label="Results" />
            <Tab label="Fees" />
          </Tabs>
        </Paper>

        {/* Tab Content */}
        <Box sx={{ mt: 2 }}>
          {selectedTab === 0 && <StudentProfile student={student} />}
          {selectedTab === 1 && <Box p={2}><Alert severity="info">Attendance data will be shown here</Alert></Box>}
          {selectedTab === 2 && <Box p={2}><Alert severity="info">Results will be shown here</Alert></Box>}
          {selectedTab === 3 && <Box p={2}><Alert severity="info">Fee details will be shown here</Alert></Box>}
        </Box>
      </Container>
    </Box>
  );
};

export default StudentDashboard;
