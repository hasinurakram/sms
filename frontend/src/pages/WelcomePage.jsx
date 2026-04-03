import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Card, CardContent, CardHeader, Avatar, Autocomplete, TextField, CardMedia, Button, Stack, Paper } from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import SchoolCarousel from "../components/SchoolCarousel";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import fallbackLogo from "../components/fallback_logo.png";
import logo from "../components/bdapp_logo.png";
import welcomeBg from "../components/welcome_bg.jpg";

const AdSlot = ({ items, getMediaUrl, slotIndex = 0 }) => {
  const [idx, setIdx] = useState(0);
  const timerRef = React.useRef(null);
  
  // Initialize index based on slotIndex to show variety immediately
  useEffect(() => { 
    if (items && items.length > 0) {
      setIdx(slotIndex % items.length);
    }
  }, [items?.length, slotIndex]);

  useEffect(() => {
    if (!items || items.length <= 1) return;
    const current = items[Math.min(idx, items.length - 1)];
    
    // If it's a video, the onEnded event will handle the rotation
    if (current?.type === 'video') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    
    // For images, use a timer
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
    }, 5000 + (slotIndex * 1000));
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [items, idx, slotIndex]);

  if (!items || items.length === 0) return null;
  const ad = items[Math.min(idx, items.length - 1)];
  const mediaUrl = getMediaUrl(ad.media_url || ad.media);
  
  return (
    <Card 
      sx={{ 
        width: { xs: 260, sm: 350 }, 
        height: { xs: 140, sm: 180 }, 
        borderRadius: 3, 
        boxShadow: 6,
        cursor: ad.link ? 'pointer' : 'default', 
        flexShrink: 0,
        transition: '0.3s',
        '&:hover': { transform: 'scale(1.02)', boxShadow: 10 }
      }}
      onClick={() => ad.link && window.open(ad.link, '_blank')}
    >
      <CardMedia
        key={mediaUrl}
        component={ad.type === 'video' ? 'video' : 'img'}
        src={mediaUrl}
        title={ad.text || 'Advertisement'}
        autoPlay={ad.type === 'video'}
        muted={ad.type === 'video'}
        playsInline={ad.type === 'video'}
        onEnded={() => {
          if (ad.type === 'video') {
            setIdx((i) => (i + 1) % items.length);
          }
        }}
        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </Card>
  );
};

const WelcomePage = () => {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [ads, setAds] = useState([]);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const filteredAds = React.useMemo(() => {
    if (!ads || ads.length === 0) return [];
    const seenMedia = new Set();
    const uniqueAds = ads.filter(ad => {
      const media = ad.media_url || ad.media;
      if (!media || seenMedia.has(media)) return false;
      seenMedia.add(media);
      return true;
    });
    // Shuffle unique ads to ensure variety across slots
    return [...uniqueAds].sort(() => Math.random() - 0.5);
  }, [ads]);

  const getMediaUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    
    // In development with CRA proxy, media is served by the backend
    // but the request goes through the proxy (localhost:3000).
    // If the path is relative, we should point to the backend host directly.
    const backendUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
    return `${backendUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  useEffect(() => {}, [navigate]);

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const response = await api.get("/api/schools/", { params: { _t: Date.now() }, timeout: 15000 });
        const list = Array.isArray(response.data)
          ? response.data
          : (response.data?.results || response.data?.data || []);
        const schoolsWithImg = (list || []).map((school) => ({
          ...school,
          logo: school?.logo || school?.img || '',
          img: school?.logo || school?.img || fallbackLogo
        }));
        setSchools(schoolsWithImg);
        setLoadError('');
      } catch (err) {
        console.error("Error fetching schools:", err);
        setSchools([]);
        const status = err?.response?.status;
        if (status) {
          setLoadError(`সার্ভার রেসপন্স কোড: ${status} — ব্যাকএন্ড পরীক্ষা করুন`);
        } else {
          setLoadError('ব্যাকএন্ডে সংযোগ পাওয়া যাচ্ছে না — সার্ভার/নেটওয়ার্ক দেখুন');
        }
      } finally {
        setLoading(false);
      }
    };

    const fetchAds = async () => {
      try {
        const response = await api.get("/api/v1/ads/", { params: { _t: Date.now() } });
        const list = Array.isArray(response.data)
          ? response.data
          : (response.data?.results || response.data?.data || []);
        
        console.log('Fetched ads list:', list);
        
        // Final fallback to /api/ads/ if v1 returns empty list but results exists (it was successful but empty)
        // or if v1 failed to return results at all.
        if (list.length === 0) {
           console.log('v1 ads empty, trying fallback...');
           const fallback = await api.get("/api/ads/", { params: { _t: Date.now() } });
           const fallbackList = Array.isArray(fallback.data) ? fallback.data : (fallback.data?.results || []);
           setAds(fallbackList);
        } else {
           setAds(list);
        }
      } catch (err) {
        console.error("Error fetching global ads:", err);
        // Retry with legacy path on error
        try {
          const fallback = await api.get("/api/ads/", { params: { _t: Date.now() } });
          const fallbackList = Array.isArray(fallback.data) ? fallback.data : (fallback.data?.results || []);
          setAds(fallbackList);
        } catch (_) {}
      }
    };

    fetchSchools();
    fetchAds();
  }, []);

  const handleCardClick = (id) => {
    navigate(`/school/${id}`);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundImage: `url(${welcomeBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start", // Changed to flex-start for better scrolling on mobile
        padding: { xs: 2, sm: 4 },
        position: 'relative',
        overflowY: 'auto'
      }}
    >
      {/* Top Controls - Search and User Info */}
      <Box 
        sx={{ 
          position: { xs: 'relative', sm: 'absolute' }, 
          top: { sm: 20 }, 
          right: { sm: 20 }, 
          width: { xs: '100%', sm: 'auto' }, 
          zIndex: 10,
          mb: { xs: 3, sm: 0 },
          mt: { xs: 2, sm: 0 },
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'center',
          gap: 2
        }}
      >
        {user && (
          <Paper 
            elevation={3}
            sx={{ 
              p: 0.5, 
              pl: 2, 
              borderRadius: 5, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1.5,
              bgcolor: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(4px)'
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', lineHeight: 1, color: 'primary.main' }}>
                {user.first_name || user.username}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                ID: {user.username}
              </Typography>
            </Box>
            <Avatar 
              src={user.photo_url || user.photo}
              sx={{ width: 30, height: 30, bgcolor: 'primary.main', fontSize: '0.8rem' }}
            >
              {user.username?.charAt(0).toUpperCase()}
            </Avatar>
            <Button size="small" color="error" sx={{ minWidth: 'auto', borderRadius: 5, fontSize: '0.7rem' }} onClick={logout}>
              লগআউট
            </Button>
          </Paper>
        )}

        <Box sx={{ width: { xs: '100%', sm: 320 } }}>
          <Autocomplete
            size="small"
            sx={{ 
              bgcolor: 'white', 
              borderRadius: 2,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              '& .MuiOutlinedInput-root': {
                borderRadius: 2
              }
            }}
            options={schools}
            getOptionLabel={(opt) => (typeof opt === 'string' ? opt : (opt?.name || ''))}
            filterOptions={(options, state) => {
              const q = (state.inputValue || '').toLowerCase();
              return options.filter(o => (o?.name || '').toLowerCase().includes(q));
            }}
            onChange={(_, value) => {
              if (!value) return;
              if (typeof value === 'string') {
                const match = schools.find(s => (s.name || '').toLowerCase() === value.toLowerCase())
                  || schools.find(s => (s.name || '').toLowerCase().includes(value.toLowerCase()));
                if (match?.id) handleCardClick(match.id);
              } else if (value?.id) {
                handleCardClick(value.id);
              }
            }}
            inputValue={searchInput}
            onInputChange={(_, v) => setSearchInput(v)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="আপনার স্কুল সার্চ করুন..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const q = (searchInput || '').trim().toLowerCase();
                    if (!q) return;
                    const match = schools.find(s => (s.name || '').toLowerCase() === q)
                      || schools.find(s => (s.name || '').toLowerCase().includes(q));
                    if (match?.id) handleCardClick(match.id);
                  }
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                {option.name}
              </li>
            )}
          />
        </Box>
      </Box>

      {/* Global Advertisements Section */}
      {ads && ads.length > 0 && (
        <Box 
          sx={{ 
            width: '100%', 
            maxWidth: 1200, 
            mb: { xs: 4, sm: 6 }, 
            overflowX: 'auto', 
            display: 'flex', 
            gap: 2, 
            pb: 2, 
            justifyContent: { xs: 'flex-start', md: 'center' },
            px: 1,
            '&::-webkit-scrollbar': { height: 6 }, 
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.4)', borderRadius: 3 } 
          }}
        >
          {(() => {
            const NUM_SLOTS = 3;
            // Now all slots have access to all ads, but start at different offsets
            return Array.from({ length: NUM_SLOTS }, (_, i) => {
              return <AdSlot key={i} slotIndex={i} items={filteredAds} getMediaUrl={getMediaUrl} />;
            });
          })()}
        </Box>
      )}

      {/* Main Logo and Branding */}
      <Box sx={{ textAlign: "center", mb: { xs: 4, sm: 6 }, zIndex: 1 }}>
        <Box
          component="img"
          src={logo}
          alt="BDApp Logo"
          sx={{ 
            width: { xs: '150px', sm: '220px' }, 
            mb: 2, 
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' 
          }}
        />
        <Typography 
          variant="h4" 
          sx={{ 
            color: "white", 
            fontWeight: 700, 
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            fontSize: { xs: '1.5rem', sm: '2.125rem' }
          }}
        >
          স্কুল ম্যানেজমেন্ট সিস্টেম
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ py: 10 }}>
          <Typography variant="h5" color="white" sx={{ textAlign: 'center' }}>স্কুলগুলো লোড হচ্ছে...</Typography>
        </Box>
      ) : (
        <Box sx={{ width: '100%', maxWidth: 1200 }}>
          {loadError ? (
            <Typography variant="h6" color="white" sx={{ textAlign: 'center', bgcolor: 'rgba(255,0,0,0.2)', p: 2, borderRadius: 2 }}>
              {loadError}
            </Typography>
          ) : schools.length > 0 ? (
            <>
              {/* Carousel Section */}
              <Box sx={{ mb: { xs: 6, sm: 8 } }}>
                <SchoolCarousel schools={schools} />
              </Box>

              {/* Schools Grid Section */}
              <Typography 
                variant="h5" 
                sx={{ 
                  color: 'white', 
                  mb: 3, 
                  textAlign: 'center', 
                  fontWeight: 600,
                  textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
                }}
              >
                সকল স্কুল তালিকা
              </Typography>
              
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(auto-fill, minmax(280px, 1fr))',
                    md: 'repeat(auto-fill, minmax(300px, 1fr))'
                  },
                  gap: 3,
                  width: "100%",
                  mb: 4,
                  px: { xs: 1, sm: 0 }
                }}
              >
                {schools.map((school) => (
                  <Card
                    key={school.id}
                    sx={{
                      cursor: "pointer",
                      borderRadius: 4,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      transition: "all 0.3s ease",
                      "&:hover": { 
                        transform: "translateY(-8px)", 
                        boxShadow: '0 12px 32px rgba(0,0,0,0.2)' 
                      },
                      background: "rgba(255,255,255,0.95)",
                      border: '1px solid rgba(255,255,255,0.3)',
                      overflow: 'hidden'
                    }}
                    onClick={() => handleCardClick(school.id)}
                  >
                    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar 
                        src={school.img} 
                        sx={{ 
                          width: 60, 
                          height: 60, 
                          bgcolor: 'primary.main',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                      >
                        <SchoolIcon />
                      </Avatar>
                      <Box sx={{ overflow: 'hidden' }}>
                        <Typography 
                          variant="h6" 
                          noWrap 
                          sx={{ fontWeight: 700, color: '#1a237e' }}
                        >
                          {school.name}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          noWrap
                        >
                          {school.address || 'ঠিকানা পাওয়া যায়নি'}
                        </Typography>
                      </Box>
                    </Box>
                  </Card>
                ))}
              </Box>
            </>
          ) : (
            <Typography variant="h5" color="white" sx={{ textAlign: 'center' }}>কোনো স্কুল পাওয়া যায়নি</Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

export default WelcomePage;
