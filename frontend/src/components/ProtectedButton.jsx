import React from 'react';
import { IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import { useAuth } from '../context/AuthContext';

const ProtectedButton = ({ children, onClick, ...props }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleClick = (e) => {
    if (!(isAuthenticated() || !!user)) {
      e.preventDefault();
      navigate('/login');
      return;
    }
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <IconButton onClick={handleClick} {...props}>
      {children}
    </IconButton>
  );
};

export default ProtectedButton;
