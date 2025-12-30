import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  Alert,
  Collapse
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import api from '../utils/api';
import { useToast } from './Toast';
import { isAuthenticated } from '../utils/auth';
import { useNavigate } from 'react-router-dom';

export default function ImportDialog({ open, onClose, schoolId, onComplete }) {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const toast = useToast();

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
    setResult(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!file || !schoolId) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('school', schoolId);
      const res = await api.post(`/api/academics/imports/students/?school=${schoolId}`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setResult(res.data);
      setShowErrors(false);
      toast.success(`Import successful! Created: ${res.data.created}, Updated: ${res.data.updated}`);
      if (onComplete) onComplete(res.data);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Import failed';
      setError(msg);
      toast.error(`Import failed: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = ['username','first_name','last_name','password','classroom','section','roll_number','parent'];
    const csv = [headers.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import Students</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Supported: CSV, XLSX, DOCX, PDF, PNG/JPG. Recommended: CSV with headers
          <code> username, first_name, last_name, password, classroom, section, roll_number, parent</code>.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
          <Button variant="outlined" onClick={handleDownloadTemplate}>Download CSV template</Button>
        </Box>

        <Box sx={{
          border: '1px dashed #999',
          borderRadius: 2,
          p: 2,
          textAlign: 'center',
          bgcolor: '#fafafa'
        }}>
          <UploadFileIcon sx={{ fontSize: 40, mb: 1, color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ mb: 1 }}>Choose a file to upload</Typography>
          <input
            type="file"
            accept=".csv,.docx,.pdf,image/*"
            onChange={handleFileChange}
          />
          {file && (
            <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
              Selected: {file.name}
            </Typography>
          )}
        </Box>

        {submitting && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="caption">Uploading and processing...</Typography>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {result && (
          <Box sx={{ mt: 2 }}>
            <Alert severity={result.errors?.length ? 'warning' : 'success'}>
              Import complete — Created: {result.created}, Updated: {result.updated}. {result.errors?.length ? `${result.errors.length} errors` : 'No errors'}.
            </Alert>
            {!!(result.errors?.length) && (
              <Box sx={{ mt: 1 }}>
                <Button size="small" onClick={() => setShowErrors(v => !v)}>
                  {showErrors ? 'Hide errors' : 'Show errors'}
                </Button>
                <Collapse in={showErrors}>
                  <Box sx={{ mt: 1, maxHeight: 200, overflow: 'auto', p: 1, bgcolor: '#fafafa', borderRadius: 1 }}>
                    {result.errors.map((e, i) => (
                      <Typography key={i} variant="caption" display="block">
                        Row {e.row}: {e.error}
                      </Typography>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Close</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!file || submitting || !schoolId}>Import</Button>
      </DialogActions>
    </Dialog>
  );
}
