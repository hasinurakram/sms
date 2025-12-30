import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  CircularProgress,
  Box,
  IconButton,
  Tooltip
} from '@mui/material';
import { Close as CloseIcon, Receipt as ReceiptIcon } from '@mui/icons-material';
import { format } from 'date-fns';

const PaymentHistoryDialog = ({ open, onClose, payments, loading }) => {
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center">
            <ReceiptIcon sx={{ mr: 1 }} />
            <Typography variant="h6">পেমেন্ট হিস্টোরি</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : payments && payments.length > 0 ? (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>তারিখ</TableCell>
                  <TableCell align="right">পরিমাণ</TableCell>
                  <TableCell>পেমেন্ট পদ্ধতি</TableCell>
                  <TableCell>মন্তব্য</TableCell>
                  <TableCell>রশিদ নং</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.map((payment, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {payment.date ? format(new Date(payment.date), 'dd/MM/yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell align="right">৳{Number(payment.amount || 0).toFixed(2)}</TableCell>
                    <TableCell>{payment.method || 'N/A'}</TableCell>
                    <TableCell>{payment.notes || 'N/A'}</TableCell>
                    <TableCell>{payment.receipt_number || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box p={3} textAlign="center">
            <Typography variant="body1" color="textSecondary">
              কোন পেমেন্টের তথ্য পাওয়া যায়নি
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained">
          বন্ধ করুন
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentHistoryDialog;
