import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Box, Typography, Grid, Button } from '@mui/material';
import ClassCard from '../components/ClassCard';

export default function ClassesPage(){
  const { id } = useParams();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await api.get(`/api/academics/classrooms/?school=${id}`);

        const raw = Array.isArray(response.data)
          ? response.data
          : (response.data?.results || response.data?.data || []);

        // Normalize student count from various possible backend fields, with fallback API call
        const normalizeOne = async (cls) => {
          const directCount = (
            cls.student_count ??
            cls.students_count ??
            cls.total_students ??
            cls.studentTotal ??
            cls.enrollment_count ??
            cls.enrollments_count ??
            cls.studentNumber ??
            cls.num_students ??
            (Array.isArray(cls.students) ? cls.students.length : undefined)
          );
          if (directCount !== undefined && directCount !== null) {
            return { ...cls, student_count: Number(directCount) || 0 };
          }
          // Fallback: fetch students by classroom to count
          try {
            const sResp = await api.get(`/api/academics/students/?classroom=${cls.id}`);
            let list = [];
            if (Array.isArray(sResp.data)) list = sResp.data;
            else if (sResp.data?.results) list = sResp.data.results;
            else if (sResp.data?.data) list = sResp.data.data;
            return { ...cls, student_count: Number(list.length) || 0 };
          } catch (e) {
            return { ...cls, student_count: 0 };
          }
        };

        const classesWithStudentCount = await Promise.all((raw || []).map(normalizeOne));
        setClasses(classesWithStudentCount);
      } catch (error) {
        console.error('Error fetching classes:', error);
        // Set empty array on error to prevent rendering issues
        setClasses([]);
      }
    };

    fetchClasses();
  }, [id]);

  // Function to get total sections count
  const getTotalSections = () => {
    return classes.reduce((total, cls) => {
      return total + (cls.sections ? cls.sections.length : 0);
    }, 0);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>শ্রেণি ব্যবস্থাপনা</Typography>
          <Typography variant="body1" color="text.secondary">
            আপনার স্কুলের শ্রেণি ও সেকশন পরিচালনা করুন
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          onClick={() => navigate(`/school/${id}/classes/create`)}
          sx={{ height: 'fit-content' }}
        >
          নতুন শ্রেণি যোগ করুন
        </Button>
      </Box>

      <Grid container spacing={3}>
        {classes.map(c => (
          <Grid item xs={12} sm={6} md={4} key={c.id}>
            <ClassCard 
              classroom={{
                ...c,
                // Ensure we have all required fields with fallbacks
                name: c.name || 'নামবিহীন শ্রেণি',
                description: c.description || '',
                student_count: c.student_count || 0,
                sections: c.sections || [],
              }} 
            />
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          📊 মোট শ্রেণি: {classes.length} | মোট সেকশন: {getTotalSections()}
        </Typography>
      </Box>
    </Box>
  );
}
