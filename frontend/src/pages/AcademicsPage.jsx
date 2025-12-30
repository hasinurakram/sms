import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { Box, Typography, Grid, Card, CardContent, CardHeader, Avatar } from '@mui/material';
import ClassIcon from '@mui/icons-material/Class';
import SubjectIcon from '@mui/icons-material/MenuBook';
import SectionIcon from '@mui/icons-material/ViewModule';
import TeacherIcon from '@mui/icons-material/Person';

export default function AcademicsPage() {
  const { id } = useParams(); // school ID
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    // Classes
    api.get(`/api/academics/classrooms/?school=${id}`)
      .then(res => setClasses(res.data))
      .catch(err => console.error(err));

    // Sections
    api.get(`/api/academics/sections/?school=${id}`)
      .then(res => setSections(res.data))
      .catch(err => console.error(err));

    // Subjects
    api.get(`/api/academics/subjects/?school=${id}`)
      .then(res => setSubjects(res.data))
      .catch(err => console.error(err));

    // Teacher Assignments
    api.get(`/api/academics/assignments/?classroom__school=${id}`)
      .then(res => setAssignments(res.data))
      .catch(err => console.error(err));
  }, [id]);

  return (
    <Box sx={{ p:3 }}>
      <Typography variant="h4" mb={3}>Academics Overview</Typography>

      <Grid container spacing={3}>
        {/* Classes */}
        {classes.map(c => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }}  key={c.id}>
            <Card>
              <CardHeader
                avatar={<Avatar><ClassIcon /></Avatar>}
                title={c.name}
                titleTypographyProps={{ variant: 'h6' }}
              />
              <CardContent>
                <Typography>Class: {c.name}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* Sections */}
        {sections.map(s => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }}  key={s.id}>
            <Card>
              <CardHeader
                avatar={<Avatar><SectionIcon /></Avatar>}
                title={s.name}
                titleTypographyProps={{ variant: 'h6' }}
              />
              <CardContent>
                <Typography>Section: {s.name}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* Subjects */}
        {subjects.map(sub => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }}  key={sub.id}>
            <Card>
              <CardHeader
                avatar={<Avatar><SubjectIcon /></Avatar>}
                title={sub.name}
                titleTypographyProps={{ variant: 'h6' }}
              />
              <CardContent>
                <Typography>Subject: {sub.name}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* Teacher Assignments */}
        {assignments.map(a => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }}  key={a.id}>
            <Card>
              <CardHeader
                avatar={<Avatar><TeacherIcon /></Avatar>}
                title={`${a.teacher?.username} - ${a.subject?.name}`}
                titleTypographyProps={{ variant: 'h6' }}
              />
              <CardContent>
                <Typography>Classroom: {a.classroom?.name}</Typography>
                {a.section && <Typography>Section: {a.section.name}</Typography>}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
