import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField, MenuItem,
  Button, Alert, CircularProgress, Divider, Tabs, Tab, Chip,
  IconButton, Tooltip, Table, TableHead, TableBody, TableRow,
  TableCell, TableContainer, Dialog, DialogTitle, DialogContent,
  DialogActions, Badge
} from '@mui/material';
import { Save, MonetizationOn, Payment, Refresh } from '@mui/icons-material';
import dayjs from 'dayjs';
import { recordReceipt, recordPayment, getParties, getTransactions } from '../../api';
import PrintReceipt from '../../components/PrintReceipt';
import { DataGrid } from '@mui/x-data-grid';

const PAYMENT_MODES = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
];

const DEBTOR_ACCOUNTS   = [{ code: '15',     label: '15 — Debtors' }];
const CREDITOR_ACCOUNTS = [
  { code: '16.1.1', label: '16.1.1 — Paddy Creditors' },
  { code: '16.1.2', label: '16.1.2 — Other Creditors' },
  { code: '16.1.3', label: '16.1.3 — Financial Creditors' },
];

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// ── Outstanding Table ────────────────────────────────────────────────────
function OutstandingTable({ mode, onCollect }) {
  const isReceipt = mode === 'receipt';
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // Load credit sales (for receipt) or credit purchases (for payment)
      const txnType = isReceipt ? 'sale' : 'purchase';
      const res = await getTransactions({ type: txnType, paymentMode: 'credit' });
      // Only show those with balance due > 0
      const outstanding = (res.data || []).filter(t => (t.balanceDue || 0) > 0);
      setRows(outstanding);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [mode]);

  const columns = [
    { field: 'txnDate',    headerName: 'Date',        width: 110 },
    { field: 'txnNumber',  headerName: isReceipt ? 'Invoice No.' : 'Purchase No.', width: 140 },
    { field: 'party',      headerName: isReceipt ? 'Customer' : 'Supplier', flex: 1 },
    { field: 'totalAmount',headerName: 'Total',       width: 130,
      renderCell: ({ value }) => fmt(value) },
    { field: 'paidAmount', headerName: 'Paid',        width: 120,
      renderCell: ({ value }) => <Typography color="success.main">{fmt(value)}</Typography> },
    { field: 'balanceDue', headerName: 'Balance Due', width: 140,
      renderCell: ({ value }) => (
        <Typography fontWeight="bold" color="error.main">{fmt(value)}</Typography>
      )
    },
    { field: 'days', headerName: 'Days', width: 80,
      renderCell: ({ row }) => {
        const days = dayjs().diff(dayjs(row.txnDate), 'day');
        return <Chip label={`${days}d`} size="small"
          color={days > 30 ? 'error' : days > 15 ? 'warning' : 'default'} />;
      }
    },
    { field: 'action', headerName: '', width: 130, sortable: false,
      renderCell: ({ row }) => (
        <Button size="small" variant="contained"
          color={isReceipt ? 'success' : 'error'}
          startIcon={isReceipt ? <MonetizationOn /> : <Payment />}
          onClick={() => onCollect(row)}>
          {isReceipt ? 'Collect' : 'Pay'}
        </Button>
      )
    }
  ];

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" fontWeight="bold">
            {isReceipt ? 'Outstanding Sales (Credit)' : 'Outstanding Purchases (Credit)'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {rows.length > 0 && (
              <Chip label={`${rows.length} pending — ${fmt(rows.reduce((s,r) => s + (r.balanceDue||0), 0))}`}
                color="error" size="small" />
            )}
            <IconButton size="small" onClick={load}><Refresh fontSize="small" /></IconButton>
          </Box>
        </Box>
        <DataGrid
          rows={rows} getRowId={(r) => r.txnId}
          columns={columns} autoHeight loading={loading}
          pageSizeOptions={[10, 25]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={{
            '& .MuiDataGrid-row:hover': { cursor: 'default' }
          }}
        />
      </CardContent>
    </Card>
  );
}

// ── Receipt / Payment Form ───────────────────────────────────────────────
function ReceiptPaymentForm({ mode, prefill, onPrefillUsed }) {
  const isReceipt = mode === 'receipt';
  const [parties, setParties]   = useState([]);
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState('');
  const [error,   setError]     = useState('');

  const blankForm = {
    txnDate:          dayjs().format('YYYY-MM-DD'),
    partyId:          '',
    partyAccountCode: isReceipt ? '15' : '16.1.1',
    amount:           '',
    paymentMode:      'cash',
    isPostDated:      false,
    reference:        '',
    narration:        '',
    chequeNumber:     '',
    bankName:         '',
    chequeDate:       dayjs().format('YYYY-MM-DD'),
    linkedTxnId:      null,
  };

  const [form, setForm] = useState(blankForm);

  // When a row is clicked in outstanding table, prefill the form
  useEffect(() => {
    if (prefill) {
      setForm(f => ({
        ...f,
        partyId:     prefill.partyId   || '',
        amount:      prefill.balanceDue || '',
        reference:   prefill.txnNumber  || '',
        narration:   `${isReceipt ? 'Receipt against' : 'Payment against'} ${prefill.txnNumber}`,
        linkedTxnId: prefill.txnId,
      }));
      onPrefillUsed?.();
      // Scroll to form
      document.getElementById('receipt-form-card')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [prefill]);

  useEffect(() => {
    getParties(isReceipt ? 'customer' : 'supplier').then(r => setParties(r.data));
    loadHistory();
  }, [mode]);

  const loadHistory = async () => {
    const res = await getTransactions({ type: mode });
    setHistory(res.data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      const payload = {
        txnDate:          form.txnDate,
        partyId:          parseInt(form.partyId),
        partyAccountCode: form.partyAccountCode,
        amount:           parseFloat(form.amount),
        paymentMode:      form.paymentMode,
        isPostDated:      form.isPostDated,
        reference:        form.reference,
        narration:        form.narration,
        linkedTxnId:      form.linkedTxnId || null,
        chequeDetails: form.paymentMode === 'cheque' ? {
          chequeNumber: form.chequeNumber,
          bankName:     form.bankName,
          chequeDate:   form.chequeDate,
        } : null,
      };
      const fn = isReceipt ? recordReceipt : recordPayment;
      const res = await fn(payload);
      setSuccess(`✓ ${isReceipt ? 'Receipt' : 'Payment'} recorded — ${res.data.txnNumber}`);
      setForm(blankForm);
      loadHistory();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  const accounts = isReceipt ? DEBTOR_ACCOUNTS : CREDITOR_ACCOUNTS;

  const drLine = isReceipt
    ? (form.paymentMode === 'bank_transfer' ? 'Bank Current (17.1)'
       : form.paymentMode === 'cheque' ? (form.isPostDated ? 'PDC Account (23)' : 'Bank (17.1)')
       : 'Cash (24)')
    : form.partyAccountCode;

  const crLine = isReceipt
    ? form.partyAccountCode
    : (form.paymentMode === 'bank_transfer' || form.paymentMode === 'cheque'
       ? 'Bank Current (17.1)' : 'Cash (24)');

  const historyColumns = [
    { field: 'txnDate',    headerName: 'Date',    width: 110 },
    { field: 'txnNumber',  headerName: 'Ref No.', width: 140 },
    { field: 'party',      headerName: 'Party',   flex: 1 },
    { field: 'totalAmount',headerName: 'Amount',  width: 130, renderCell: ({ value }) => fmt(value) },
    { field: 'paymentMode',headerName: 'Mode',    width: 120 },
    { field: 'actions', headerName: '', width: 60, sortable: false,
      renderCell: ({ row }) => (
        <PrintReceipt txnId={row.txnId} txnType={isReceipt ? 'receipt' : 'payment'} />
      )
    },
  ];

  return (
    <Grid container spacing={3}>
      {/* Form */}
      <Grid item xs={12} md={5}>
        <Card id="receipt-form-card"
          sx={{ border: form.linkedTxnId ? '2px solid #27ae60' : 'none' }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" mb={1}
              color={isReceipt ? 'success.main' : 'error.main'}>
              New {isReceipt ? 'Receipt' : 'Payment'}
            </Typography>

            {/* Show linked invoice banner */}
            {form.linkedTxnId && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Linked to invoice: <strong>{form.reference}</strong> — amount pre-filled
              </Alert>
            )}

            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
            {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}

            <form onSubmit={handleSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth type="date" label="Date" required
                    value={form.txnDate} InputLabelProps={{ shrink: true }}
                    onChange={(e) => setForm({ ...form, txnDate: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth select label={isReceipt ? 'Customer' : 'Supplier'} required
                    value={form.partyId}
                    onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
                    {parties.map(p =>
                      <MenuItem key={p.partyId} value={p.partyId}>{p.partyName}</MenuItem>
                    )}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth select
                    label={isReceipt ? 'Debtor Account' : 'Creditor Account'} required
                    value={form.partyAccountCode}
                    onChange={(e) => setForm({ ...form, partyAccountCode: e.target.value })}>
                    {accounts.map(a =>
                      <MenuItem key={a.code} value={a.code}>{a.label}</MenuItem>
                    )}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Amount (Rs.)" type="number" required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    inputProps={{ min: 0, step: 0.01 }} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth select label="Payment Mode" required
                    value={form.paymentMode}
                    onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
                    {PAYMENT_MODES.map(m =>
                      <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                    )}
                  </TextField>
                </Grid>

                {/* Cheque fields */}
                {form.paymentMode === 'cheque' && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Cheque Number" required
                        value={form.chequeNumber}
                        onChange={(e) => setForm({ ...form, chequeNumber: e.target.value })} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Bank Name" required
                        value={form.bankName}
                        onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth type="date" label="Cheque Date" required
                        value={form.chequeDate} InputLabelProps={{ shrink: true }}
                        onChange={(e) => setForm({ ...form, chequeDate: e.target.value })} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth select label="Post-Dated?"
                        value={form.isPostDated}
                        onChange={(e) => setForm({ ...form, isPostDated: e.target.value === 'true' })}>
                        <MenuItem value={false}>No</MenuItem>
                        <MenuItem value={true}>Yes (PDC)</MenuItem>
                      </TextField>
                    </Grid>
                  </>
                )}

                <Grid item xs={12}>
                  <TextField fullWidth label="Reference" value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Narration" multiline rows={2}
                    value={form.narration}
                    onChange={(e) => setForm({ ...form, narration: e.target.value })} />
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ bgcolor: isReceipt ? '#f0fff4' : '#fff5f5',
                             p: 1.5, borderRadius: 2, mb: 2 }}>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary">
                      AUTO JOURNAL POSTING:
                    </Typography>
                    <Typography variant="body2">
                      DR {drLine} &nbsp; {form.amount ? fmt(form.amount) : '---'}
                    </Typography>
                    <Typography variant="body2">
                      CR {crLine} &nbsp; {form.amount ? fmt(form.amount) : '---'}
                    </Typography>
                  </Box>
                  <Button fullWidth variant="contained" type="submit" size="large"
                    color={isReceipt ? 'success' : 'error'}
                    startIcon={loading
                      ? <CircularProgress size={18} color="inherit" />
                      : <Save />}
                    disabled={loading}>
                    Save {isReceipt ? 'Receipt' : 'Payment'}
                  </Button>
                  {form.linkedTxnId && (
                    <Button fullWidth variant="text" size="small" sx={{ mt: 1 }}
                      onClick={() => setForm(blankForm)}>
                      Clear & start fresh
                    </Button>
                  )}
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>
      </Grid>

      {/* History */}
      <Grid item xs={12} md={7}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" mb={2}>
              {isReceipt ? 'Receipt' : 'Payment'} History
            </Typography>
            <DataGrid
              rows={history} getRowId={(r) => r.txnId}
              columns={historyColumns} autoHeight
              pageSizeOptions={[10, 25]}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────
export default function ReceiptPayment({ mode }) {
  const [tab,     setTab]     = useState(mode || 'receipt');
  const [subTab,  setSubTab]  = useState('outstanding'); // outstanding | form
  const [prefill, setPrefill] = useState(null);

  // When mode prop changes (receipt vs payment route), reset
  useEffect(() => {
    setTab(mode || 'receipt');
    setSubTab('outstanding');
    setPrefill(null);
  }, [mode]);

  const handleCollect = (row) => {
    setPrefill(row);
    setSubTab('form');   // switch to form tab
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={2}>Receipt & Payment</Typography>

      {/* Receipt / Payment toggle */}
      <Tabs value={tab} onChange={(_, v) => { setTab(v); setSubTab('outstanding'); setPrefill(null); }}
        sx={{ mb: 2 }}>
        <Tab label="Receipt (Collect from Customer)" value="receipt" />
        <Tab label="Payment (Pay to Supplier)"       value="payment" />
      </Tabs>

      {/* Outstanding / New Entry sub-tabs */}
      <Tabs value={subTab} onChange={(_, v) => setSubTab(v)}
        sx={{ mb: 3 }}
        textColor="secondary" indicatorColor="secondary">
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {tab === 'receipt' ? 'Outstanding Sales' : 'Outstanding Purchases'}
              <Chip label="Click to collect" size="small" color="warning" />
            </Box>
          }
          value="outstanding"
        />
        <Tab label="New Entry (Manual)" value="form" />
      </Tabs>

      {subTab === 'outstanding' && (
        <OutstandingTable mode={tab} onCollect={handleCollect} />
      )}

      {subTab === 'form' && (
        <ReceiptPaymentForm
          mode={tab}
          prefill={prefill}
          onPrefillUsed={() => setPrefill(null)}
        />
      )}
    </Box>
  );
}
