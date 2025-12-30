import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  CardMedia,
} from "@mui/material";

export default function SchoolList() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api
      .get("/api/schools/")
      .then((res) => {
        setSchools(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load schools.");
        setLoading(false);
      });
  }, []);

  if (loading)
    return <CircularProgress sx={{ display: "block", m: "20px auto" }} />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!schools.length)
    return (
      <Typography variant="h5" sx={{ mt: 5, textAlign: "center" }}>
        No schools found
      </Typography>
    );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" mb={2}>
        Schools
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "1fr 1fr",
            md: "1fr 1fr 1fr",
          },
          gap: 3,
        }}
      >
        {schools.map((school) => (
          <SchoolCard key={school.id} school={school} />
        ))}
      </Box>
    </Box>
  );
}