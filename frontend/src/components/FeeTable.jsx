import React from 'react';
import {
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  TablePagination,
  LinearProgress,
  Avatar,
  TableSortLabel
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Warning as WarningIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';

const statusChips = {
  paid: { label: 'Paid', color: 'success', icon: <CheckCircleIcon fontSize="small" /> },
  pending: { label: 'Pending', color: 'warning', icon: <PendingIcon fontSize="small" /> },
  overdue: { label: 'Overdue', color: 'error', icon: <WarningIcon fontSize="small" /> },
};

export default function FeeTable({ 
  fees = [], 
  payments = [],
  onEdit,
  onDelete,
  onViewReceipt,
  onDownloadReceipt,
  onPrintReceipt,
  onFilter,
  onSort,
  sortBy,
  sortDirection = 'asc',
  loading = false,
  pagination = { page: 0, rowsPerPage: 10, total: 0 },
  onPageChange,
  onRowsPerPageChange
}) {
  const navigate = useNavigate();
  const { page, rowsPerPage, total } = pagination;

  const renderStatusChip = (status) => {
    const statusData = statusChips[status.toLowerCase()] || statusChips.pending;
    return (
      <Chip
        size="small"
        icon={statusData.icon}
        label={statusData.label}
        color={statusData.color}
        variant="outlined"
        sx={{ fontWeight: 500 }}
      />
    );
  };

  const handleSort = (columnId) => {
    const isAsc = sortBy === columnId && sortDirection === 'asc';
    onSort(columnId, isAsc ? 'desc' : 'asc');
  };

  const handleChangePage = (event, newPage) => {
    onPageChange(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    onRowsPerPageChange(parseInt(event.target.value, 10));
  };

  const renderHeaderCell = (id, label, sortable = true) => (
    <TableCell sortDirection={sortBy === id ? sortDirection : false}>
      {sortable ? (
        <TableSortLabel
          active={sortBy === id}
          direction={sortBy === id ? sortDirection : 'asc'}
          onClick={() => handleSort(id)}
        >
          {label}
        </TableSortLabel>
      ) : (
        label
      )}
    </TableCell>
  );

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Paper elevation={0} sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
      <TableContainer sx={{ maxHeight: 600 }}>
        <Table stickyHeader aria-label="fee table" size="small">
          <TableHead>
            <TableRow>
              {renderHeaderCell('student', 'Student')}
              {renderHeaderCell('fee_type', 'Fee Type')}
              {renderHeaderCell('amount', 'Amount')}
              {renderHeaderCell('due_date', 'Due Date')}
              {renderHeaderCell('status', 'Status')}
              {renderHeaderCell('paid_date', 'Paid Date')}
              <TableCell>Receipt</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Box sx={{ color: 'text.secondary' }}>No payment records found</Box>
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow 
                  key={payment.id}
                  hover
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar 
                        src={payment.student?.profile_picture} 
                        alt={payment.student?.name}
                        sx={{ width: 32, height: 32 }}
                      />
                      <Box>
                        <Typography variant="subtitle2">
                          {payment.student?.name || 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {payment.student?.admission_number || ''}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {payment.fee_type || 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {payment.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2">
                      ৳{payment.amount?.toLocaleString() || '0'}
                    </Typography>
                    {payment.discount > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        -৳{payment.discount} (discount)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {payment.due_date ? format(new Date(payment.due_date), 'dd MMM yyyy') : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {renderStatusChip(payment.status || 'pending')}
                  </TableCell>
                  <TableCell>
                    {payment.paid_date ? format(new Date(payment.paid_date), 'dd MMM yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    <IconButton 
                      size="small" 
                      onClick={() => onViewReceipt?.(payment)}
                      color="primary"
                    >
                      <ReceiptIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => {
                          if (!isAuthenticated()) {
                            navigate('/login');
                            return;
                          }
                          onEdit?.(payment);
                        }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => {
                          if (!isAuthenticated()) {
                            navigate('/login');
                            return;
                          }
                          onDelete?.(payment);
                        }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <Box sx={{ display: 'flex', alignItems: 'center', p: 1, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ flex: 1, ml: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Showing {payments.length} of {total} records
          </Typography>
        </Box>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Box>
    </Paper>
  );
}
