import React from 'react';
import { Card, CardContent, Typography, Box, Chip, Stack, Divider } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import ClassIcon from '@mui/icons-material/Class';

export default function ClassCard({ classroom }) {
  // Get sections count if available
  const sectionsCount = classroom.sections?.length || 0;
  
  // Format number in Bengali digits
  const toBengaliNumber = (num) => {
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).replace(/\d/g, digit => bnDigits[digit] || digit);
  };

  // Derive student count robustly from multiple possible sources
  const getStudentCount = (c) => {
    if (!c) return 0;

    const directCandidates = [
      c.student_count,
      c.students_count,
      c.total_students,
      c.studentTotal,
      c.enrollment_count,
      c.enrollments_count,
      c.studentNumber,
      c.num_students,
    ];

    const direct = directCandidates.find(v => v !== undefined && v !== null);
    if (direct !== undefined) return Number(direct) || 0;

    if (Array.isArray(c.students)) return c.students.length;

    if (Array.isArray(c.sections)) {
      return c.sections.reduce((sum, s) => {
        if (s && s.student_count != null) return sum + (Number(s.student_count) || 0);
        if (Array.isArray(s?.students)) return sum + s.students.length;
        return sum;
      }, 0);
    }

    return 0;
  };

  const studentCount = getStudentCount(classroom);
  const studentCountText = studentCount === 0 ? 'কোন শিক্ষার্থী নেই' : `${toBengaliNumber(studentCount)} জন শিক্ষার্থী`;

  return (
    <Card 
      elevation={1}
      sx={{
        borderRadius: 2,
        transition: 'all 0.3s ease',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3,
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ mb: 1.5 }}>
          <Typography 
            variant="h6" 
            component="h3" 
            sx={{ 
              fontWeight: 600,
              mb: 0.5,
              color: 'primary.main',
              fontSize: '1.1rem'
            }}
          >
            {classroom.name}
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}
          >
            <PeopleIcon fontSize="small" color="primary" sx={{ fontSize: '1rem' }} />
            {studentCountText}
          </Typography>
        </Box>
        
        {classroom.description && (
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mb: 1.5,
              fontStyle: 'italic',
              fontSize: '0.8rem'
            }}
          >
            {classroom.description}
          </Typography>
        )}
        
        <Divider sx={{ my: 1.5 }} />
        
        <Box sx={{ mt: 'auto' }}>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Chip
                icon={<ClassIcon fontSize="small" />}
                label={`${toBengaliNumber(sectionsCount)}টি বিভাগ`}
                size="small"
                color="secondary"
                variant="outlined"
                sx={{ 
                  fontWeight: 500,
                  '& .MuiChip-label': {
                    paddingLeft: '4px',
                    paddingRight: '4px',
                  }
                }}
              />
              
              <Chip
                icon={<PeopleIcon fontSize="small" />}
                label={`মোট ${toBengaliNumber(studentCount)} জন`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ 
                  fontWeight: 500,
                  '& .MuiChip-label': {
                    paddingLeft: '4px',
                    paddingRight: '4px',
                  }
                }}
              />
            </Box>
            
            {sectionsCount === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                এখনো কোন বিভাগ যোগ করা হয়নি
              </Typography>
            )}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
