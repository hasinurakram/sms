import React, { useState } from 'react';
import { Box, Button, Typography, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const roles = [
  { key: 'admin', label: 'Admin' },
  { key: 'teacher', label: 'Teacher' },
  { key: 'student', label: 'Student' },
  { key: 'parent', label: 'Parent' },
  { key: 'committee', label: 'Committee' }
];

const RoleSelection = ({ schoolId }) => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(null);

  const handleSelect = (role) => {
    setSelectedRole(role);
    // Standard route: /school/:id/:role
    navigate(`/school/${schoolId}/${role}`);
  };

  return (
    <Box sx={{ mt: 5, textAlign: 'center' }}>
      <Typography variant="h5" mb={3}>Select Your Role</Typography>
      <Grid container spacing={2} justifyContent="center">
        {roles.map(role => (
          <Grid key={role.key}>
            <Button
              variant={selectedRole === role.key ? "contained" : "outlined"}
              color="primary"
              onClick={() => handleSelect(role.key)}
              sx={{ minWidth: 120 }}
            >
              {role.label}
            </Button>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default RoleSelection;