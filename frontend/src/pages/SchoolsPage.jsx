import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Box, Typography, Grid, Card, CardContent, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { useToast } from '../components/Toast';

export default function SchoolsPage(){
  const toast = useToast();
  const [schools, setSchools] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', address: '' });

  useEffect(()=>{
    api.get('/api/schools/')
      .then(res => setSchools(Array.isArray(res.data) ? res.data : res.data.results || []))
      .catch(console.error);
  }, []);

  return (
    <Box sx={{ p:3 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb:2 }}>
        <Typography variant="h4">Schools</Typography>
        <Button variant="contained" onClick={()=>{ setEditing(null); setForm({ name: '', address: '' }); setOpen(true); }}>Add School</Button>
      </Stack>
      <Grid container spacing={2}>
        {schools.map(s => (
          <Grid key={s.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6">{s.name}</Typography>
                {s.address && <Typography variant="body2">{s.address}</Typography>}
                <Stack direction="row" spacing={1} sx={{ mt:1 }}>
                  <Button size="small" variant="outlined" onClick={()=>{ setEditing(s); setForm({ name: s.name || '', address: s.address || '' }); setOpen(true); }}>Edit</Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={()=>setOpen(false)}>
        <DialogTitle>{editing ? 'Edit School' : 'Add School'}</DialogTitle>
        <DialogContent>
          <TextField label="Name" fullWidth sx={{ mt:1 }} value={form.name} onChange={e=>setForm({ ...form, name: e.target.value })} />
          <TextField label="Address" fullWidth sx={{ mt:2 }} value={form.address} onChange={e=>setForm({ ...form, address: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={async ()=>{
            try {
              if (editing) {
                await api.patch(`/api/schools/${editing.id}/`, form);
                toast.success('School updated successfully');
              } else {
                await api.post('/api/schools/', form);
                toast.success('School added successfully');
              }
              setOpen(false);
              const r = await api.get('/api/schools/');
              setSchools(Array.isArray(r.data) ? r.data : r.data.results || []);
            } catch (error) {
              console.error('Error saving school:', error);
              const errorMsg = error.response?.data?.detail || error.response?.data?.message || 'Failed to save school. Please check all required fields.';
              toast.error(errorMsg);
            }
          }}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


