import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', severity = 'warning' }) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {severity === 'warning' && <WarningIcon color="warning" />}
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit">
          {cancelText}
        </Button>
        <Button onClick={onConfirm} variant="contained" color={severity === 'error' ? 'error' : 'primary'} autoFocus>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
