import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Box, Typography, Paper, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid } from '@mui/material';

export default function GroupsPage(){
  const [groups, setGroups] = useState([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const load = () => {
    api.get('/api/users/groups/')
      .then(r => setGroups(Array.isArray(r.data) ? r.data : r.data.results || []))
      .catch(console.error);
  };
  useEffect(()=>{ load(); }, []);

  const create = async () => {
    await api.post('/api/users/groups/', { name });
    setOpen(false); setName(''); load();
  };

  return (
    <Box sx={{ p:3 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb:2 }}>
        <Typography variant="h4">Groups</Typography>
        <Button variant="contained" onClick={()=>setOpen(true)}>Add Group</Button>
      </Stack>
      <Grid container spacing={2}>
        {groups.map(g => (
          <Grid key={g.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Paper sx={{ p:2, borderRadius: 2 }}>
              <Typography variant="h6">{g.name}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={()=>setOpen(false)}>
        <DialogTitle>Add Group</DialogTitle>
        <DialogContent>
          <TextField label="Name" value={name} onChange={e=>setName(e.target.value)} fullWidth sx={{ mt:1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={create}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


