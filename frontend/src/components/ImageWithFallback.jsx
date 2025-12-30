import React, { useState } from 'react';
import { Box } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';

const ImageWithFallback = ({
  src,
  alt = 'Image',
  width = 40,
  height = 40,
  fallback = null,
  ...props
}) => {
  const [imgError, setImgError] = useState(false);

  if (imgError || !src) {
    return fallback || (
      <Box
        width={width}
        height={height}
        display="flex"
        alignItems="center"
        justifyContent="center"
        bgcolor="action.hover"
        borderRadius="50%"
        {...props}
      >
        <PersonIcon />
      </Box>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setImgError(true)}
      style={{
        width,
        height,
        objectFit: 'cover',
        borderRadius: '50%',
      }}
      {...props}
    />
  );
};

export default ImageWithFallback;
