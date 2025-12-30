import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Paper, Button, Stack } from '@mui/material';
import api from '../utils/api';
import { getDashboardStats } from '../services/dashboardService';

export default function DebugPage() {
  const { id } = useParams();
  const [schoolData, setSchoolData] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  const testSchoolAPI = async () => {
    console.log('Testing school API with id:', id);
    setLoading(true);
    setErrors([]);
    
    try {
      const response = await api.get(`/api/schools/${id}/`);
      console.log('School API Response:', response.data);
      setSchoolData(response.data);
    } catch (error) {
      console.error('School API Error:', error);
      setErrors(prev => [...prev, `School API Error: ${error.message}`]);
    }
    
    setLoading(false);
  };

  const testDashboardAPI = async () => {
    console.log('Testing dashboard API with id:', id);
    setLoading(true);
    
    try {
      const data = await getDashboardStats(id);
      console.log('Dashboard API Response:', data);
      setDashboardStats(data);
    } catch (error) {
      console.error('Dashboard API Error:', error);
      setErrors(prev => [...prev, `Dashboard API Error: ${error.message}`]);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    if (id) {
      testSchoolAPI();
      testDashboardAPI();
    }
  }, [id]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Debug Page - School ID: {id}
      </Typography>
      
      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Actions</Typography>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={testSchoolAPI} disabled={loading}>
              Test School API
            </Button>
            <Button variant="contained" onClick={testDashboardAPI} disabled={loading}>
              Test Dashboard API
            </Button>
          </Stack>
        </Paper>

        {errors.length > 0 && (
          <Paper sx={{ p: 3, bgcolor: 'error.light' }}>
            <Typography variant="h6" gutterBottom>Errors:</Typography>
            {errors.map((error, index) => (
              <Typography key={index} color="error">
                {error}
              </Typography>
            ))}
          </Paper>
        )}

        {schoolData && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>School Data:</Typography>
            <pre>{JSON.stringify(schoolData, null, 2)}</pre>
          </Paper>
        )}

        {dashboardStats && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Dashboard Stats:</Typography>
            <pre>{JSON.stringify(dashboardStats, null, 2)}</pre>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}