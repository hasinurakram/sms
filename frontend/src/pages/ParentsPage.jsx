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
  Tooltip,
  InputAdornment,
  Fade,
  Chip
} from '@mui/material';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EmptyState from '../components/EmptyState';
import ProfileCard from '../components/ProfileCard';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import { useAcademics } from '../context/AcademicsContext';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import ClassCard from '../components/ClassCard';

export default function ParentsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [focusParent, setFocusParent] = useState('');
  const toast = useToast();
  const { classrooms, students, sections, refreshAll } = useAcademics();

  // Determine if the selected classroom requires sections (only for class 6–10)
  const requiresSectionForSelectedClass = React.useMemo(() => {
    try {
      if (!selectedClassroom) return false;
      const clsObj = (classrooms || []).find(c => String(c.id) === String(selectedClassroom));
      const name = String(clsObj?.name || '').toLowerCase();
      return /ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b|নবম|nine|\b9\b|দশম|ten|\b10\b/.test(name);
    } catch (_) { return false; }
  }, [selectedClassroom, classrooms]);

  const loadParents = () => {
    if (!id) return;
    setLoading(true);
    api.get(`/api/users/parents/?school=${id}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setParents(data);
        if (data.length > 0) {
          toast.success(`Loaded ${data.length} parents successfully`);
        }
      })
      .catch(err => {
        console.error('Failed to load parents:', err);
        toast.error('Failed to load parents');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Get linked child profiles (name + photo) for a given parent
  const getChildProfilesForParent = (parent) => {
    try {
      const parentUserId = parent?.user?.id ?? null;
      const parentProfileId = parent?.id ?? null;
      const parentUsername = String(parent?.user?.username || '').trim();
      const uidStr = parentUserId != null ? String(parentUserId) : null;
      const pidStr = parentProfileId != null ? String(parentProfileId) : null;

      const match = (st) => {
        const g = st.guardian;
        const idCandidates = [
          st.guardian_id,
          st.guardian_user,
          st.guardian_profile,
          st.parent,
          st.parent_id,
          (typeof g === 'object' ? g?.id : undefined),
          (typeof g === 'object' ? g?.user?.id : undefined),
          (typeof g === 'number' || typeof g === 'string' ? g : undefined)
        ].filter(v => v !== undefined && v !== null).map(v => String(v));

        const usernameCandidates = [
          st.guardian_username,
          (typeof g === 'object' ? (g?.username || g?.user?.username) : undefined),
          (typeof g === 'string' ? g : undefined)
        ].filter(Boolean).map(v => String(v));

        const byId = idCandidates.some(x => (uidStr && x === uidStr) || (pidStr && x === pidStr));
        const byUsername = usernameCandidates.some(u => u === parentUsername);
        return byId || byUsername;
      };

      const list = (students || [])
        .filter(match)
        .map(s => {
          const u = s.user || {};
          const nm = (`${u.first_name || ''} ${u.last_name || ''}`).trim() || u.username || `Student #${s.id}`;
          const photo = u.photo_url || u.photo || s.photo_url || s.photo || '';
          const roll = s?.roll_number ?? null;
          return { id: s.id, name: nm, photo, roll_number: roll };
        });
      return list;
    } catch (_) {
      return [];
    }
  };

  // Ensure UI updates immediately after any profile/link changes from ProfileCard
  const handleCardUpdate = async () => {
    try {
      if (id) {
        await refreshAll(id);
      }
    } catch (_) {}
    // Always reload parents list afterwards to reflect edits
    loadParents();
  };

  // Get linked child names for a given parent from students list
  const getChildNamesForParent = (parent) => {
    try {
      const parentUserId = parent?.user?.id ?? null;
      const parentProfileId = parent?.id ?? null;
      const parentUsername = String(parent?.user?.username || '').trim();
      const uidStr = parentUserId != null ? String(parentUserId) : null;
      const pidStr = parentProfileId != null ? String(parentProfileId) : null;

      const match = (st) => {
        const g = st.guardian;
        const idCandidates = [
          st.guardian_id,
          st.guardian_user,
          st.guardian_profile,
          st.parent,
          st.parent_id,
          (typeof g === 'object' ? g?.id : undefined),
          (typeof g === 'object' ? g?.user?.id : undefined),
          (typeof g === 'number' || typeof g === 'string' ? g : undefined)
        ].filter(v => v !== undefined && v !== null).map(v => String(v));

        const usernameCandidates = [
          st.guardian_username,
          (typeof g === 'object' ? (g?.username || g?.user?.username) : undefined),
          (typeof g === 'string' ? g : undefined)
        ].filter(Boolean).map(v => String(v));

        const byId = idCandidates.some(x => (uidStr && x === uidStr) || (pidStr && x === pidStr));
        const byUsername = usernameCandidates.some(u => u === parentUsername);
        return byId || byUsername;
      };

      const names = (students || [])
        .filter(match)
        .map(s => {
          const u = s.user || {};
          const nm = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || `Student #${s.id}`;
          const roll = s?.roll_number;
          return roll ? `${nm}(${roll})` : nm;
        });
      return names;
    } catch (_) {
      return [];
    }
  };

  useEffect(() => {
    loadParents();
    // Ensure academics data (classrooms, students) are loaded for this school
    if (id) {
      refreshAll(id).catch(() => {});
    }
  }, [id]);

  // Optionally read classroom/section/showAll/parent from URL query
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const cls = params.get('classroom');
      const sec = params.get('section');
      const all = params.get('showAll');
      const parent = params.get('parent');
      const refresh = params.get('refresh');
      
      // Set initial state based on URL params
      if (cls) setSelectedClassroom(String(cls));
      if (sec) setSelectedSection(String(sec));
      setShowAll(all === '1');
      
      // If a specific parent is requested, focus on them
      if (parent) {
        setFocusParent(String(parent));
        // If no class/section is selected, show all to ensure the parent is visible
        if (!cls && !sec) setShowAll(true);
      }
      
      // Force reload if refresh param is present
      if (refresh) {
        // Clear the refresh parameter from URL without reloading
        const newUrl = window.location.pathname + 
          (cls || sec || all || parent ? 
            `?${new URLSearchParams({
              ...(cls && { classroom: cls }),
              ...(sec && { section: sec }),
              ...(all && { showAll: all }),
              ...(parent && { parent: parent })
            }).toString()}` : '');
        window.history.replaceState({}, '', newUrl);
        
        // Force reload data
        loadParents();
        if (id) {
          refreshAll(id).catch(console.error);
        }
      }
    } catch (_) {}
  }, []);

  // Count unique guardians for a given section within the selected classroom
  const getGuardianCountForSection = (sectionId) => {
    try {
      const parentIdSet = new Set((parents || []).map(p => String(p.user?.id || p.id)).filter(Boolean));
      const parentUserSet = new Set((parents || []).map(p => p.user?.username).filter(Boolean));
      const secIdStr = String(sectionId);
      const clsIdStr = String(selectedClassroom);
      const guardians = new Set();
      (students || [])
        .filter(s => String(s.classroom?.id ?? s.classroom) === clsIdStr && String(s.section?.id ?? s.section) === secIdStr)
        .forEach(s => {
          const g = s.guardian;
          const gid = g && (g.id || g.user?.id || g);
          const gun = g && (g.username || g.user?.username);
          const gidStr = gid != null ? String(gid) : null;
          const hasParent = (gidStr && parentIdSet.has(gidStr)) || (gun && parentUserSet.has(gun));
          if (hasParent) guardians.add(gidStr || gun);
        });
      return guardians.size;
    } catch (_) {
      return 0;
    }
  };

  // Convert English digits to Bengali digits
  const toBn = (val) => {
    const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return String(val).replace(/\d/g, d => bn[d] ?? d);
  };

  // Count unique guardians for an entire classroom (across all its sections)
  const getGuardianCountForClass = (classId) => {
    try {
      const parentIdSet = new Set((parents || []).map(p => String(p.user?.id || p.id)).filter(Boolean));
      const parentUserSet = new Set((parents || []).map(p => p.user?.username).filter(Boolean));
      const clsIdStr = String(classId);
      const guardians = new Set();
      (students || [])
        .filter(s => String(s.classroom?.id ?? s.classroom) === clsIdStr)
        .forEach(s => {
          const g = s.guardian;
          const gid = g && (g.id || g.user?.id || g);
          const gun = g && (g.username || g.user?.username);
          const gidStr = gid != null ? String(gid) : null;
          const hasParent = (gidStr && parentIdSet.has(gidStr)) || (gun && parentUserSet.has(gun));
          if (hasParent) guardians.add(gidStr || gun);
        });
      return guardians.size;
    } catch (_) {
      return 0;
    }
  };

  // Only show all parents if explicitly requested, otherwise filter by class/section
  const effectiveShowAll = showAll;

  const filtered = parents.filter(p => {
    const user = p.user || {};
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim().toLowerCase() || (user.username || '').toLowerCase();
    const matchesSearch = !searchQuery ? true : name.includes(searchQuery.toLowerCase());
    const uid = String(user.id || p.id || '');
    const isFocus = focusParent && uid === String(focusParent);

    // Always include focused parent regardless of other filters
    if (isFocus) return true;

    // In showAll mode: ignore class/section linking; apply search if present
    if (effectiveShowAll) {
      return matchesSearch;
    }

    // If no class selected, don't show any parents (unless in showAll mode)
    if (!selectedClassroom) return false;
    // If class requires section but none selected, don't show parents yet
    if (requiresSectionForSelectedClass && !selectedSection) return false;

    // Apply search filter if present
    if (searchQuery && !matchesSearch) return false;

    // Get the parent's ID and username for comparison
    const parentId = user.id || p.id;
    const parentUsername = user.username;

    // Find all students linked to this parent in the selected class/section
    const linkedStudents = (students || []).filter(st => {
      // Get guardian info from student
      const stGuardian = st.guardian;
      
      // Handle different guardian data formats
      let guardianId = null;
      let guardianUsername = null;
      
      if (stGuardian) {
        if (typeof stGuardian === 'object') {
          guardianId = stGuardian.id || (stGuardian.user?.id || null);
          guardianUsername = stGuardian.username || (stGuardian.user?.username || null);
        } else {
          guardianId = stGuardian;
        }
      }
      
      // Get class and section IDs, handling both object and ID formats
      const stClassId = st.classroom?.id ?? st.classroom;
      const stSectionId = st.section?.id ?? st.section;
      
      // Check if this student is in the selected class/section
      const isInSelectedClass = String(stClassId) === String(selectedClassroom);
      const isInSelectedSection = requiresSectionForSelectedClass ? (String(stSectionId) === String(selectedSection)) : true;
      const isInSelectedClassSection = isInSelectedClass && isInSelectedSection;
      
      // Check if this student is linked to the current parent
      const isLinkedToParent = 
        (guardianId !== null && String(guardianId) === String(parentId)) ||
        (guardianUsername && parentUsername && String(guardianUsername) === String(parentUsername));
      
      return isInSelectedClassSection && isLinkedToParent;
    });
    
    // If we found at least one student linked to this parent in the selected class/section,
    // include this parent in the results
    return linkedStudents.length > 0;
  });

  // If a specific parent is provided, bring them to the top
  const displayedParents = (() => {
    if (!focusParent) return filtered;
    try {
      const fp = String(focusParent);
      const arr = [...filtered];
      arr.sort((a, b) => {
        const aid = String(a.user?.id || a.id || '');
        const bid = String(b.user?.id || b.id || '');
        return (aid === fp ? -1 : 0) + (bid === fp ? 1 : 0);
      });
      return arr;
    } catch (_) { return filtered; }
  })();

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <Fade in timeout={500}>
        <Paper 
          elevation={0}
          sx={{ 
            mb: 3, 
            p: 3, 
            background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
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
                <FamilyRestroomIcon sx={{ mr: 1, fontSize: 40 }} />
                অভিভাবক ব্যবস্থাপনা
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                অভিভাবকের প্রোফাইল ম্যানেজ করুন এবং শিক্ষার্থীদের সাথে লিঙ্ক করুন
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
                {(() => {
                  const totalForDisplay = (() => {
                    if (!selectedClassroom || effectiveShowAll) return parents.length;
                    return requiresSectionForSelectedClass
                      ? (selectedSection ? getGuardianCountForSection(selectedSection) : getGuardianCountForClass(selectedClassroom))
                      : getGuardianCountForClass(selectedClassroom);
                  })();
                  const showing = displayedParents.length;
                  return `স্কুল আইডি: ${id} | মোট অভিভাবক: ${toBn(totalForDisplay)}${(selectedClassroom && !requiresSectionForSelectedClass) || effectiveShowAll || selectedSection ? ` | দেখানো হচ্ছে: ${toBn(showing)}` : ''}`;
                })()}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button 
                variant="outlined" 
                startIcon={<ArrowBackIcon />} 
                onClick={() => navigate(-1)}
                sx={{ 
                  borderColor: 'rgba(255,255,255,0.5)', 
                  color: 'white',
                  '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
                }}
              >
                ব্যাক
              </Button>
              <Button 
                variant="contained" 
                startIcon={<AddIcon />} 
                onClick={() => {
                  if (!isAuthenticated()) {
                    navigate('/login');
                    return;
                  }
                  navigate(`/dashboard/${id}/add-parent`);
                }}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                  backdropFilter: 'blur(10px)'
                }}
              >
                অভিভাবক যোগ করুন
              </Button>
              <Button 
                variant="outlined" 
                startIcon={<RefreshIcon />} 
                onClick={loadParents}
                sx={{ 
                  borderColor: 'rgba(255,255,255,0.5)', 
                  color: 'white',
                  '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
                }}
              >
                রিফ্রেশ
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Fade>

      {/* Search & Class Filter */}
      <Paper elevation={2} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl fullWidth>
            <InputLabel id="classroom-select-label">শ্রেণী অনুযায়ী ফিল্টার</InputLabel>
            <Select
              labelId="classroom-select-label"
              value={selectedClassroom}
              label="শ্রেণী অনুযায়ী ফিল্টার"
              onChange={(e) => { setSelectedClassroom(e.target.value); setSelectedSection(''); setShowAll(false); setFocusParent(''); }}
            >
              <MenuItem value="">সব শ্রেণী</MenuItem>
              {(classrooms || []).map(c => (
                <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            placeholder="অভিভাবকের নাম বা ইউজারনেম দিয়ে খুঁজুন..."
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
          <Button
            variant={effectiveShowAll ? 'contained' : 'outlined'}
            color="primary"
            onClick={() => { setShowAll(true); setSelectedClassroom(''); setSelectedSection(''); setFocusParent(''); }}
            sx={{ whiteSpace: 'nowrap' }}
          >
            সকল অভিভাবক দেখুন
          </Button>
        </Stack>
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

      {!loading && !effectiveShowAll && !selectedClassroom && (
        <Grid container spacing={2}>
          {(classrooms || []).map((c) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={c.id}>
              <Box onClick={() => { setSelectedClassroom(String(c.id)); setSelectedSection(''); setShowAll(false); setFocusParent(''); }} sx={{ cursor: 'pointer' }}>
                <ClassCard classroom={c} />
                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
                  <Chip 
                    icon={<FamilyRestroomIcon />}
                    label={`মোট ${toBn(getGuardianCountForClass(c.id))} জন অভিভাবক`}
                    color="primary"
                    variant="outlined"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      )}
      {!loading && !selectedClassroom && !effectiveShowAll && parents.length === 0 && (
        <EmptyState
          icon={FamilyRestroomIcon}
          title="কোন অভিভাবক নেই"
          message="শুরু করুন অভিভাবক যোগ করে বা শিক্ষার্থীদের সাথে লিঙ্ক করে"
          actionText="অভিভাবক যোগ করুন"
          onAction={() => navigate(`/school/${id}/parent/add`)}
        />
      )}

      {!loading && !effectiveShowAll && selectedClassroom && !selectedSection && requiresSectionForSelectedClass && (
        <Grid container spacing={2}>
          {((sections || []).filter(s => String(s.classroom?.id ?? s.classroom) === String(selectedClassroom))).length === 0 ? (
            <Grid size={{ xs: 12 }}>
              <EmptyState
                title="এই শ্রেণীতে কোনো সেকশন পাওয়া যায়নি"
                message="দয়া করে আগে এই শ্রেণীর জন্য সেকশন যুক্ত করুন"
              />
            </Grid>
          ) : (
            (sections || []).filter(s => String(s.classroom?.id ?? s.classroom) === String(selectedClassroom))
              .map(sec => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={sec.id}>
                  <Paper
                    elevation={3}
                    onClick={() => { setSelectedSection(String(sec.id)); setShowAll(false); setFocusParent(''); }}
                    sx={{
                      cursor: 'pointer',
                      p: 3,
                      borderRadius: 3,
                      minHeight: 160,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
                      transition: 'all 0.25s ease',
                      '&:hover': { boxShadow: 8, transform: 'translateY(-4px)' }
                    }}
                  >
                    <Stack alignItems="center" spacing={1.5}>
                      <Box sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        bgcolor: 'primary.light',
                        color: 'primary.contrastText',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <FamilyRestroomIcon />
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        সেকশন {sec.name}
                      </Typography>
                      <Chip 
                        icon={<FamilyRestroomIcon />}
                        label={`মোট ${toBn(getGuardianCountForSection(sec.id))} জন অভিভাবক`}
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        দেখতে ক্লিক করুন
                      </Typography>
                    </Stack>
                  </Paper>
                </Grid>
              ))
          )}
        </Grid>
      )}
    
    {!loading && ((effectiveShowAll || selectedSection) || (selectedClassroom && !requiresSectionForSelectedClass)) && displayedParents.length === 0 && (
      <EmptyState
        title="কোন অভিভাবক পাওয়া যায়নি"
        message="নির্বাচিত শ্রেণী ও সেকশনে কোনো অভিভাবক নেই বা পাওয়া যায়নি"
      />
    )}

    {!loading && displayedParents.length > 0 && (
      <Fade in timeout={700}>
        <Grid container spacing={2}>
          {displayedParents.map((parent) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={parent.id}>
              <Box
                onClick={() => navigate(`/school/${id}/parent/${parent.id}/dashboard`)}
                sx={{ cursor: 'pointer' }}
              >
                <ProfileCard
                  profile={parent}
                  onUpdate={handleCardUpdate}
                  showRole={true}
                  showActions={true}
                  schoolId={id}
                  enableLinkStudents={true}
                  childNames={getChildNamesForParent(parent)}
                  childProfiles={getChildProfilesForParent(parent)}
                  forceLinkStudents={true}
                  filterClassroomId={selectedClassroom || undefined}
                  filterSectionId={selectedSection || undefined}
                />
              </Box>
            </Grid>
          ))}
        </Grid>
      </Fade>
    )}

    {/* Stats Footer */}
    {!loading && parents.length > 0 && (
      <Fade in timeout={800}>
        <Paper 
          elevation={0} 
          sx={{ 
            mt: 3, 
            p: 2, 
            bgcolor: 'primary.light',
            borderRadius: 2,
            textAlign: 'center'
          }}
        >
          <Typography variant="h6" color="primary.dark">
            {(() => {
              const totalForDisplay = (() => {
                if (!selectedClassroom || effectiveShowAll) return parents.length;
                return requiresSectionForSelectedClass
                  ? (selectedSection ? getGuardianCountForSection(selectedSection) : getGuardianCountForClass(selectedClassroom))
                  : getGuardianCountForClass(selectedClassroom);
              })();
              const showing = displayedParents.length;
              return `📊 মোট অভিভাবক: ${toBn(totalForDisplay)}${showing >= 0 ? ` | দেখানো হচ্ছে: ${toBn(showing)}` : ''}`;
            })()}
          </Typography>
        </Paper>
      </Fade>
    )}
  </Box>
  );
}
