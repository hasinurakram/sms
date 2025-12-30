import React, { useState, useRef, useEffect } from 'react';
import { Badge, IconButton, Paper, Popper, Typography, Box, Divider, Button, List, ListItem, ListItemText, ListItemAvatar, Avatar } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNotifications } from '../context/NotificationContext';

export default function NotificationBell() {
  const { notifications, markAllAsRead, markAsRead, getUnreadCount } = useNotifications();
  const [anchorEl, setAnchorEl] = useState(null);
  const [open, setOpen] = useState(false);
  const unreadCount = getUnreadCount();

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    setOpen(!open);
    
    // Mark all as read when opening the notification panel
    if (!open) {
      markAllAsRead();
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleNotificationClick = (notificationId) => {
    markAsRead(notificationId);
    // You can add navigation or other actions here
  };

  return (
    <div>
      <IconButton 
        color="inherit" 
        onClick={handleClick}
        aria-label={`${unreadCount} unread notifications`}
        aria-controls={open ? 'notification-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popper
        id="notification-popper"
        open={open}
        anchorEl={anchorEl}
        placement="bottom-end"
        disablePortal={false}
        modifiers={[
          {
            name: 'flip',
            enabled: true,
            options: {
              altBoundary: true,
              rootBoundary: 'document',
              padding: 8,
            },
          },
          {
            name: 'preventOverflow',
            enabled: true,
            options: {
              altAxis: true,
              altBoundary: true,
              tether: true,
              rootBoundary: 'document',
              padding: 8,
            },
          },
        ]}
      >
        <Paper elevation={3} sx={{ width: 360, maxHeight: 500, overflow: 'auto' }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Notifications</Typography>
            {notifications.length > 0 && (
              <Button size="small" onClick={markAllAsRead}>
                Mark all as read
              </Button>
            )}
          </Box>
          <Divider />
          
          {notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="textSecondary">No notifications yet</Typography>
            </Box>
          ) : (
            <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
              {notifications.map((notification) => (
                <React.Fragment key={notification.id}>
                  <ListItem 
                    alignItems="flex-start" 
                    button
                    onClick={() => handleNotificationClick(notification.id)}
                    sx={{
                      bgcolor: notification.read ? 'background.paper' : 'action.hover',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar>
                        {notification.icon || <NotificationsIcon />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={notification.title}
                      secondary={
                        <React.Fragment>
                          <Typography
                            sx={{ display: 'inline' }}
                            component="span"
                            variant="body2"
                            color="text.primary"
                          >
                            {notification.message}
                          </Typography>
                          <br />
                          {new Date(notification.timestamp).toLocaleString()}
                        </React.Fragment>
                      }
                    />
                  </ListItem>
                  <Divider variant="inset" component="li" />
                </React.Fragment>
              ))}
            </List>
          )}
          
          <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
            <Button size="small" onClick={handleClose}>
              Close
            </Button>
          </Box>
        </Paper>
      </Popper>
    </div>
  );
}
