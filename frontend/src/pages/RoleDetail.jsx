import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab
} from '@mui/material';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line
} from 'recharts';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
import GroupIcon from '@mui/icons-material/Group';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

// Swiper imports
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

import { getRoleTitle, getRoleColor } from '../utils/helpers';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD'];

const roleIcon = (role) => {
  switch (role) {
    case 'admin': return <PersonIcon />;
    case 'teacher': return <SchoolIcon />;
    case 'student': return <PersonIcon />;
    case 'parent': return <GroupIcon />;
    case 'committee': return <AccountBalanceIcon />;
    default: return null;
  }
};

const RoleDetail = () => {
  const { id, role } = useParams();
  const [allData, setAllData] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [tabIndex, setTabIndex] = useState(0);

  useEffect(() => {
    api.get(`/school/${id}/api/${role}/`)
      .then(res => setAllData(res.data))
      .catch(err => console.error(err));
  }, [id, role]);

  const handleCardClick = (item) => {
    setSelectedItem(item);
    setTabIndex(0);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setSelectedItem(null);
  };

  const handleTabChange = (_event, newValue) => {
    setTabIndex(newValue);
  };

  const renderCharts = () => {
    if (!allData.length) return null;

    switch(role) {
      case 'admin': {
        const chartData = [
          { name: 'Students', value: allData.filter(d => d.class).length },
          { name: 'Teachers', value: allData.filter(d => d.subjects).length },
          { name: 'Parents', value: Math.floor(Math.random() * 20 + 10) },
          { name: 'Committee', value: Math.floor(Math.random() * 5 + 1) },
        ];
        return (
          <Box mt={4} sx={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={100} label>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        );
      }
      case 'teacher': {
        const attendanceData = allData.map(s => ({
          name: s.name,
          attendance: s.attendance ?? Math.floor(Math.random()*30 + 70)
        }));
        return (
          <Box mt={4} sx={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="attendance" fill="#388e3c" name="Attendance %" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        );
      }
      case 'student': {
        const classWise = {};
        allData.forEach(s => {
          if(!classWise[s.class]) classWise[s.class] = 0;
          classWise[s.class] += s.marks ?? Math.floor(Math.random()*30 + 70);
        });
        const progressData = Object.keys(classWise).map(cls => ({
          class: cls,
          average: classWise[cls]/allData.filter(s => s.class === cls).length
        }));
        return (
          <Box mt={4} sx={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="class" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="average" stroke="#9c27b0" />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        );
      }
      case 'parent': {
        const childrenData = allData.map(p => ({
          name: p.name,
          childrenCount: p.children?.length ?? 0
        }));
        return (
          <Box mt={4} sx={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={childrenData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="childrenCount" fill="#f57c00" name="Number of Children" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        );
      }
      case 'committee': {
        const tasksData = allData.map(c => ({
          name: c.name,
          tasksCount: c.tasks_count ?? 0
        }));
        return (
          <Box mt={4} sx={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={tasksData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="tasksCount" fill="#6d4c41" name="Number of Tasks" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        );
      }
      default: return null;
    }
  };

  const renderCards = () => (
    <Swiper
      spaceBetween={20}
      slidesPerView={1}
      navigation
      pagination={{ clickable: true }}
      breakpoints={{
        640: { slidesPerView: 1 },
        768: { slidesPerView: 2 },
        1024: { slidesPerView: 3 },
        1280: { slidesPerView: 4 }
      }}
      modules={[Navigation, Pagination]}
    >
      {allData.length > 0 ? allData.map((item, i) => (
        <SwiperSlide key={i}>
          <Card
            sx={{ borderRadius: 2, boxShadow: 3, cursor: 'pointer', transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 } }}
            onClick={() => handleCardClick(item)}
          >
            <CardHeader
              avatar={<Avatar>{roleIcon(role)}</Avatar>}
              title={item.name}
              titleTypographyProps={{ variant: 'h6', textAlign: 'center' }}
            />
            <CardContent>
              {item.class && <Typography>Class: {item.class}</Typography>}
              {item.subjects && <Typography>Subjects: {item.subjects.join(', ')}</Typography>}
              {item.attendance !== undefined && <Typography>Attendance: {item.attendance}%</Typography>}
              {item.children && <Typography>Children: {item.children.map(c => c.name).join(', ')}</Typography>}
              {item.tasks && <Typography>Tasks: {item.tasks.join(', ')}</Typography>}
            </CardContent>
          </Card>
        </SwiperSlide>
      )) : (
        <SwiperSlide>
          <Typography>No {getRoleTitle(role)} data found.</Typography>
        </SwiperSlide>
      )}
    </Swiper>
  );

  const renderHeader = () => {
    const roleTitle = getRoleTitle(role);
    const bgColor = getRoleColor(role);

    return (
      <Paper
        elevation={4}
        sx={{ p: 2, mb: 3, textAlign: "center", background: bgColor, color: "white", borderRadius: 3 }}
      >
        <Typography variant="h4">{roleTitle} Details</Typography>
        <Typography variant="subtitle1">School ID: {id}</Typography>
      </Paper>
    );
  };

  const renderModalContent = () => {
    if (!selectedItem) return null;

    const tabs = [];
    if (selectedItem.class || selectedItem.subjects || selectedItem.attendance !== undefined) tabs.push("Info");
    if (selectedItem.attendance !== undefined) tabs.push("Attendance");
    if (selectedItem.children) tabs.push("Children");
    if (selectedItem.tasks) tabs.push("Tasks");

    return (
      <>
        <Tabs value={tabIndex} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          {tabs.map((t, i) => <Tab key={i} label={t} />)}
        </Tabs>
        <Box mt={2}>
          {tabIndex === tabs.indexOf("Info") && (
            <>
              {selectedItem.class && <Typography>Class: {selectedItem.class}</Typography>}
              {selectedItem.subjects && <Typography>Subjects: {selectedItem.subjects.join(', ')}</Typography>}
            </>
          )}
          {tabIndex === tabs.indexOf("Attendance") && (
            <Typography>Attendance: {selectedItem.attendance}%</Typography>
          )}
          {tabIndex === tabs.indexOf("Children") && (
            <Typography>Children: {selectedItem.children.map(c => c.name).join(', ')}</Typography>
          )}
          {tabIndex === tabs.indexOf("Tasks") && (
            <Typography>Tasks: {selectedItem.tasks.join(', ')}</Typography>
          )}
        </Box>
      </>
    );
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {renderHeader()}
      {renderCards()}
      {renderCharts()}

      <Dialog open={openModal} onClose={handleCloseModal} fullWidth maxWidth="sm">
        <DialogTitle>{selectedItem?.name} Details</DialogTitle>
        <DialogContent dividers sx={{ maxHeight: '400px' }}>
          {renderModalContent()}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RoleDetail;