import React from 'react';
import { AppBar, Toolbar, Typography, Button } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';

const Navbar = ({ role }) => {
  const navigate = useNavigate();
  const { id: schoolId } = useParams();
  
  const handleNavigation = (item) => {
    const pathMap = {
      'ড্যাশবোর্ড': '',
      'শিক্ষক': 'teacher',
      'ছাত্র-ছাত্রী': 'student',
      'অভিভাবক': 'parent',
      'কমিটি': 'committee',
      'প্রবেশপত্র': 'admission-cards',
      'আমার শ্রেণি': 'classes',
      'হাজিরা': 'attendance',
      'প্রোফাইল': 'profile',
      'আমার সন্তান': 'parent/dashboard',
      'স্কুল তথ্য': 'schools'
    };
    
    const path = pathMap[item];
    if (path) {
      navigate(`/school/${schoolId}/${path}`);
    }
  };
  let menuItems = [];

  switch(role) {
    case 'Admin':
      menuItems = ['ড্যাশবোর্ড', 'শিক্ষক', 'ছাত্র-ছাত্রী', 'অভিভাবক', 'কমিটি', 'প্রবেশপত্র'];
      break;
    case 'Teacher':
      menuItems = ['ড্যাশবোর্ড', 'আমার শ্রেণি', 'হাজিরা', 'প্রোফাইল'];
      break;
    case 'Student':
      menuItems = ['ড্যাশবোর্ড', 'আমার শ্রেণি', 'প্রোফাইল'];
      break;
    case 'Parent':
      menuItems = ['ড্যাশবোর্ড', 'আমার সন্তান', 'প্রোফাইল'];
      break;
    case 'Committee':
      menuItems = ['ড্যাশবোর্ড', 'স্কুল তথ্য', 'প্রোফাইল'];
      break;
    default:
      menuItems = [];
  }

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {role} মেনু
        </Typography>
        {menuItems.map(item => (
          <Button 
            key={item} 
            color="inherit"
            onClick={() => handleNavigation(item)}
            sx={{ 
              mx: 0.5,
              '&:hover': { 
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                transform: 'translateY(-1px)'
              },
              transition: 'all 0.2s'
            }}
          >
            {item}
          </Button>
        ))}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
