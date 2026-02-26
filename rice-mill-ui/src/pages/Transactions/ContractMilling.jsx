import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField,
  MenuItem, Button, Alert, CircularProgress, Divider
} from '@mui/material';
import { Save } from '@mui/icons-material';
import dayjs from 'dayjs';
import { contractMilling, getParties, getTransactions } from '../../api';
import { DataGrid } from '@mui/x-data-grid';

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function ContractMilling() {
  const [clients, setClients] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    millingDate: dayjs().format('YYYY-MM-DD'),
    partyId: '',
    paddyQtyKg: '',
    riceQtyKg: '',
    branQtyKg: '',
    millingCharge: '',
    paymentMode: 'cash',
    debtorAccountCode: '15.1',
    narration: ''
  });

  useEffect(() => {
    getParties('contract_client').then(r => setClients(r.data));
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const res = await getTransactions({ type: 'contract_milling' });
    setHistory(res.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await contractMilling({
        ...form,
        partyId: parseInt(form.partyId),
        paddyQtyKg: parseFloat(form.paddyQtyKg),
        riceQtyKg: parseFloat(form.riceQtyKg),
        branQtyKg: parseFloat(form.branQtyKg || 0),
        millingCharge: parseFloat(form.millingCharge),
        debtorAccountCode: form.paymentMode === 'credit' ? form.debtorAccountCode : null,
      });
      setSuccess(`✓ Contract Milling recorded — ${res.data.millingNumber}`);
      setForm({ ...form, paddyQtyKg: '', riceQtyKg: '', branQtyKg: '', millingCharge: '', narration: '' });
      loadHistory();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  const columns = [
    { field: 'txnDate', headerName: 'Date', width: 110 },
    { field: 'txnNumber', headerName: 'Job No.', width: 140 },
    { field: 'party', headerName: 'Client', flex: 1 },
    { field: 'totalAmount', headerName: 'Charge', width: 130, renderCell: ({ value }) => fmt(value) },
    { field: 'paymentMode', headerName: 'Mode', width: 120 },
    { field: 'balanceDue', headerName: 'Balance Due', width: 130, renderCell: ({ value }) => fmt(value) },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={3}>Contract Milling</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2} color="secondary">New Milling Job</Typography>
              {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <form onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField fullWidth type="date" label="Date" required
                      value={form.millingDate} InputLabelProps={{ shrink: true }}
                      onChange={(e) => setForm({ ...form, millingDate: e.target.value })} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth select label="Client (Farmer)" required value={form.partyId}
                      onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
                      {clients.map(c => <MenuItem key={c.partyId} value={c.partyId}>{c.partyName}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Paddy Received (Kg)" type="number" required
                      value={form.paddyQtyKg}
                      onChange={(e) => setForm({ ...form, paddyQtyKg: e.target.value })}
                      inputProps={{ min: 0, step: 0.01 }} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Rice Returned (Kg)" type="number" required
                      value={form.riceQtyKg}
                      onChange={(e) => setForm({ ...form, riceQtyKg: e.target.value })}
                      inputProps={{ min: 0, step: 0.01 }} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Bran (Kg)" type="number"
                      value={form.branQtyKg}
                      onChange={(e) => setForm({ ...form, branQtyKg: e.target.value })}
                      inputProps={{ min: 0, step: 0.01 }} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Milling Charge (Rs.)" type="number" required
                      value={form.millingCharge}
                      onChange={(e) => setForm({ ...form, millingCharge: e.target.value })}
                      inputProps={{ min: 0, step: 0.01 }} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth select label="Payment Mode" required
                      value={form.paymentMode}
                      onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
                      <MenuItem value="cash">Cash</MenuItem>
                      <MenuItem value="credit">Credit</MenuItem>
                      <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                      <MenuItem value="deduct_from_rice">Deduct from Rice</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Narration" multiline rows={2}
                      value={form.narration}
                      onChange={(e) => setForm({ ...form, narration: e.target.value })} />
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ bgcolor: '#f5f0ff', p: 1.5, borderRadius: 2, mb: 2 }}>
                      <Typography variant="caption" fontWeight="bold" color="text.secondary">AUTO JOURNAL POSTING:</Typography>
                      <Typography variant="body2">
                        DR {form.paymentMode === 'credit' ? `Debtor (${form.debtorAccountCode})` : 'Cash (24)'}
                        &nbsp; {form.millingCharge ? fmt(form.millingCharge) : '---'}
                      </Typography>
                      <Typography variant="body2">
                        CR Other Income (8) &nbsp; {form.millingCharge ? fmt(form.millingCharge) : '---'}
                      </Typography>
                    </Box>
                    <Button fullWidth variant="contained" type="submit" size="large" color="secondary"
                      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Save />}
                      disabled={loading}>
                      Save Milling Job
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
              <Typography variant="h6" fontWeight="bold" mb={2}>Milling History</Typography>
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
