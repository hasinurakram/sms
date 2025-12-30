import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { Box, Typography, Button, TextField } from '@mui/material';
import AttendanceGrid from '../components/AttendanceGrid';
import dayjs from 'dayjs';

export default function AttendancePage(){
  const { id } = useParams();
  const [students, setStudents] = useState([]);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));

  useEffect(()=>{
    api.get(`/api/academics/students/?school=${id}`)
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
      .catch(err => console.error(err));
  }, [id]);

  const saveAttendance = (records) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    // records = [{ student: studentId, date, present, school }]
    const promises = records.map(r => api.post(`/api/attendance/records/`, r));
    Promise.all(promises).then(()=> alert('Attendance saved')).catch(err => { console.error(err); alert('Error saving');});
  };

  return (
    <Box sx={{ p:3 }}>
      <Typography variant="h4" mb={2}>Attendance</Typography>
      <TextField type="date" value={date} onChange={e => setDate(e.target.value)} sx={{ mb:2 }} />
      <AttendanceGrid students={students} date={date} schoolId={id} onSave={saveAttendance} />
    </Box>
  );
}
