import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Stack, Button, Grid, Alert, Chip, Divider, Table, TableHead, TableRow, TableCell, TableBody, Avatar, IconButton, Tooltip } from '@mui/material';
import { Send, DeleteSweep, Psychology, Person, SmartToy, AutoAwesome } from '@mui/icons-material';
import api from '../utils/api';

const SoftwareAssistant = () => {
  const { id } = useParams();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAsk = async () => {
    if (!q.trim()) return;
    const userQuery = q;
    setQ('');
    setLoading(true);
    setError('');
    
    // Add user message to UI immediately
    const userMsg = { role: 'user', content: userQuery, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await api.post('/api/users/assistant/chat/', {
        q: userQuery,
        school: id || undefined,
        session_id: sessionId
      });
      
      const data = res.data;
      if (data.session_id) setSessionId(data.session_id);
      
      const assistantMsg = { 
        role: 'assistant', 
        content: data.text, 
        timestamp: new Date().toISOString(),
        extra: data // Store extra data like users_list or results
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'অনুরোধ ব্যর্থ হয়েছে';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setSessionId(null);
    setQ('');
    setError('');
  };

  const renderExtraData = (extra) => {
    if (!extra) return null;
    const items = [];
    
    // Results Topper
    if (extra.topper) {
      items.push(
        <Stack key="topper" direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
          <Chip size="small" label={`টপার: ${extra.topper.name || ''}`} color="primary" variant="outlined" />
          <Chip size="small" label={`GPA: ${extra.topper.gpa}`} variant="outlined" />
        </Stack>
      );
    }

    // Attendance
    if (typeof extra.present === 'number' || typeof extra.absent === 'number') {
      items.push(
        <Stack key="attendance" direction="row" spacing={1} sx={{ mt: 1 }}>
          <Chip size="small" label={`উপস্থিত: ${extra.present}`} color="success" />
          <Chip size="small" label={`অনুপস্থিত: ${extra.absent}`} color="error" />
        </Stack>
      );
    }

    // Blood Group List
    if (Array.isArray(extra.users_list) && extra.users_list.length > 0) {
      items.push(
        <Box key="users_list_table" sx={{ mt: 2, overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 300, border: '1px solid #eee' }}>
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>নাম</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>পদবী</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>মোবাইল</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {extra.users_list.slice(0, 10).map((u, idx) => (
                <TableRow key={idx}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.role}</TableCell>
                  <TableCell align="right">{u.phone || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {extra.users_list.length > 10 && (
            <Typography variant="caption" color="textSecondary">...এবং আরও {extra.users_list.length - 10} জন</Typography>
          )}
        </Box>
      );
    }

    return items.length > 0 ? <Box sx={{ mt: 1 }}>{items}</Box> : null;
  };

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', p: { xs: 1, sm: 2 } }}>
      <Paper elevation={3} sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 3 }}>
        {/* Header */}
        <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AutoAwesome sx={{ fontSize: 28 }} />
            <Box>
              <Typography variant="h6" sx={{ lineHeight: 1.2 }}>শক্তিশালী এআই অ্যাসিস্ট্যান্ট</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>যেকোনো প্রশ্ন করুন (বাংলা/English)</Typography>
            </Box>
          </Stack>
          <Tooltip title="নতুন চ্যাট শুরু করুন">
            <IconButton onClick={resetChat} sx={{ color: 'white' }}>
              <DeleteSweep />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Chat Area */}
        <Box 
          ref={scrollRef}
          sx={{ 
            flex: 1, 
            overflowY: 'auto', 
            p: 2, 
            bgcolor: '#f8f9fa',
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
        >
          {messages.length === 0 && (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
              <Psychology sx={{ fontSize: 80, mb: 2, color: 'primary.light' }} />
              <Typography variant="h6">আমি আপনাকে কীভাবে সাহায্য করতে পারি?</Typography>
              <Typography variant="body2" textAlign="center">
                উদাহরণ: "রোল ৫ এর রেজাল্ট কি?", "A+ রক্তের গ্রুপ কার কার?", "আজকের উপস্থিতি কত?"
              </Typography>
            </Box>
          )}
          
          {messages.map((m, i) => (
            <Box 
              key={i} 
              sx={{ 
                display: 'flex', 
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 1
              }}
            >
              <Avatar sx={{ bgcolor: m.role === 'user' ? 'secondary.main' : 'primary.main', width: 32, height: 32 }}>
                {m.role === 'user' ? <Person fontSize="small" /> : <SmartToy fontSize="small" />}
              </Avatar>
              <Box sx={{ maxWidth: '80%' }}>
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: 1.5, 
                    borderRadius: m.role === 'user' ? '15px 2px 15px 15px' : '2px 15px 15px 15px',
                    bgcolor: m.role === 'user' ? 'primary.light' : 'white',
                    color: m.role === 'user' ? 'white' : 'text.primary'
                  }}
                >
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{m.content}</Typography>
                  {m.extra && renderExtraData(m.extra)}
                </Paper>
                <Typography variant="caption" sx={{ mt: 0.5, display: 'block', textAlign: m.role === 'user' ? 'right' : 'left', opacity: 0.6 }}>
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
            </Box>
          ))}
          {loading && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                <SmartToy fontSize="small" />
              </Avatar>
              <Paper elevation={1} sx={{ p: 1.5, borderRadius: '2px 15px 15px 15px', bgcolor: 'white' }}>
                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>চিন্তা করছি...</Typography>
              </Paper>
            </Box>
          )}
          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
        </Box>

        {/* Input Area */}
        <Divider />
        <Box sx={{ p: 2, bgcolor: 'white' }}>
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="আপনার প্রশ্ন এখানে লিখুন..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            />
            <Button 
              variant="contained" 
              onClick={handleAsk} 
              disabled={loading || !q.trim()}
              sx={{ borderRadius: 3, minWidth: 60, height: 56 }}
            >
              <Send />
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
};

export default SoftwareAssistant;
