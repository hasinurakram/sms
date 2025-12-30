import React from 'react';
import { Box, Skeleton, Grid, Card, CardContent } from '@mui/material';

export function CardSkeleton({ count = 3 }) {
  return (
    <Grid container spacing={2}>
      {[...Array(count)].map((_, i) => (
        <Grid size={{ xs: 12, sm: 6, md: 4 }}  key={i}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="60%" height={30} />
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="80%" />
              <Box sx={{ mt: 2 }}>
                <Skeleton variant="rectangular" height={40} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <Box>
      {[...Array(rows)].map((_, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2 }}>
          {[...Array(columns)].map((_, j) => (
            <Skeleton key={j} variant="text" width={`${100 / columns}%`} height={40} />
          ))}
        </Box>
      ))}
    </Box>
  );
}

export function ListSkeleton({ count = 5 }) {
  return (
    <Box>
      {[...Array(count)].map((_, i) => (
        <Box key={i} sx={{ mb: 2 }}>
          <Skeleton variant="text" width="100%" height={60} />
        </Box>
      ))}
    </Box>
  );
}
