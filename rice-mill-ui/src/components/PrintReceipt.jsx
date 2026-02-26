import { useState } from 'react';
import {
  Dialog, DialogContent, DialogActions, Button, Box, Typography,
  Divider, Grid, IconButton, Tooltip, CircularProgress, Alert
} from '@mui/material';
import { Print, Close, Receipt } from '@mui/icons-material';
import { getTransaction } from '../api';

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// ── Printable Receipt ─────────────────────────────────────────────────────
function ReceiptDoc({ txn, type }) {
  const isSale   = type === 'sale';
  const isCheque = txn.paymentMode?.toLowerCase() === 'cheque';
  const cheque   = txn.cheque;
  const party    = txn.party;

  const title = isSale
    ? (isCheque ? 'Cheque Receipt' : 'Cash Receipt')
    : (isCheque ? 'Cheque Payment Acknowledgment' : 'Cash Payment Voucher');

  const accentColor = isSale ? '#1e8449' : '#c0392b';
  const bgColor     = isSale ? '#eafaf1' : '#fdf2f2';

  const rows = [
    { label: 'Payment Mode',  value: txn.paymentMode === 'bank_transfer' ? 'Bank Transfer' : txn.paymentMode?.toUpperCase() },
    isCheque && cheque && { label: 'Cheque No.',    value: cheque.chequeNumber },
    isCheque && cheque && { label: 'Bank Name',     value: cheque.bankName },
    isCheque && cheque && { label: 'Cheque Date',   value: `${cheque.chequeDate}${cheque.isPostDated ? ' ⚠ Post-Dated' : ''}`,
                            color: cheque.isPostDated ? '#e67e22' : '#27ae60' },
    isCheque && cheque && { label: 'Cheque Status', value: cheque.status?.toUpperCase(),
                            color: cheque.status === 'cleared' ? '#27ae60' : cheque.status === 'bounced' ? '#e74c3c' : '#e67e22' },
    txn.reference  && { label: 'Reference',   value: txn.reference },
    txn.narration  && { label: 'Narration',   value: txn.narration },
  ].filter(Boolean);

  return (
    <Box id="receipt-print-area" sx={{
      width: '100%', maxWidth: 480, mx: 'auto',
      border: `2px solid ${accentColor}`, borderRadius: 2,
      p: 3, bgcolor: 'white',
    }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 1.5 }}>
        <Typography variant="h5" fontWeight="bold" color="#1a5276">🌾 Rice Mill</Typography>
        <Typography variant="caption" color="text.secondary">Accounts Management System</Typography>
        <Divider sx={{ mt: 1, borderColor: accentColor, borderWidth: 2 }} />
      </Box>

      {/* Title */}
      <Box sx={{ bgcolor: bgColor, textAlign: 'center', py: 0.8, borderRadius: 1, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ color: accentColor }}>
          {title}
        </Typography>
      </Box>

      {/* No + Date */}
      <Grid container sx={{ mb: 2 }}>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">No.</Typography>
          <Typography variant="body2" fontWeight="bold">{txn.txnNumber}</Typography>
        </Grid>
        <Grid item xs={6} sx={{ textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary">Date</Typography>
          <Typography variant="body2" fontWeight="bold">{String(txn.txnDate)}</Typography>
        </Grid>
      </Grid>

      <Divider sx={{ mb: 1.5 }} />

      {/* Party */}
      <Box sx={{ bgcolor: '#f8f9fa', p: 1.5, borderRadius: 1, mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {isSale ? 'Received From' : 'Paid To'}
        </Typography>
        <Typography variant="body1" fontWeight="bold">
          {party?.partyName || '—'}
        </Typography>
        {party?.phone && (
          <Typography variant="caption" color="text.secondary">{party.phone}</Typography>
        )}
      </Box>

      {/* Amount */}
      <Box sx={{ bgcolor: accentColor, color: 'white', p: 2, borderRadius: 2, mb: 2, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ opacity: 0.85 }}>
          {isSale ? 'Amount Received' : 'Amount Paid'}
        </Typography>
        <Typography variant="h4" fontWeight="bold">{fmt(txn.totalAmount)}</Typography>
      </Box>

      {/* Payment details table */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block" mb={0.5}>
          PAYMENT DETAILS
        </Typography>
        {rows.map((row, i) => (
          <Grid container key={i} sx={{ py: 0.5, borderBottom: '1px solid #f0f0f0' }}>
            <Grid item xs={5}>
              <Typography variant="caption" color="text.secondary">{row.label}</Typography>
            </Grid>
            <Grid item xs={7}>
              <Typography variant="caption" fontWeight="bold" sx={{ color: row.color || 'inherit' }}>
                {row.value}
              </Typography>
            </Grid>
          </Grid>
        ))}
      </Box>

      {/* PDC note */}
      {isCheque && cheque?.isPostDated && (
        <Box sx={{ bgcolor: '#fff8e1', border: '1px solid #f39c12', borderRadius: 1, p: 1.5, mb: 2 }}>
          <Typography variant="caption" color="warning.main" fontWeight="bold" display="block">
            ⚠ POST-DATED CHEQUE NOTE
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isSale
              ? `This cheque will be deposited on ${cheque.chequeDate}. Amount credited to bank after this date.`
              : `This cheque will be presented on ${cheque.chequeDate}. Amount debited from bank after this date.`}
          </Typography>
        </Box>
      )}

      {/* Signatures */}
      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid item xs={6} sx={{ textAlign: 'center' }}>
          <Box sx={{ borderTop: '1px dashed #aaa', pt: 0.5, mx: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {isSale ? "Receiver's Signature" : "Authorised Signature"}
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={6} sx={{ textAlign: 'center' }}>
          <Box sx={{ borderTop: '1px dashed #aaa', pt: 0.5, mx: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {isSale ? "Customer Signature" : "Supplier Signature"}
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Footer */}
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Divider sx={{ mb: 0.5 }} />
        <Typography variant="caption" color="text.secondary">
          Computer generated — Rice Mill Accounts System
        </Typography>
      </Box>
    </Box>
  );
}

// ── Print Button & Dialog ─────────────────────────────────────────────────
export default function PrintReceipt({ txnId, txnType }) {
  const [open,    setOpen]    = useState(false);
  const [txn,     setTxn]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const openDialog = async () => {
    setOpen(true);
    setError('');
    if (txn) return;
    setLoading(true);
    try {
      const res = await getTransaction(txnId);
      setTxn(res.data);
    } catch (e) {
      setError('Could not load transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const content = document.getElementById('receipt-print-area');
    if (!content) return;
    const w = window.open('', '_blank', 'width=600,height=850');
    w.document.write(`
      <html>
        <head>
          <title>Receipt ${txn?.txnNumber}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; padding: 16px; color: #222; }
            @media print { @page { size: A5 portrait; margin: 8mm; } }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  return (
    <>
      <Tooltip title="Print Receipt">
        <IconButton size="small" color="primary" onClick={openDialog}>
          <Receipt fontSize="small" />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <Box sx={{ display: 'flex', justifyContent: 'space-between',
                   alignItems: 'center', px: 3, pt: 2, pb: 1 }}>
          <Typography variant="h6" fontWeight="bold">Receipt Preview</Typography>
          <IconButton onClick={() => setOpen(false)}><Close /></IconButton>
        </Box>

        <DialogContent>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2, alignSelf: 'center' }}>Loading receipt...</Typography>
            </Box>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {txn && !loading && <ReceiptDoc txn={txn} type={txnType} />}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} variant="outlined">Close</Button>
          <Button onClick={handlePrint} variant="contained"
            startIcon={<Print />} disabled={!txn || loading}>
            Print Receipt
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
