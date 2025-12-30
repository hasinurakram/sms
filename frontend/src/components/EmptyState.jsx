import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

export default function EmptyState({
  icon = InboxIcon,
  title = 'No data found',
  message,
  description,
  actionText,
  onAction,
  action
}) {
  // Prefer description if provided, fall back to message
  const bodyText = description ?? message ?? 'Get started by adding your first item';

  const renderIcon = () => {
    const baseSx = { fontSize: 80, color: 'text.secondary', mb: 2, opacity: 0.5 };
    // If icon is already a valid React element, render it and merge sx
    if (React.isValidElement(icon)) {
      const existingSx = icon.props?.sx || {};
      return React.cloneElement(icon, { sx: { ...baseSx, ...existingSx } });
    }
    // Otherwise assume it's a component (function/class) and render it
    const IconComponent = icon || InboxIcon;
    return <IconComponent sx={baseSx} />;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 2,
        textAlign: 'center'
      }}
    >
      {renderIcon()}
      <Typography variant="h5" gutterBottom color="text.secondary">
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 400 }}>
        {bodyText}
      </Typography>
      {action ? (
        action
      ) : (
        actionText && onAction && (
          <Button variant="contained" onClick={onAction} size="large">
            {actionText}
          </Button>
        )
      )}
    </Box>
  );
}
