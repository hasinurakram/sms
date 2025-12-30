import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Card, CardContent, CardHeader, Avatar, Autocomplete, TextField } from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import SchoolCarousel from "../components/SchoolCarousel";
import api from "../utils/api";
import fallbackLogo from "../components/fallback_logo.png";
import logo from "../components/bdapp_logo.png";
import welcomeBg from "../components/welcome_bg.jpg";

const WelcomePage = () => {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const navigate = useNavigate();

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
        
      } catch (err) {
        console.error("Error fetching schools:", err);
        setSchools([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSchools();
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
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 2,
        position: 'relative'
      }}
    >
      {/* Top-right School Search */}
      <Box sx={{ position: 'absolute', top: 16, right: 16, width: { xs: '90%', sm: 320 } }}>
        <Autocomplete
          size="small"
          sx={{ bgcolor: 'white', borderRadius: 1 }}
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
              placeholder="স্কুল সার্চ করুন..."
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
      <img src={logo} alt="BDApp Logo" style={{ width: '200px', marginBottom: '20px' }} />
      <Typography variant="h3" color="white" mb={3}> </Typography>

      {loading ? (
        <Typography variant="h5" color="white">Loading Schools...</Typography>
      ) : (
        <>
          {schools.length > 0 ? (
            <>
              {/* Carousel view */}
              <Box sx={{ mb: 4, width: "100%", maxWidth: 1200 }}>
                <SchoolCarousel schools={schools} />
              </Box>
              {/* Card grid view */}
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 3,
                  justifyContent: "center",
                  width: "100%",
                  mb: 2,
                }}
              >
                {schools.map((school) => (
                  <Card
                    key={school.id}
                    sx={{
                      width: 300,
                      cursor: "pointer",
                      borderRadius: 3,
                      boxShadow: 3,
                      transition: "0.3s",
                      "&:hover": { transform: "translateY(-5px)", boxShadow: 6 },
                      background: "rgba(255,255,255,0.9)"
                    }}
                    onClick={() => handleCardClick(school.id)}
                  >
                    <CardHeader
                      avatar={
                        school.img ? (
                          <Avatar src={school.img} />
                        ) : (
                          <Avatar>
                            <SchoolIcon />
                          </Avatar>
                        )
                      }
                      title={school.name}
                    />
                    <CardContent>
                      <Typography>{school.address}</Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </>
          ) : (
            <Typography variant="h5" color="white">No schools found</Typography>
          )}
        </>
      )}
    </Box>
  );
};

export default WelcomePage;
