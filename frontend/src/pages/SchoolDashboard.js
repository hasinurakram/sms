import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import {
  Box, Typography, Drawer, List, ListItem, ListItemButton, ListItemText,
  AppBar, Toolbar, IconButton, CssBaseline, Divider, Grid, Card, CardContent,
  Badge
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line
} from 'recharts';

const drawerWidth = 240;
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD'];

const roles = [
  { key: 'admin', label: 'Admin', icon: <AdminPanelSettingsIcon fontSize="large" />, color: 'primary' },
  { key: 'teacher', label: 'Teacher', icon: <SchoolIcon fontSize="large" />, color: 'secondary' },
  { key: 'student', label: 'Student', icon: <PersonIcon fontSize="large" />, color: 'info' },
  { key: 'parent', label: 'Parent', icon: <GroupIcon fontSize="large" />, color: 'success' },
  { key: 'committee', label: 'Committee', icon: <AccountBalanceIcon fontSize="large" />, color: 'warning' },
];

const SchoolDashboard = () => {
  const { id } = useParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('admin');
  const [school, setSchool] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [parents, setParents] = useState([]);
  const [committee, setCommittee] = useState([]);

  useEffect(() => {
    if (!id) return;

    api.get('/schools/')
      .then(res => setSchool(res.data.find(s => s.id === parseInt(id)) || null))
      .catch(err => console.error(err));

    api.get(`/school/${id}/api/students/`).then(res => setStudents(res.data)).catch(err => console.error(err));
    api.get(`/school/${id}/api/teachers/`).then(res => setTeachers(res.data)).catch(err => console.error(err));
    api.get(`/school/${id}/api/parents/`).then(res => setParents(res.data)).catch(err => console.error(err));
    api.get(`/school/${id}/api/committee/`).then(res => setCommittee(res.data)).catch(err => console.error(err));
  }, [id]);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const drawer = (
    <div>
      <Toolbar sx={{ fontWeight: 'bold', textAlign: 'center' }}>{school ? school.name : 'School'}</Toolbar>
      <Divider />
      <List>
        {roles.map(role => (
          <ListItem key={role.key} disablePadding>
            <ListItemButton onClick={() => setSelectedRole(role.key)}>
              <ListItemText primary={role.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  const getDataByRole = () => {
    switch(selectedRole) {
      case 'admin': return students;
      case 'teacher': return teachers;
      case 'student': return students;
      case 'parent': return parents;
      case 'committee': return committee;
      default: return [];
    }
  };

  const renderCards = () => {
    const data = getDataByRole();
    const roleInfo = roles.find(r => r.key === selectedRole);

    return (
      <Grid container spacing={3}>
        {data.length > 0 ? data.map((item, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}  key={i}>
            <Card sx={{
              borderRadius: 3, boxShadow: 3,
              transition: '0.3s',
              '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 }
            }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Badge color={roleInfo.color} badgeContent={roleInfo.label}>
                  {roleInfo.icon}
                </Badge>
                <Typography variant="h6" mt={1}>{item.name}</Typography>
                {selectedRole === 'student' && item.class && <Typography>Class: {item.class}</Typography>}
                {selectedRole === 'teacher' && item.subjects && <Typography>Subjects: {item.subjects.join(', ')}</Typography>}
              </CardContent>
            </Card>
          </Grid>
        )) : <Typography>No {roleInfo.label} found.</Typography>}
      </Grid>
    );
  };

  const renderCharts = () => {
    switch(selectedRole) {
      case 'admin': {
        const chartData = [
          { name: 'Students', value: students.length },
          { name: 'Teachers', value: teachers.length },
          { name: 'Parents', value: parents.length },
          { name: 'Committee', value: committee.length },
        ];
        return (
          <Box mt={4} sx={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={100} label>
                  {chartData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </Box>
        );
      }

      case 'teacher': {
        const attendanceData = students.map(s => ({ name: s.name, attendance: s.attendance || Math.floor(Math.random()*30 + 70) }));
        return (
          <Box mt={4} sx={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="attendance" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        );
      }

      case 'student': {
        const classWise = {};
        students.forEach(s => { if(!classWise[s.class]) classWise[s.class]=0; classWise[s.class]+=s.marks||Math.floor(Math.random()*30+70); });
        const progressData = Object.keys(classWise).map(cls => ({ class: cls, average: classWise[cls]/students.filter(s => s.class===cls).length }));
        return (
          <Box mt={4} sx={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="class" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="average" stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        );
      }

      default: return null;
    }
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ width: { sm: `calc(100% - ${drawerWidth}px)` }, ml: { sm: `${drawerWidth}px` } }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap>{school ? school.name : "School Dashboard"}</Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth } }}>{drawer}</Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth } }} open>{drawer}</Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` }, mt: 8 }}>
        {renderCards()}
        {renderCharts()}
      </Box>
    </Box>
  );
};

export default SchoolDashboard;
