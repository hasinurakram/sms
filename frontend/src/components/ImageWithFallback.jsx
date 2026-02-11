import React, { useState } from 'react';
import { Box } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';

const ImageWithFallback = ({
  src,
  srcCandidates = null,
  alt = 'Image',
  width = 40,
  height = 40,
  fallback = null,
  ...props
}) => {
  const [imgError, setImgError] = useState(false);
  const [index, setIndex] = useState(0);

  const list = Array.isArray(srcCandidates) && srcCandidates.length ? srcCandidates : (src ? [src] : []);
  const currentSrc = list.length ? list[Math.max(0, Math.min(index, list.length - 1))] : null;

  if (imgError || !currentSrc) {
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
      src={currentSrc}
      alt={alt}
      onError={() => {
        if (Array.isArray(list) && index < list.length - 1) {
          setIndex(index + 1);
          setImgError(false);
        } else {
          setImgError(true);
        }
      }}
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
