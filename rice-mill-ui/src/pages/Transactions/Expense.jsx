import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField,
  MenuItem, Button, Alert, CircularProgress, Divider
} from '@mui/material';
import { Save } from '@mui/icons-material';
import dayjs from 'dayjs';
import { recordExpense, getParties, getTransactions } from '../../api';
import { DataGrid } from '@mui/x-data-grid';

const EXPENSE_ACCOUNTS = [
  { code: '10', label: '10 — Administrative Expenses' },
  { code: '11', label: '11 — Selling & Distribution Expense' },
  { code: '12', label: '12 — Financial Expense' },
  { code: '13', label: '13 — General Expense' },
  { code: '14', label: '14 — Production Expense' },
  { code: '22', label: '22 — Miscellaneous' },
];

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function Expense() {
  const [parties, setParties] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    txnDate: dayjs().format('YYYY-MM-DD'),
    expenseAccountCode: '10',
    amount: '',
    paymentMode: 'cash',
    partyId: '',
    narration: ''
  });

  useEffect(() => {
    getParties().then(r => setParties(r.data));
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const res = await getTransactions({ type: 'expense' });
    setHistory(res.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await recordExpense({
        ...form,
        amount: parseFloat(form.amount),
        partyId: form.partyId ? parseInt(form.partyId) : null,
      });
      setSuccess(`✓ Expense recorded — ${res.data.txnNumber}`);
      setForm({ ...form, amount: '', narration: '', partyId: '' });
      loadHistory();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  const crAccount = form.paymentMode === 'bank_transfer' ? 'Bank Current (17.1)' :
                    form.paymentMode === 'cheque' ? 'Bank Current (17.1)' : 'Cash (24)';

  const columns = [
    { field: 'txnDate', headerName: 'Date', width: 110 },
    { field: 'txnNumber', headerName: 'Voucher No.', width: 140 },
    { field: 'narration', headerName: 'Description', flex: 1 },
    { field: 'party', headerName: 'Party', width: 150 },
    { field: 'totalAmount', headerName: 'Amount', width: 130, renderCell: ({ value }) => fmt(value) },
    { field: 'paymentMode', headerName: 'Mode', width: 120 },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={3}>Expense Entry</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2} color="error">New Expense</Typography>
              {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <form onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField fullWidth type="date" label="Date" required
                      value={form.txnDate} InputLabelProps={{ shrink: true }}
                      onChange={(e) => setForm({ ...form, txnDate: e.target.value })} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth select label="Expense Account" required
                      value={form.expenseAccountCode}
                      onChange={(e) => setForm({ ...form, expenseAccountCode: e.target.value })}>
                      {EXPENSE_ACCOUNTS.map(a => (
                        <MenuItem key={a.code} value={a.code}>{a.label}</MenuItem>
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
                  <Grid item xs={12}>
                    <TextField fullWidth select label="Party (optional)" value={form.partyId}
                      onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
                      <MenuItem value="">-- None --</MenuItem>
                      {parties.map(p => (
                        <MenuItem key={p.partyId} value={p.partyId}>{p.partyName}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Description / Narration" multiline rows={2} required
                      value={form.narration}
                      onChange={(e) => setForm({ ...form, narration: e.target.value })} />
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ bgcolor: '#fff5f5', p: 1.5, borderRadius: 2, mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight="bold">AUTO JOURNAL POSTING:</Typography>
                      <Typography variant="body2">
                        DR {EXPENSE_ACCOUNTS.find(a => a.code === form.expenseAccountCode)?.label} &nbsp; {form.amount ? fmt(form.amount) : '---'}
                      </Typography>
                      <Typography variant="body2">CR {crAccount} &nbsp; {form.amount ? fmt(form.amount) : '---'}</Typography>
                    </Box>
                    <Button fullWidth variant="contained" color="error" type="submit" size="large"
                      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Save />}
                      disabled={loading}>
                      Save Expense
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>Expense History</Typography>
              <DataGrid rows={history} getRowId={(r) => r.txnId}
                columns={columns} autoHeight pageSizeOptions={[10, 25]}
                initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
