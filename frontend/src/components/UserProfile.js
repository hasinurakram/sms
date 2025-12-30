import React from 'react';
import { Box, Typography, TextField, Button } from '@mui/material';

const UserProfile = ({ user, isLoggedIn }) => {

  const handleEdit = () => {
    if (!isLoggedIn) {
      alert('Please login first!');
      window.location.href = '/login';
    }
  };

  return (
    <Box sx={{ mt: 3, mx: 3 }}>
      <Typography variant="h5">Profile: {user.name}</Typography>
      <TextField label="Name" value={user.name} fullWidth sx={{ my: 2 }} disabled={!isLoggedIn} />
      <TextField label="Email" value={user.email} fullWidth sx={{ my: 2 }} disabled={!isLoggedIn} />
      <TextField label="Phone" value={user.phone} fullWidth sx={{ my: 2 }} disabled={!isLoggedIn} />
      <Button variant="contained" onClick={handleEdit}>Edit Profile</Button>
    </Box>
  );
};

export default UserProfile;
