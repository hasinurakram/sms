import React, { useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, Typography, Box, Avatar, Divider, Grid, Button, Chip } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Helper: classify fee rows into separate categories by their actual names
function classifyRows(rows = []) {
  // Group rows by their actual names to create separate categories
  const feeCategories = {};
  
  for (const r of rows) {
    const categoryName = r.name || 'অজানা ফি';
    
    if (!feeCategories[categoryName]) {
      feeCategories[categoryName] = [];
    }
    feeCategories[categoryName].push(r);
  }
  
  // Return all categories as separate objects
  return feeCategories;
}

export default function StudentFeeSlipCard({ school, student, rows = [], totals = { amount: 0, paid: 0, due: 0 }, title = 'Student Fee Slip', payments = [] }) {
  const cardRef = useRef(null);
  const grouped = useMemo(() => classifyRows(rows), [rows]);

  const fmt = (n) => `৳${Number(n || 0).toLocaleString()}`;
  const paymentsTotal = useMemo(() => (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0), [payments]);
  const latestPayment = useMemo(() => {
    if (!payments || payments.length === 0) return null;
    const withDate = payments.slice().sort((a,b) => new Date(a.date||0) - new Date(b.date||0));
    return withDate[withDate.length - 1];
  }, [payments]);

  // Summary should reflect original charges by category; outstanding computed at the bottom
  const sumAmount = (arr = []) => arr.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  
  // Calculate totals for each fee category dynamically
  const categoryTotals = useMemo(() => {
    const totals = {};
    Object.keys(grouped).forEach(categoryName => {
      totals[categoryName] = sumAmount(grouped[categoryName]);
    });
    return totals;
  }, [grouped]);
  
  const overallAmount = useMemo(() => {
    return Object.values(categoryTotals).reduce((sum, total) => sum + total, 0);
  }, [categoryTotals]);

  const handlePrint = () => {
    // Basic print for the card section only
    const printContents = cardRef.current?.outerHTML || '';
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.open();
    win.document.write(`
      <html>
        <head>
          <title>Student Fee Slip</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; color: #111827; }
            .card { max-width: 900px; margin: 0 auto; }
            .header { display: flex; align-items: center; gap: 12px; }
            .logo { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; border: 1px solid #e5e7eb; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
            .section { margin-top: 16px; }
            .summary { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:10px; }
            .table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .table col.item { width: 55%; }
            .table col.amount, .table col.paid, .table col.due { width: 15%; }
            .table th, .table td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 12.5px; }
            .table th { background: #f1f5f9; text-align: left; font-weight: 600; }
            .table td.num, .table th.num { text-align: right; white-space: nowrap; }
            .table tbody tr:nth-child(odd) { background: #fcfcfd; }
            .totals { margin-top: 10px; text-align: right; }
          </style>
        </head>
        <body>${printContents}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    setTimeout(() => win.close(), 100);
  };

  const logoUrl = school?.logo_url || school?.logo || null;
  const schoolName = school?.name || 'School';
  const studentName = (
    student?.display_name ||
    student?.full_name ||
    student?.name ||
    `${student?.user?.first_name || ''} ${student?.user?.last_name || ''}`.trim() ||
    student?.user?.username ||
    'Student'
  );
  const guardianName = (
    student?.guardian_name || student?.parent_name || student?.father_name || student?.mother_name || student?.user?.guardian_name || ''
  );
  const className = student?.classroom?.name || student?.class?.name || '';
  const roll = student?.roll_number || student?.rollNo || student?.roll_no || '';
  const studentPhoto = student?.profile_picture || student?.user?.photo_url || student?.photo || student?.avatar || null;

  return (
    <Card ref={cardRef} className="card" sx={{ mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
      <CardHeader
        title={
          <Box className="header" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {logoUrl ? (
              <img src={logoUrl} alt="School Logo" className="logo" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
            ) : (
              <Avatar variant="rounded" sx={{ width: { xs: 56, sm: 64 }, height: { xs: 56, sm: 64 } }}>{schoolName?.[0] || 'S'}</Avatar>
            )}
            <Box>
              <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>{schoolName}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>{title}</Typography>
            </Box>
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {studentPhoto ? (
              <Avatar variant="rounded" sx={{ width: { xs: 56, sm: 72 }, height: { xs: 56, sm: 72 } }} src={studentPhoto} />
            ) : (
              <Avatar variant="rounded" sx={{ width: { xs: 56, sm: 72 }, height: { xs: 56, sm: 72 } }}>{studentName?.[0] || 'S'}</Avatar>
            )}
            <Button size="small" startIcon={<DownloadIcon />} onClick={async () => {
              if (!cardRef.current) return;
              const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true });

              const imgData = canvas.toDataURL('image/png');
              const pdf = new jsPDF('p', 'mm', 'a4');
              const pageWidth = pdf.internal.pageSize.getWidth();
              const pageHeight = pdf.internal.pageSize.getHeight();
              const imgWidth = pageWidth - 20; // margins
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              let y = 10;
              if (imgHeight <= pageHeight - 20) {
                pdf.addImage(imgData, 'PNG', 10, y, imgWidth, imgHeight);
              } else {
                // multi-page
                let remaining = imgHeight;
                let position = 0;
                while (remaining > 0) {
                  pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight, undefined, 'FAST');
                  remaining -= (pageHeight - 20);
                  position -= (pageHeight - 20);
                  if (remaining > 0) pdf.addPage();
                }
              }
              const fileName = `${student?.display_name || student?.name || 'student'}_due_slip.pdf`;
              pdf.save(fileName);
            }} sx={{ mt: 1 }}>
              Download
            </Button>
            <Button size="small" startIcon={<PrintIcon />} onClick={handlePrint} sx={{ mt: 1 }}>
              Print
            </Button>
          </Box>
        }
        sx={{ pb: 0.5 }}
      />
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Grid container spacing={{ xs: 2, sm: 3 }} rowSpacing={{ xs: 2, sm: 2.5 }}>
          <Grid item xs={12} sm={6} sx={{ pr: { sm: 2 } }}>
            <Typography variant="subtitle2" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>শিক্ষার্থী</Typography>
            <Typography variant="body1" sx={{ fontSize: { xs: '0.95rem', sm: '1rem' }, mb: 0.25 }}>{studentName}</Typography>
            {guardianName && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' }, mt: 0.25 }}>অভিভাবক: {guardianName}</Typography>
            )}
          </Grid>
          <Grid item xs={6} sm={3} sx={{ pr: { sm: 2 } }}>
            <Typography variant="subtitle2" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Class</Typography>
            <Typography variant="body1" sx={{ fontSize: { xs: '0.95rem', sm: '1rem' }, mt: 0.25 }}>{className || '-'}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="subtitle2" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Roll</Typography>
            <Typography variant="body1" sx={{ fontSize: { xs: '0.95rem', sm: '1rem' }, mt: 0.25 }}>{roll || '-'}</Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 1.5 }} />

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>Summary</Typography>
              <Box className="summary" sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 0.75 }}>
                {Object.entries(categoryTotals).map(([categoryName, total]) => (
                  <React.Fragment key={categoryName}>
                    <Typography color="text.secondary">{categoryName}</Typography>
                    <Typography>{fmt(total)}</Typography>
                  </React.Fragment>
                ))}
                <Divider sx={{ gridColumn: '1 / -1', my: 0.75 }} />
                <Typography fontWeight={600}>মোট</Typography>
                <Typography fontWeight={700}>{fmt(overallAmount)}</Typography>
              </Box>
              {(payments && payments.length > 0) && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    {(() => {
                      const dateStr = latestPayment?.date ? new Date(latestPayment.date).toLocaleDateString('bn-BD') : '-';
                      // Outstanding equals total charges minus all payments
                      const outstanding = Math.max(0, overallAmount - paymentsTotal);
                      return `Paid: ${fmt(paymentsTotal)} on ${dateStr} • New outstanding: ${fmt(outstanding)}`;
                    })()}
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
          {/* Removed Details table as requested */}
        </Grid>

        {payments && payments.length > 0 && (
          <Box className="section" sx={{ mt: 2, overflowX: 'auto' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>Payments</Typography>
            <table className="table" style={{ minWidth: 520 }}>
              <colgroup>
                <col className="item" />
                <col className="amount" />
                <col className="paid" />
                <col className="due" />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ fontSize: '0.85rem' }}>Date</th>
                  <th className="num" style={{ fontSize: '0.85rem' }}>Amount</th>
                  <th style={{ fontSize: '0.85rem' }}>Method</th>
                  <th style={{ fontSize: '0.85rem' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, idx) => (
                  <tr key={`pay-${idx}`}>
                    <td>{p.date ? (new Date(p.date)).toLocaleDateString() : '-'}</td>
                    <td className="num">{fmt(p.amount)}</td>
                    <td>{p.method || '-'}</td>
                    <td>{p.reference || p.note || ''}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ textAlign: 'right' }}><strong>Total</strong></td>
                  <td className="num"><strong>{fmt(paymentsTotal)}</strong></td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'right' }}><strong>Remaining</strong></td>
                  <td className="num"><strong>{fmt(Math.max(0, overallAmount - paymentsTotal))}</strong></td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}