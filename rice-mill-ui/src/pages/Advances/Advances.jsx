import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField,
  MenuItem, Button, Alert, Chip, Tabs, Tab, Dialog,
  DialogTitle, DialogContent, DialogActions, LinearProgress
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Tune } from '@mui/icons-material';
import dayjs from 'dayjs';
import { getAdvances, salaryAdvance, paddyAdvance, customerAdvance, adjustAdvance, getAdvanceSummary, getParties } from '../../api';

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function Advances() {
  const [advances, setAdvances] = useState([]);
  const [summary, setSummary] = useState([]);
  const [parties, setParties] = useState([]);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [addDialog, setAddDialog] = useState({ open: false, type: '' });
  const [adjustDialog, setAdjustDialog] = useState({ open: false, advance: null });
  const [form, setForm] = useState({ partyId: '', amount: '', advanceDate: dayjs().format('YYYY-MM-DD'), paymentMode: 'cash', debtorAccountCode: '15.1', narration: '' });
  const [adjustForm, setAdjustForm] = useState({ adjustAmount: '', adjustDate: dayjs().format('YYYY-MM-DD'), narration: '' });

  const load = async () => {
    setLoading(true);
    try {
      const type = tab === 'all' ? undefined : tab;
      const [a, s, p] = await Promise.all([
        getAdvances({ type, hasBalance: false }),
        getAdvanceSummary(),
        getParties()
      ]);
      setAdvances(a.data.advances || []);
      setSummary(s.data);
      setParties(p.data);
    } catch { setError('Failed to load advances'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab]);

  const handleAdd = async () => {
    try {
      const payload = {
        partyId: parseInt(form.partyId),
        amount: parseFloat(form.amount),
        advanceDate: form.advanceDate,
        paymentMode: form.paymentMode,
        narration: form.narration,
        debtorAccountCode: form.debtorAccountCode,
      };
      if (addDialog.type === 'salary_advance') await salaryAdvance(payload);
      else if (addDialog.type === 'paddy_purchase_advance') await paddyAdvance(payload);
      else await customerAdvance(payload);
      setSuccess(`✓ Advance recorded successfully`);
      setAddDialog({ open: false, type: '' });
      setForm({ partyId: '', amount: '', advanceDate: dayjs().format('YYYY-MM-DD'), paymentMode: 'cash', debtorAccountCode: '15.1', narration: '' });
      load();
    } catch (e) { setError(e.response?.data?.message || 'Failed to save'); }
  };

  const handleAdjust = async () => {
    try {
      await adjustAdvance(adjustDialog.advance.advanceId, {
        adjustAmount: parseFloat(adjustForm.adjustAmount),
        adjustDate: adjustForm.adjustDate,
        narration: adjustForm.narration,
      });
      setSuccess(`✓ Advance adjusted successfully`);
      setAdjustDialog({ open: false, advance: null });
      load();
    } catch (e) { setError(e.response?.data?.message || 'Failed to adjust'); }
  };

  const typeLabel = (t) => t?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const typeColor = (t) => ({ salary_advance: 'primary', paddy_purchase_advance: 'warning', customer_advance: 'success' }[t] || 'default');

  const columns = [
    { field: 'advanceDate', headerName: 'Date', width: 110 },
    { field: 'advanceType', headerName: 'Type', width: 180,
      renderCell: ({ value }) => <Chip label={typeLabel(value)} size="small" color={typeColor(value)} /> },
    { field: 'party', headerName: 'Party', flex: 1 },
    { field: 'amount', headerName: 'Total', width: 130, renderCell: ({ value }) => fmt(value) },
    { field: 'adjustedAmount', headerName: 'Adjusted', width: 130, renderCell: ({ value }) => fmt(value) },
    { field: 'balance', headerName: 'Balance', width: 130,
      renderCell: ({ value }) => (
        <Typography fontWeight="bold" color={value > 0 ? 'error.main' : 'success.main'}>{fmt(value)}</Typography>
      )
    },
    {
      field: 'actions', headerName: '', width: 100,
      renderCell: ({ row }) => row.balance > 0 ? (
        <Button size="small" startIcon={<Tune />} variant="outlined"
          onClick={() => { setAdjustDialog({ open: true, advance: row }); setAdjustForm({ adjustAmount: '', adjustDate: dayjs().format('YYYY-MM-DD'), narration: '' }); }}>
          Adjust
        </Button>
      ) : <Chip label="Settled" size="small" color="success" />
    }
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Advances</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<Add />} onClick={() => setAddDialog({ open: true, type: 'salary_advance' })}>Salary Advance</Button>
          <Button variant="outlined" color="warning" startIcon={<Add />} onClick={() => setAddDialog({ open: true, type: 'paddy_purchase_advance' })}>Paddy Advance</Button>
          <Button variant="outlined" color="success" startIcon={<Add />} onClick={() => setAddDialog({ open: true, type: 'customer_advance' })}>Customer Advance</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summary.map((s, i) => {
          const pct = s.totalGiven > 0 ? (s.totalAdjusted / s.totalGiven) * 100 : 0;
          return (
            <Grid item xs={12} sm={4} key={i}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">{typeLabel(s.advanceType)}</Typography>
                  <Typography variant="h6" fontWeight="bold" color="error.main">{fmt(s.totalBalance)}</Typography>
                  <Typography variant="caption">Balance remaining ({s.count} advance(s))</Typography>
                  <LinearProgress variant="determinate" value={pct} sx={{ mt: 1, borderRadius: 1 }} color="success" />
                  <Typography variant="caption" color="text.secondary">{pct.toFixed(0)}% adjusted</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="All" value="all" />
        <Tab label="Salary Advance" value="salary_advance" />
        <Tab label="Paddy Advance" value="paddy_purchase_advance" />
        <Tab label="Customer Advance" value="customer_advance" />
      </Tabs>

      <Card>
        <DataGrid rows={advances} getRowId={(r) => r.advanceId}
          columns={columns} autoHeight loading={loading}
          pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
      </Card>

      {/* Add Advance Dialog */}
      <Dialog open={addDialog.open} onClose={() => setAddDialog({ open: false, type: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>New {typeLabel(addDialog.type)}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth type="date" label="Date" value={form.advanceDate}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setForm({ ...form, advanceDate: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth select label="Party" value={form.partyId}
                onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
                {parties.map(p => <MenuItem key={p.partyId} value={p.partyId}>{p.partyName} ({p.partyType})</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Amount (Rs.)" type="number" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                inputProps={{ min: 0, step: 0.01 }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth select label="Payment Mode" value={form.paymentMode}
                onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
              </TextField>
            </Grid>
            {addDialog.type === 'customer_advance' && (
              <Grid item xs={12}>
                <TextField fullWidth select label="Debtor Account" value={form.debtorAccountCode}
                  onChange={(e) => setForm({ ...form, debtorAccountCode: e.target.value })}>
                  {['15.1','15.2','15.3','15.4','15.5','15.6','15.7','15.8','15.9'].map(c => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField fullWidth label="Narration" multiline rows={2} value={form.narration}
                onChange={(e) => setForm({ ...form, narration: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog({ open: false, type: '' })}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd}>Save Advance</Button>
        </DialogActions>
      </Dialog>

      {/* Adjust Dialog */}
      <Dialog open={adjustDialog.open} onClose={() => setAdjustDialog({ open: false, advance: null })} maxWidth="sm" fullWidth>
        <DialogTitle>Adjust Advance</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Party: <strong>{adjustDialog.advance?.party}</strong> |
            Remaining Balance: <strong>{fmt(adjustDialog.advance?.balance)}</strong>
          </Alert>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth type="date" label="Adjust Date" value={adjustForm.adjustDate}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setAdjustForm({ ...adjustForm, adjustDate: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Adjust Amount (Rs.)" type="number"
                value={adjustForm.adjustAmount}
                onChange={(e) => setAdjustForm({ ...adjustForm, adjustAmount: e.target.value })}
                helperText={`Max: ${fmt(adjustDialog.advance?.balance)}`}
                inputProps={{ min: 0, max: adjustDialog.advance?.balance, step: 0.01 }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Narration" multiline rows={2}
                value={adjustForm.narration}
                onChange={(e) => setAdjustForm({ ...adjustForm, narration: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustDialog({ open: false, advance: null })}>Cancel</Button>
          <Button variant="contained" onClick={handleAdjust}>Adjust</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
