import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField,
  MenuItem, Button, Alert, CircularProgress, Divider, Chip
} from '@mui/material';
import { Save } from '@mui/icons-material';
import dayjs from 'dayjs';
import { riceSale, getParties, getTransactions } from '../../api';
import PrintReceipt from '../../components/PrintReceipt';
import { DataGrid } from '@mui/x-data-grid';

const PAYMENT_MODES = [
  { value: 'cash',          label: 'Cash' },
  { value: 'credit',        label: 'Credit (Collect Later)' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
];

const DEBTOR_ACCOUNTS = [{ code: '15', label: '15 — Debtors' }];

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const today = dayjs().format('YYYY-MM-DD');

export default function RiceSale() {
  const [customers, setCustomers] = useState([]);
  const [history,   setHistory]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [success,   setSuccess]   = useState('');
  const [error,     setError]     = useState('');

  const [form, setForm] = useState({
    txnDate:           today,
    partyId:           '',
    amount:            '',
    paymentMode:       'cash',
    debtorAccountCode: '15',
    reference:         '',
    narration:         '',
    chequeNumber:      '',
    bankName:          '',
    chequeDate:        today,
  });

  useEffect(() => {
    getParties('customer').then(r => setCustomers(r.data));
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const res = await getTransactions({ type: 'sale' });
    setHistory(res.data || []);
  };

  // Auto-detect PDC: cheque date is in the future
  const isPostDated = form.paymentMode === 'cheque' && form.chequeDate > today;

  const drAccount = form.paymentMode === 'cash'          ? 'Cash (24)'
                  : form.paymentMode === 'credit'         ? `Debtors (15)`
                  : form.paymentMode === 'bank_transfer'  ? 'Bank Current (17.1)'
                  : form.paymentMode === 'cheque'
                    ? (isPostDated ? 'PDC Account (23) ← post-dated' : 'Bank Current (17.1) ← cleared today')
                  : 'Cash (24)';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      const payload = {
        txnDate:           form.txnDate,
        partyId:           parseInt(form.partyId),
        amount:            parseFloat(form.amount),
        paymentMode:       form.paymentMode,
        debtorAccountCode: form.paymentMode === 'credit' ? form.debtorAccountCode : null,
        reference:         form.reference,
        narration:         form.narration,
        chequeDetails:     form.paymentMode === 'cheque' ? {
          chequeNumber: form.chequeNumber,
          bankName:     form.bankName,
          chequeDate:   form.chequeDate,
        } : null,
      };
      const res = await riceSale(payload);
      setSuccess(`✓ ${res.data.message} — ${res.data.txnNumber}`);
      setForm(f => ({ ...f, amount: '', reference: '', narration: '', chequeNumber: '', bankName: '', chequeDate: today }));
      loadHistory();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  // History columns
  const columns = [
    { field: 'txnDate',     headerName: 'Date',        width: 100 },
    { field: 'txnNumber',   headerName: 'Invoice No.', width: 130 },
    { field: 'party',       headerName: 'Customer',    flex: 1 },
    { field: 'totalAmount', headerName: 'Total',       width: 120,
      renderCell: ({ value }) => fmt(value) },
    { field: 'paidAmount',  headerName: 'Paid',        width: 120,
      renderCell: ({ value }) => <span style={{ color: '#27ae60', fontWeight: 'bold' }}>{fmt(value)}</span> },
    { field: 'balanceDue',  headerName: 'Status',      width: 140,
      renderCell: ({ row }) => {
        const bal = (row.totalAmount || 0) - (row.paidAmount || 0);
        if (bal <= 0) return <Chip label="✓ Paid" size="small" color="success" />;
        if (row.paymentMode === 'cheque') return <Chip label="Cheque" size="small" color="warning" />;
        if (row.paymentMode === 'credit') return <Chip label={`Due ${fmt(bal)}`} size="small" color="error" />;
        return <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>{fmt(bal)}</span>;
      }
    },
    { field: 'actions', headerName: '', width: 60, sortable: false,
      renderCell: ({ row }) => (
        <PrintReceipt txnId={row.txnId} txnType="sale" />
      )
    },
    { field: 'paymentMode', headerName: 'Mode',        width: 110,
      renderCell: ({ value }) => (
        <Chip size="small" variant="outlined"
          label={value}
          color={value === 'cash' ? 'default' : value === 'credit' ? 'error' :
                 value === 'cheque' ? 'warning' : 'info'} />
      )
    },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={3}>Rice Sale</Typography>
      <Grid container spacing={3}>

        {/* ── Form ── */}
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2} color="success.main">
                New Sale Entry
              </Typography>

              {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
              {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}

              <form onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField fullWidth type="date" label="Sale Date" required
                      value={form.txnDate} InputLabelProps={{ shrink: true }}
                      onChange={(e) => setForm({ ...form, txnDate: e.target.value })} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth select label="Customer" required value={form.partyId}
                      onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
                      {customers.map(c => (
                        <MenuItem key={c.partyId} value={c.partyId}>{c.partyName}</MenuItem>
                      ))}
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
                      {PAYMENT_MODES.map(m => (
                        <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  {/* Credit — debtor account */}
                  {form.paymentMode === 'credit' && (
                    <Grid item xs={12}>
                      <TextField fullWidth select label="Debtor Account" value={form.debtorAccountCode}
                        onChange={(e) => setForm({ ...form, debtorAccountCode: e.target.value })}>
                        {DEBTOR_ACCOUNTS.map(d => (
                          <MenuItem key={d.code} value={d.code}>{d.label}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  )}

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
                      <Grid item xs={12}>
                        <TextField fullWidth type="date" label="Cheque Date" required
                          value={form.chequeDate} InputLabelProps={{ shrink: true }}
                          onChange={(e) => setForm({ ...form, chequeDate: e.target.value })}
                          helperText={isPostDated
                            ? '⚠ Post-Dated Cheque — will go to PDC Account (23) until cleared'
                            : '✓ Today\'s date — will go directly to Bank (17.1)'}
                          FormHelperTextProps={{ sx: { color: isPostDated ? 'warning.main' : 'success.main', fontWeight: 'bold' } }}
                        />
                      </Grid>
                      {/* PDC info banner */}
                      {isPostDated && (
                        <Grid item xs={12}>
                          <Alert severity="warning" sx={{ py: 0.5 }}>
                            Post-Dated Cheque detected! Amount held in PDC Account (23).
                            Go to <strong>Cheques</strong> page on <strong>{form.chequeDate}</strong> to clear it → moves to Bank.
                          </Alert>
                        </Grid>
                      )}
                    </>
                  )}

                  <Grid item xs={12}>
                    <TextField fullWidth label="Bill / Reference No." value={form.reference}
                      onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Narration" multiline rows={2}
                      value={form.narration}
                      onChange={(e) => setForm({ ...form, narration: e.target.value })} />
                  </Grid>

                  {/* Auto journal preview */}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ bgcolor: isPostDated ? '#fff8e1' : '#f0fff4',
                               border: `1px solid ${isPostDated ? '#f39c12' : '#27ae60'}`,
                               p: 1.5, borderRadius: 2, mb: 2 }}>
                      <Typography variant="caption" fontWeight="bold" color="text.secondary">
                        AUTO JOURNAL POSTING:
                      </Typography>
                      <Typography variant="body2" mt={0.5}>
                        <strong>DR</strong> {drAccount} &nbsp;
                        {form.amount ? fmt(form.amount) : '---'}
                      </Typography>
                      <Typography variant="body2">
                        <strong>CR</strong> Sales (7) &nbsp;
                        {form.amount ? fmt(form.amount) : '---'}
                      </Typography>
                      {isPostDated && (
                        <Typography variant="caption" color="warning.main" display="block" mt={0.5}>
                          On {form.chequeDate}: DR Bank (17.1) / CR PDC (23) — when cleared
                        </Typography>
                      )}
                    </Box>
                    <Button fullWidth variant="contained" type="submit" size="large"
                      color="success"
                      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Save />}
                      disabled={loading}>
                      Save Sale
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* ── History ── */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>Sales History</Typography>
              <DataGrid
                rows={history} getRowId={(r) => r.txnId}
                columns={columns} autoHeight
                pageSizeOptions={[10, 25]}
                initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
