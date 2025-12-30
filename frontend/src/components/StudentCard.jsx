import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, Typography, Box, Avatar, Stack, CardActions } from '@mui/material';
import ProtectedButton from './ProtectedButton';
import { isAuthenticated } from '../utils/auth';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../utils/api';
import { useToast } from './Toast';
import PhotoUpload from './PhotoUpload';

export default function StudentCard({ student, onUploaded, onEdit, onDelete, onClick }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [photoVersion, setPhotoVersion] = useState(0);

  // Display name: first_name + last_name, fallback to username
  const displayName = student.displayName
    || (student.user?.first_name || student.user?.last_name
      ? `${student.user?.first_name || ''} ${student.user?.last_name || ''}`.trim()
      : student.user?.username);

  const className = student.classroom?.name || '';
  const sectionName = student.section?.name || '';
  const guardianName = student.guardian_name
    || (student.guardian ? `${student.guardian.first_name || ''} ${student.guardian.last_name || ''}`.trim() : '');

  const resolvePhotoUrl = (raw) => {
    try {
      const val = typeof raw === 'string' ? raw : (raw || '');
      if (!val) return null;
      if (/^https?:\/\//i.test(val)) return val;
      const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
      const normalized = val.replace(/\\/g, '/');
      if (!normalized || normalized === '/' || normalized === 'media' || normalized === '/media' || normalized === '/media/') return null;
      if (normalized.startsWith('/')) return `${base}${normalized}`;
      // Avoid double /media when backend already returns paths like 'media/...'
      if (/^media\//i.test(normalized)) return `${base}/${normalized}`;
      return `${base}/media/${normalized}`;
    } catch (_) {
      return raw || null;
    }
  };

  const rawPhoto = student.user?.photo_url || student.user?.photo || student.user?.profile_picture || null;
  const photoUrl = resolvePhotoUrl(rawPhoto);
  const cacheBustedPhoto = useMemo(() => {
    if (!photoUrl) return null;
    const sep = photoUrl.includes('?') ? '&' : '?';
    return `${photoUrl}${sep}v=${photoVersion}`;
  }, [photoUrl, photoVersion]);

  const handlePhotoChange = async (file) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!file) return; // removal not supported via endpoint
    const formData = new FormData();
    formData.append('photo', file);
    try {
      await api.post(`/api/academics/students/${student.id}/upload_photo/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Photo uploaded');
      // bump version to bust browser cache immediately
      setPhotoVersion((v) => v + 1);
      onUploaded && onUploaded();
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload photo');
    }
  };

  return (
    <Card 
      sx={{ 
        borderRadius: 2,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: 4
        } : {}
      }}
      onClick={() => onClick && onClick(student)}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Editable photo with camera + device options */}
            <PhotoUpload currentPhoto={cacheBustedPhoto} onPhotoChange={handlePhotoChange} userName={displayName || 'User'} />
            {/* Always-visible small avatar next to name */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Avatar sx={{ width: 36, height: 36 }} src={cacheBustedPhoto || undefined}>{!cacheBustedPhoto ? '🧑' : null}</Avatar>
                <Typography variant="h6">{displayName}</Typography>
              </Stack>
              <Typography variant="body2">রোল: {student.roll_number || 'N/A'}</Typography>
              {className && <Typography variant="body2">শ্রেণী: {className}</Typography>}
              {sectionName && <Typography variant="body2">সেকশন: {sectionName}</Typography>}
              <Typography variant="body2">রক্তের গ্রুপ: {student.blood_group || 'N/A'}</Typography>
              {guardianName && <Typography variant="body2">অভিভাবক: {guardianName}</Typography>}
            </Box>
          </Box>
        </Box>
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
        <ProtectedButton 
          size="small" 
          color="primary" 
          onClick={(e) => {
            e.stopPropagation();
            onEdit && onEdit(student);
          }}
        >
          <EditIcon fontSize="small" />
        </ProtectedButton>
        <ProtectedButton 
          size="small" 
          color="error" 
          onClick={(e) => {
            e.stopPropagation();
            onDelete && onDelete(student);
          }}
        >
          <DeleteIcon fontSize="small" />
        </ProtectedButton>
      </CardActions>
    </Card>
  );
}
