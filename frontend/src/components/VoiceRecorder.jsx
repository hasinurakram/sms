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
  IconButton,
  Typography,
  LinearProgress,
  Stack,
  Paper,
  Chip
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { useToast } from './Toast';

export default function VoiceRecorder({ open, onClose, onSave }) {
  const navigate = useNavigate();
  const toast = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioURL, setAudioURL] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const [selectedMimeType, setSelectedMimeType] = useState('audio/webm');

  useEffect(() => {
    return () => {
      // Cleanup
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const candidates = [
        'audio/ogg;codecs=opus',
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/webm'
      ];
      const supported = candidates.find((t) => {
        try {
          return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t);
        } catch {
          return false;
        }
      }) || 'audio/webm';
      setSelectedMimeType(supported);

      const options = supported ? { mimeType: supported } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalType = mediaRecorder.mimeType || selectedMimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: finalType });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioURL(audioUrl);
        setAudioBlob(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success('Recording started!');
    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast.error('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      toast.success('Recording stopped!');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      toast.info('Recording paused');
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      // Resume timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      toast.info('Recording resumed');
    }
  };

  const playAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    }
  };

  const deleteRecording = () => {
    setAudioURL(null);
    setAudioBlob(null);
    setRecordingTime(0);
    audioChunksRef.current = [];
    toast.info('Recording deleted');
  };

  const handleSave = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    if (!audioBlob) {
      toast.warning('No recording to save');
      return;
    }

    const t = (audioBlob && audioBlob.type) || selectedMimeType || 'audio/webm';
    const ext = t.includes('ogg') ? 'ogg' : (t.includes('mp4') ? 'm4a' : 'webm');
    const audioFile = new File([audioBlob], `voice_message_${Date.now()}.${ext}`, { type: t });

    onSave(audioFile);
    handleClose();
    toast.success('Voice message saved!');
  };

  const handleClose = () => {
    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }
    
    // Stop playback if active
    if (isPlaying && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    }
    
    // Reset state
    setAudioURL(null);
    setAudioBlob(null);
    setRecordingTime(0);
    setIsRecording(false);
    setIsPaused(false);
    
    onClose();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        🎤 Voice Message Recorder
        <IconButton
          onClick={handleClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ textAlign: 'center', py: 3 }}>
          {/* Recording Status */}
          {isRecording && (
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mb: 2 }}>
                <GraphicEqIcon color="error" sx={{ animation: 'pulse 1s infinite' }} />
                <Typography variant="h6" color="error">
                  {isPaused ? 'PAUSED' : 'RECORDING'}
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontFamily: 'monospace', mb: 2 }}>
                {formatTime(recordingTime)}
              </Typography>
              <LinearProgress 
                color="error" 
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  animation: isPaused ? 'none' : 'pulse 1.5s infinite'
                }} 
              />
            </Box>
          )}

          {/* Audio Player */}
          {audioURL && !isRecording && (
            <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.100' }}>
              <Typography variant="subtitle2" gutterBottom>
                📼 Recorded Message
              </Typography>
              <audio
                ref={audioPlayerRef}
                src={audioURL}
                onEnded={() => setIsPlaying(false)}
                style={{ width: '100%', marginTop: '10px' }}
                controls
              />
              <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
                <Chip 
                  label={`Duration: ${formatTime(recordingTime)}`} 
                  size="small" 
                  color="primary"
                />
              </Stack>
            </Paper>
          )}

          {/* Recording Controls */}
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 2 }}>
            {!isRecording && !audioURL && (
              <Button
                variant="contained"
                size="large"
                startIcon={<MicIcon />}
                onClick={startRecording}
                color="error"
                sx={{ 
                  px: 4, 
                  py: 2,
                  borderRadius: 3,
                  fontSize: '1.1rem'
                }}
              >
                Start Recording
              </Button>
            )}

            {isRecording && !isPaused && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<PauseIcon />}
                  onClick={pauseRecording}
                  size="large"
                >
                  Pause
                </Button>
                <Button
                  variant="contained"
                  startIcon={<StopIcon />}
                  onClick={stopRecording}
                  color="error"
                  size="large"
                >
                  Stop
                </Button>
              </>
            )}

            {isRecording && isPaused && (
              <>
                <Button
                  variant="contained"
                  startIcon={<MicIcon />}
                  onClick={resumeRecording}
                  color="error"
                  size="large"
                >
                  Resume
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<StopIcon />}
                  onClick={stopRecording}
                  size="large"
                >
                  Stop
                </Button>
              </>
            )}

            {audioURL && !isRecording && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<MicIcon />}
                  onClick={() => {
                    deleteRecording();
                    startRecording();
                  }}
                  color="error"
                >
                  Re-record
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DeleteIcon />}
                  onClick={deleteRecording}
                  color="error"
                >
                  Delete
                </Button>
              </>
            )}
          </Stack>

          {/* Instructions */}
          {!isRecording && !audioURL && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Click "Start Recording" to record your voice message.
              <br />
              Maximum duration: 5 minutes
            </Typography>
          )}

          {/* Browser Compatibility Note */}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            ℹ️ Works on Chrome, Firefox, Safari, and Edge
          </Typography>
        </Box>

        {/* CSS for pulse animation */}
        <style>
          {`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}
        </style>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={!audioURL || isRecording}
          startIcon={<MicIcon />}
        >
          Save Voice Message
        </Button>
      </DialogActions>
    </Dialog>
  );
}
