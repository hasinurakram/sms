import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Stack,
  IconButton,
  Typography,
  Paper
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CloseIcon from '@mui/icons-material/Close';
import { useToast } from './Toast';

export default function PhotoUpload({ currentPhoto, onPhotoChange, userName = 'User' }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preview, setPreview] = useState(currentPhoto || null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [stream, setStream] = useState(null);
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Keep preview in sync with currentPhoto prop
  useEffect(() => {
    if (!open) {
      setPreview(currentPhoto || null);
    }
  }, [currentPhoto, open]);

  // Open camera
  const handleOpenCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' },
        audio: false 
      });
      setStream(mediaStream);
      setCameraOpen(true);
      
      // Wait for video element to be ready
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
      
      toast.info('Camera opened. Click "Capture Photo" to take picture.');
    } catch (err) {
      console.error('Camera error:', err);
      toast.error('Failed to access camera. Please check permissions.');
    }
  };

  // Capture photo from camera
  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
        setSelectedFile(file);
        setPreview(URL.createObjectURL(blob));
        handleCloseCamera();
        toast.success('Photo captured successfully!');
      }
    }, 'image/jpeg', 0.9);
  };

  // Close camera
  const handleCloseCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraOpen(false);
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size must be less than 5MB');
        return;
      }

      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      toast.success('Photo selected successfully!');
    }
  };

  // Upload photo
  const handleUpload = () => {
    if (!selectedFile) {
      toast.warning('Please select or capture a photo first');
      return;
    }

    onPhotoChange(selectedFile);
    setOpen(false);
    toast.success('Photo uploaded successfully!');
  };

  // Remove photo
  const handleRemove = () => {
    setSelectedFile(null);
    setPreview(null);
    onPhotoChange(null);
    toast.info('Photo removed');
  };

  // Open dialog
  const handleOpen = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setOpen(true);
    setPreview(currentPhoto);
  };

  // Close dialog
  const handleClose = () => {
    setOpen(false);
    handleCloseCamera();
    setSelectedFile(null);
    setPreview(currentPhoto);
  };

  return (
    <>
      {/* Photo Display with Upload Button */}
      <Box sx={{ textAlign: 'center' }}>
        <Box sx={{ position: 'relative', display: 'inline-block' }}>
          <Avatar
            src={preview || undefined}
            sx={{ 
              width: 120, 
              height: 120, 
              fontSize: '3rem',
              bgcolor: preview ? 'primary.main' : 'grey.200',
              color: preview ? 'inherit' : 'grey.700',
              border: '4px solid',
              borderColor: 'background.paper',
              boxShadow: 3
            }}
          >
            {!preview ? '🧑' : null}
          </Avatar>
          
          <IconButton
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': { bgcolor: 'primary.dark' },
              boxShadow: 2
            }}
            onClick={handleOpen}
          >
            <PhotoCameraIcon />
          </IconButton>
        </Box>
        
        <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
          Click camera icon to upload photo
        </Typography>
      </Box>

      {/* Upload Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          Upload Photo
          <IconButton
            onClick={handleClose}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {/* Camera View */}
          {cameraOpen ? (
            <Box sx={{ textAlign: 'center' }}>
              <Paper sx={{ p: 2, bgcolor: 'black', position: 'relative' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', maxHeight: '400px', borderRadius: '8px' }}
                />
              </Paper>
              
              <Stack direction="row" spacing={2} sx={{ mt: 2 }} justifyContent="center">
                <Button
                  variant="contained"
                  startIcon={<CameraAltIcon />}
                  onClick={handleCapturePhoto}
                  size="large"
                >
                  Capture Photo
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleCloseCamera}
                >
                  Cancel
                </Button>
              </Stack>
            </Box>
          ) : (
            <>
              {/* Preview */}
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Avatar
                  src={preview || undefined}
                  sx={{ 
                    width: 200, 
                    height: 200, 
                    fontSize: '5rem',
                    mx: 'auto',
                    bgcolor: preview ? 'grey.300' : 'grey.100',
                    color: 'grey.600'
                  }}
                >
                  {!preview ? '🧑' : null}
                </Avatar>
              </Box>

              {/* Upload Options */}
              <Stack spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<CameraAltIcon />}
                  onClick={handleOpenCamera}
                  fullWidth
                  size="large"
                >
                  Open Camera
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<UploadFileIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  fullWidth
                  size="large"
                >
                  Choose from Device
                </Button>

                {preview && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleRemove}
                    fullWidth
                  >
                    Remove Photo
                  </Button>
                )}
              </Stack>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              <Typography variant="caption" display="block" sx={{ mt: 2, textAlign: 'center', color: 'text.secondary' }}>
                Supported formats: JPG, PNG, GIF (Max 5MB)
              </Typography>
            </>
          )}

          {/* Hidden canvas for photo capture */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </DialogContent>

        {!cameraOpen && (
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button 
              onClick={handleUpload} 
              variant="contained"
              disabled={!selectedFile}
            >
              Upload
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </>
  );
}
