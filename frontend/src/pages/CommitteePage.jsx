import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import api from '../utils/api';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  Button,
  TextField,
  InputAdornment,
  Fade,
  Chip
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EmptyState from '../components/EmptyState';
import ProfileCard from '../components/ProfileCard';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';

export default function CommitteePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [committee, setCommittee] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const toast = useToast();
  
  const loadCommittee = () => {
    if (!id) return;
    setLoading(true);
    api.get(`/api/users/committees/?school=${id}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setCommittee(data);
        setLoading(false);
        if (data.length > 0) {
          toast.success(`Loaded ${data.length} committee members successfully`);
        }
      })
      .catch(err => {
        console.error(err);
        toast.error('Failed to load committee members');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadCommittee();
  }, [id]);

  const filtered = committee.filter(p => {
    const user = p.user || {};
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim().toLowerCase() || (user.username || '').toLowerCase();
    const designation = (p.designation || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || designation.includes(searchQuery.toLowerCase());
  });

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <Fade in timeout={500}>
        <Paper 
          elevation={0}
          sx={{ 
            mb: 3, 
            p: 3, 
            background: 'linear-gradient(135deg, #6B73FF 0%, #000DFF 100%)',
            color: 'white',
            borderRadius: 3
          }}
        >
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            alignItems={{ xs: 'stretch', sm: 'center' }} 
            justifyContent="space-between" 
            spacing={2}
          >
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center' }}>
                <GroupsIcon sx={{ mr: 1, fontSize: 40 }} />
                Committee Management
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Manage school committee members and their roles
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
                School ID: {id} | Total Members: {committee.length}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button 
                variant="contained" 
                startIcon={<AddIcon />} 
                onClick={() => {
                  if (!isAuthenticated()) {
                    navigate('/login');
                    return;
                  }
                  navigate(`/dashboard/${id}/add-committee`);
                }}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                  backdropFilter: 'blur(10px)'
                }}
              >
                Add Member
              </Button>
              <Button 
                variant="outlined" 
                startIcon={<RefreshIcon />} 
                onClick={loadCommittee}
                sx={{ 
                  borderColor: 'rgba(255,255,255,0.5)', 
                  color: 'white',
                  '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
                }}
              >
                Refresh
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Fade>

      {/* Search Bar */}
      <Paper elevation={2} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <TextField
          fullWidth
          placeholder="Search committee members by name, username or designation..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            }
          }}
        />
      </Paper>

      {loading && (
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}  key={i}>
              <CardSkeleton />
            </Grid>
          ))}
        </Grid>
      )}

      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={<GroupsIcon sx={{ fontSize: 60 }} />}
          title="No Committee Members Found"
          description={
            searchQuery 
              ? "No members match your search criteria. Try a different search term."
              : "There are no committee members added yet. Click 'Add Member' to create one."
          }
          actionText="Add Committee Member"
          onAction={() => navigate(`/school/${id}/committee/add`)}
        />
      )}

      {!loading && filtered.length > 0 && (
        <Grid container spacing={2}>
          {filtered.map(member => {
            // Ensure user data is properly extracted
            const profile = member;
            const user = member.user || member;
            
            // Create a custom profile object with designation
            const committeeProfile = {
              ...profile,
              user: {
                ...user,
                // Ensure photo URL is properly handled
                photo: user.photo || profile.photo || user.photo_url || profile.photo_url
              },
              role: profile.designation || 'Committee Member'
            };
            
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={member.id || `committee-${member.user?.id}`}>
                <ProfileCard
                  profile={committeeProfile}
                  onUpdate={loadCommittee}
                  apiEndpoint={`/api/users/committees/${member.id}/`}
                  showRole={true}
                  showDesignation={true}
                  showActions={true}
                  showDelete={true}
                  elevation={2}
                />
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}