import { useState } from 'react';
import {
  Dialog, DialogContent, DialogActions, Button, Box, Typography,
  IconButton, Tooltip, CircularProgress, Alert
} from '@mui/material';
import { Print, Close, Receipt } from '@mui/icons-material';
import { getTransaction } from '../api';

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// ── Generates a fully self-contained HTML string (no external CSS needed) ──
function buildReceiptHTML(txn, type) {
  const isSale   = type === 'sale';
  const isCheque = txn.paymentMode?.toLowerCase() === 'cheque';
  const cheque   = txn.cheque;
  const party    = txn.party;

  const docTitle    = isSale
    ? (isCheque ? 'CHEQUE RECEIPT' : 'CASH RECEIPT')
    : (isCheque ? 'CHEQUE PAYMENT VOUCHER' : 'PAYMENT VOUCHER');
  const accentColor = isSale ? '#145a32' : '#7b241c';
  const lightBg     = isSale ? '#f0faf4' : '#fdf5f5';
  const borderColor = isSale ? '#1e8449' : '#c0392b';
  const amountIcon  = isSale ? '💰' : '💳';

  const paymentMode = (txn.paymentMode || '—')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  const detailRows = [
    { label: 'Payment Mode',  value: paymentMode },
    isCheque && cheque && { label: 'Cheque No.',    value: cheque.chequeNumber },
    isCheque && cheque && { label: 'Bank Name',     value: cheque.bankName },
    isCheque && cheque && {
      label: 'Cheque Date',
      value: `${cheque.chequeDate}${cheque.isPostDated ? '  ⚠ Post-Dated' : ''}`,
      color: cheque.isPostDated ? '#d35400' : '#1e8449',
    },
    isCheque && cheque && {
      label: 'Cheque Status',
      value: (cheque.status || '').toUpperCase(),
      color: cheque.status === 'cleared' ? '#1e8449'
           : cheque.status === 'bounced' ? '#c0392b' : '#d35400',
    },
    txn.reference && { label: 'Reference No.', value: txn.reference },
    txn.narration && { label: 'Narration',      value: txn.narration },
  ].filter(Boolean);

  const detailRowsHTML = detailRows.map((row, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#fafafa'};">
      <td style="padding:7px 12px;font-size:11.5px;color:#555;border-bottom:1px solid #f0f0f0;width:50%;">${row.label}</td>
      <td style="padding:7px 12px;font-size:11.5px;font-weight:600;color:${row.color || '#111'};border-bottom:1px solid #f0f0f0;">${row.value || '—'}</td>
    </tr>
  `).join('');

  const pdcHTML = (isCheque && cheque?.isPostDated) ? `
    <div style="border:1px solid #f39c12;background:#fffbf0;border-radius:6px;padding:12px 14px;margin-bottom:20px;display:flex;gap:10px;align-items:flex-start;">
      <span style="font-size:15px;line-height:1.4;">⚠️</span>
      <div>
        <div style="font-size:11px;font-weight:700;color:#b7770d;margin-bottom:3px;">POST-DATED CHEQUE</div>
        <div style="font-size:10.5px;color:#7d5a0a;line-height:1.5;">
          ${isSale
            ? `This cheque will be deposited on ${cheque.chequeDate}. Amount will be credited after clearance.`
            : `This cheque will be presented on ${cheque.chequeDate}. Amount will be debited after clearance.`}
        </div>
      </div>
    </div>
  ` : '';

  const printDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Receipt — ${txn.txnNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      background: #f0f0f0;
      display: flex;
      justify-content: center;
      padding: 24px 16px;
      color: #111;
    }
    .bill {
      width: 520px;
      background: white;
      border: 1px solid ${borderColor};
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    }
    table { width: 100%; border-collapse: collapse; }
    @media print {
      @page { size: A5 portrait; margin: 8mm; }
      body { background: white; padding: 0; display: block; }
      .bill {
        box-shadow: none;
        border-radius: 0;
        width: 100%;
        border: 1px solid ${borderColor};
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
<div class="bill">

  <!-- TOP BAR -->
  <div style="height:8px;background:${accentColor};"></div>

  <!-- COMPANY HEADER -->
  <div style="background:${accentColor};color:white;padding:18px 24px;display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="font-size:22px;font-weight:700;letter-spacing:1px;">🌾 RICE MILL</div>
      <div style="font-size:10px;opacity:0.8;margin-top:2px;">Accounts Management System</div>
    </div>
    <div style="border:1.5px solid rgba(255,255,255,0.6);border-radius:4px;padding:5px 12px;text-align:right;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:white;">${docTitle}</div>
    </div>
  </div>

  <!-- VOUCHER META -->
  <div style="background:${lightBg};padding:10px 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid ${borderColor};">
    <div>
      <div style="font-size:10px;color:#777;text-transform:uppercase;letter-spacing:0.8px;">Voucher No.</div>
      <div style="font-size:15px;font-weight:700;color:${accentColor};letter-spacing:0.5px;">${txn.txnNumber}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;color:#777;text-transform:uppercase;letter-spacing:0.8px;">Date</div>
      <div style="font-size:15px;font-weight:700;color:#222;">${String(txn.txnDate)}</div>
    </div>
  </div>

  <!-- BODY -->
  <div style="padding:20px 24px;">

    <!-- Party Box -->
    <div style="border:1px solid #ddd;border-radius:4px;margin-bottom:18px;overflow:hidden;">
      <div style="background:#f5f5f5;padding:5px 12px;border-bottom:1px solid #ddd;">
        <span style="font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1px;">
          ${isSale ? 'Received From' : 'Paid To'}
        </span>
      </div>
      <div style="padding:10px 12px;">
        <div style="font-size:16px;font-weight:700;color:#111;">${party?.partyName || '—'}</div>
        ${party?.phone   ? `<div style="font-size:11px;color:#666;margin-top:3px;">📞 ${party.phone}</div>` : ''}
        ${party?.address ? `<div style="font-size:11px;color:#666;margin-top:2px;">📍 ${party.address}</div>` : ''}
      </div>
    </div>

    <!-- Amount Block -->
    <div style="background:${accentColor};color:white;border-radius:8px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
      <div>
        <div style="font-size:10px;opacity:0.8;text-transform:uppercase;letter-spacing:1px;">
          ${isSale ? 'Amount Received' : 'Amount Paid'}
        </div>
        <div style="font-size:26px;font-weight:700;margin-top:4px;letter-spacing:0.5px;">${fmt(txn.totalAmount)}</div>
      </div>
      <div style="width:50px;height:50px;border-radius:50%;border:2px solid rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;font-size:22px;">
        ${amountIcon}
      </div>
    </div>

    <!-- Payment Details Table -->
    <div style="border:1px solid #e0e0e0;border-radius:4px;overflow:hidden;margin-bottom:18px;">
      <table>
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:6px 12px;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:1px solid #e0e0e0;">Particulars</th>
            <th style="padding:6px 12px;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:1px solid #e0e0e0;">Details</th>
          </tr>
        </thead>
        <tbody>
          ${detailRowsHTML}
          <tr>
            <td style="padding:9px 12px;font-size:12px;font-weight:700;color:#333;background:${lightBg};border-top:2px solid ${borderColor};">Total Amount</td>
            <td style="padding:9px 12px;font-size:12px;font-weight:700;color:${accentColor};background:${lightBg};border-top:2px solid ${borderColor};">${fmt(txn.totalAmount)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- PDC Warning -->
    ${pdcHTML}

    <!-- Signatures -->
    <div style="display:flex;gap:32px;margin-top:28px;padding-top:16px;border-top:1px dashed #ccc;">
      <div style="flex:1;text-align:center;">
        <div style="height:36px;"></div>
        <div style="border-top:1px solid #bbb;padding-top:5px;">
          <span style="font-size:10px;color:#888;">${isSale ? 'Authorised Signature' : 'Authorised Signature'}</span>
        </div>
      </div>
      <div style="flex:1;text-align:center;">
        <div style="height:36px;"></div>
        <div style="border-top:1px solid #bbb;padding-top:5px;">
          <span style="font-size:10px;color:#888;">${isSale ? 'Customer Signature' : 'Supplier Signature'}</span>
        </div>
      </div>
    </div>

  </div>

  <!-- FOOTER -->
  <div style="background:#f9f9f9;border-top:1px solid #e0e0e0;padding:8px 24px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:9.5px;color:#aaa;">Computer Generated Receipt — Rice Mill Accounts System</span>
    <span style="font-size:9.5px;color:#aaa;">${printDate}</span>
  </div>

  <!-- BOTTOM BAR -->
  <div style="height:5px;background:${accentColor};"></div>

</div>
</body>
</html>`;
}

// ── MUI Preview (screen only, matches the print layout visually) ──────────
function ReceiptDoc({ txn, type }) {
  const isSale      = type === 'sale';
  const isCheque    = txn.paymentMode?.toLowerCase() === 'cheque';
  const cheque      = txn.cheque;
  const party       = txn.party;
  const accentColor = isSale ? '#145a32' : '#7b241c';
  const lightBg     = isSale ? '#f0faf4' : '#fdf5f5';
  const borderColor = isSale ? '#1e8449' : '#c0392b';
  const docTitle    = isSale
    ? (isCheque ? 'CHEQUE RECEIPT' : 'CASH RECEIPT')
    : (isCheque ? 'CHEQUE PAYMENT VOUCHER' : 'PAYMENT VOUCHER');

  const paymentMode = (txn.paymentMode || '—')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  const detailRows = [
    { label: 'Payment Mode',  value: paymentMode },
    isCheque && cheque && { label: 'Cheque No.',    value: cheque.chequeNumber },
    isCheque && cheque && { label: 'Bank Name',     value: cheque.bankName },
    isCheque && cheque && {
      label: 'Cheque Date',
      value: `${cheque.chequeDate}${cheque.isPostDated ? '  ⚠ Post-Dated' : ''}`,
      color: cheque.isPostDated ? '#d35400' : '#1e8449',
    },
    isCheque && cheque && {
      label: 'Cheque Status',
      value: (cheque.status || '').toUpperCase(),
      color: cheque.status === 'cleared' ? '#1e8449'
           : cheque.status === 'bounced' ? '#c0392b' : '#d35400',
    },
    txn.reference && { label: 'Reference No.', value: txn.reference },
    txn.narration && { label: 'Narration',      value: txn.narration },
  ].filter(Boolean);

  return (
    <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto', bgcolor: 'white',
               fontFamily: '"Georgia", serif', border: `1px solid ${borderColor}`,
               borderRadius: '4px', overflow: 'hidden' }}>
      <Box sx={{ height: 8, bgcolor: accentColor }} />
      <Box sx={{ bgcolor: accentColor, color: 'white', px: 3, py: 2.5,
                 display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 700, letterSpacing: 1, fontFamily: 'Georgia, serif' }}>🌾 RICE MILL</Typography>
          <Typography sx={{ fontSize: 10, opacity: 0.8, mt: 0.2 }}>Accounts Management System</Typography>
        </Box>
        <Box sx={{ border: '1.5px solid rgba(255,255,255,0.6)', borderRadius: 1, px: 1.5, py: 0.5 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'white' }}>{docTitle}</Typography>
        </Box>
      </Box>

      <Box sx={{ bgcolor: lightBg, px: 3, py: 1.5, display: 'flex', justifyContent: 'space-between',
                 alignItems: 'center', borderBottom: `1px solid ${borderColor}` }}>
        <Box>
          <Typography sx={{ fontSize: 10, color: '#777', textTransform: 'uppercase', letterSpacing: 0.8 }}>Voucher No.</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: accentColor }}>{txn.txnNumber}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 10, color: '#777', textTransform: 'uppercase', letterSpacing: 0.8 }}>Date</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{String(txn.txnDate)}</Typography>
        </Box>
      </Box>

      <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
        <Box sx={{ border: '1px solid #ddd', borderRadius: 1, mb: 2.5, overflow: 'hidden' }}>
          <Box sx={{ bgcolor: '#f5f5f5', px: 1.5, py: 0.6, borderBottom: '1px solid #ddd' }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#555', letterSpacing: 1, textTransform: 'uppercase' }}>
              {isSale ? 'Received From' : 'Paid To'}
            </Typography>
          </Box>
          <Box sx={{ px: 1.5, py: 1.2 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{party?.partyName || '—'}</Typography>
            {party?.phone   && <Typography sx={{ fontSize: 11, color: '#666', mt: 0.3 }}>📞 {party.phone}</Typography>}
            {party?.address && <Typography sx={{ fontSize: 11, color: '#666', mt: 0.2 }}>📍 {party.address}</Typography>}
          </Box>
        </Box>

        <Box sx={{ bgcolor: accentColor, color: 'white', borderRadius: 1.5, px: 2.5, py: 2,
                   display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Box>
            <Typography sx={{ fontSize: 10, opacity: 0.8, letterSpacing: 1, textTransform: 'uppercase' }}>
              {isSale ? 'Amount Received' : 'Amount Paid'}
            </Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 700, fontFamily: 'Georgia, serif', lineHeight: 1.2, mt: 0.3 }}>
              {fmt(txn.totalAmount)}
            </Typography>
          </Box>
          <Box sx={{ width: 50, height: 50, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)',
                     display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            {isSale ? '💰' : '💳'}
          </Box>
        </Box>

        <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden', mb: 2.5 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Particulars</th>
                <th style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '7px 12px', fontSize: 11.5, color: '#555', borderBottom: '1px solid #f0f0f0', width: '50%' }}>{row.label}</td>
                  <td style={{ padding: '7px 12px', fontSize: 11.5, fontWeight: 600, color: row.color || '#111', borderBottom: '1px solid #f0f0f0' }}>{row.value || '—'}</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 700, color: '#333', background: lightBg, borderTop: `2px solid ${borderColor}` }}>Total Amount</td>
                <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 700, color: accentColor, background: lightBg, borderTop: `2px solid ${borderColor}` }}>{fmt(txn.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </Box>

        {isCheque && cheque?.isPostDated && (
          <Box sx={{ border: '1px solid #f39c12', bgcolor: '#fffbf0', borderRadius: 1, px: 2, py: 1.2, mb: 2.5, display: 'flex', gap: 1 }}>
            <Typography sx={{ fontSize: 15 }}>⚠️</Typography>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#b7770d' }}>POST-DATED CHEQUE</Typography>
              <Typography sx={{ fontSize: 10.5, color: '#7d5a0a', mt: 0.3, lineHeight: 1.5 }}>
                {isSale
                  ? `This cheque will be deposited on ${cheque.chequeDate}. Amount credited after clearance.`
                  : `This cheque will be presented on ${cheque.chequeDate}. Amount debited after clearance.`}
              </Typography>
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 4, mt: 3.5, pt: 2, borderTop: '1px dashed #ccc' }}>
          {[isSale ? 'Authorised Signature' : 'Authorised Signature', isSale ? 'Customer Signature' : 'Supplier Signature'].map((label, i) => (
            <Box key={i} sx={{ flex: 1, textAlign: 'center' }}>
              <Box sx={{ height: 36 }} />
              <Box sx={{ borderTop: '1px solid #bbb', pt: 0.6 }}>
                <Typography sx={{ fontSize: 10, color: '#888' }}>{label}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ bgcolor: '#f9f9f9', borderTop: '1px solid #e0e0e0', px: 3, py: 1.2,
                 display: 'flex', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 9.5, color: '#aaa' }}>Computer Generated Receipt — Rice Mill Accounts System</Typography>
        <Typography sx={{ fontSize: 9.5, color: '#aaa' }}>
          {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Typography>
      </Box>
      <Box sx={{ height: 5, bgcolor: accentColor }} />
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
    setOpen(true); setError('');
    if (txn) return;
    setLoading(true);
    try {
      const res = await getTransaction(txnId);
      setTxn(res.data);
    } catch { setError('Could not load transaction. Please try again.'); }
    finally   { setLoading(false); }
  };

  const handlePrint = () => {
    if (!txn) return;
    // Write a fully self-contained HTML page — zero dependency on MUI or React
    const html = buildReceiptHTML(txn, txnType);
    const w = window.open('', '_blank', 'width=640,height=900');
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    // Small delay lets the browser fully render before triggering print
    setTimeout(() => { w.print(); }, 600);
  };

  return (
    <>
      <Tooltip title="Print Receipt">
        <IconButton size="small" color="primary" onClick={openDialog}>
          <Receipt fontSize="small" />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                   px: 3, pt: 2, pb: 1, borderBottom: '1px solid #eee' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Receipt color="primary" />
            <Typography variant="h6" fontWeight="bold">Receipt Preview</Typography>
          </Box>
          <IconButton onClick={() => setOpen(false)} size="small"><Close /></IconButton>
        </Box>

        <DialogContent sx={{ bgcolor: '#f4f4f4', p: 3 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6, gap: 2 }}>
              <CircularProgress size={24} />
              <Typography color="text.secondary">Loading receipt…</Typography>
            </Box>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {txn && !loading && <ReceiptDoc txn={txn} type={txnType} />}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #eee', gap: 1 }}>
          <Button onClick={() => setOpen(false)} variant="outlined" color="inherit">Close</Button>
          <Button onClick={handlePrint} variant="contained" startIcon={<Print />}
            disabled={!txn || loading} sx={{ minWidth: 160 }}>
            Print / Save PDF
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
