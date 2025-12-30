import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Container,
  Paper
} from '@mui/material';
import TeacherCard from '../components/TeacherCard';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import EmptyState from '../components/EmptyState';
import { CardSkeleton } from '../components/LoadingSkeleton';
import PersonIcon from '@mui/icons-material/Person';

export default function TeacherCardsPage() {
  const { id } = useParams(); // School ID
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    loadTeachers();
  }, [id]);

  const loadTeachers = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // Get teacher assignments for this school
      const res = await api.get(`/api/academics/assignments/?classroom__school=${id}`);
      
      // Extract unique teachers with their subjects
      const teacherMap = {};
      res.data.forEach(assignment => {
        if (!assignment.teacher) return;
        
        const teacherId = assignment.teacher.id;
        if (!teacherMap[teacherId]) {
          // Use the teacher data directly from the assignment
          const teacherData = {
            ...assignment.teacher,
            subject: assignment.subject
          };
          
          // Debug: Log what we're getting from the API
          console.log('Assignment teacher data:', {
            id: assignment.teacher.id,
            name: `${assignment.teacher.first_name} ${assignment.teacher.last_name}`,
            photo_url: assignment.teacher.photo_url,
            photo: assignment.teacher.photo,
            phone_number: assignment.teacher.phone_number,
            mobile_number: assignment.teacher.mobile_number
          });
          
          teacherMap[teacherId] = teacherData;
        }
      });
      
      const teacherList = Object.values(teacherMap);
      console.log('Total unique teachers:', teacherList.length);
      setTeachers(teacherList);
    } catch (error) {
      console.error('Failed to load teachers:', error);
      toast.error('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold' }}>
          Teacher Cards
        </Typography>

        <Paper sx={{ p: 3, borderRadius: 2 }}>
          {loading ? (
            <CardSkeleton count={4} />
          ) : teachers.length === 0 ? (
            <EmptyState
              icon={PersonIcon}
              title="No Teachers Found"
              message="There are no teachers assigned to this school yet."
            />
          ) : (
            <Grid container spacing={3}>
              {teachers.map((teacher) => (
                <Grid item xs={12} sm={6} md={4} key={teacher.id}>
                  <TeacherCard teacher={teacher} onPhotoUploaded={loadTeachers} />
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      </Box>
    </Container>
  );
}