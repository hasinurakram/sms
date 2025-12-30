import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { Box, Typography, TextField, Grid, Paper } from '@mui/material';

export default function AttendanceRecordsPage(){
  const { id } = useParams();
  const [date, setDate] = useState('');
  const [records, setRecords] = useState([]);

  const load = () => {
    const params = new URLSearchParams();
    if (id) params.append('school', id);
    if (date) params.append('date', date);
    api.get(`/api/attendance/records/?${params.toString()}`)
      .then(r => setRecords(r.data))
      .catch(console.error);
  };

  useEffect(()=>{ load(); }, [id, date]);

  return (
    <Box sx={{ p:3 }}>
      <Typography variant="h4" mb={2}>Attendance Records</Typography>
      <TextField type="date" label="Filter by date" value={date} onChange={e=>setDate(e.target.value)} sx={{ mb:2 }} InputLabelProps={{ shrink: true }} />
      <Grid container spacing={2}>
        {records.map(rec => (
          <Grid key={rec.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Paper sx={{ p:2, borderRadius: 2 }}>
              <Typography variant="subtitle1">{rec.student_name || `Student #${rec.student}`}</Typography>
              <Typography variant="body2" color="text.secondary">{rec.date} — {rec.present ? 'Present' : 'Absent'}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}


