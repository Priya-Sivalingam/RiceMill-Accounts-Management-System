import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField,
  MenuItem, Button, Alert, Chip, Tabs, Tab, Dialog,
  DialogTitle, DialogContent, DialogActions, IconButton, Tooltip
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { CheckCircle, Cancel, Refresh, Warning } from '@mui/icons-material';
import dayjs from 'dayjs';
import { getCheques, clearCheque, bounceCheque, getPendingCheques, getChequeSummary } from '../../api';

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const statusColor = (s) => ({ pending: 'warning', cleared: 'success', bounced: 'error', cancelled: 'default' }[s] || 'default');

export default function Cheques() {
  const [cheques, setCheques] = useState([]);
  const [pending, setPending] = useState({ count: 0, totalAmount: 0, cheques: [] });
  const [summary, setSummary] = useState([]);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [clearDialog, setClearDialog] = useState({ open: false, cheque: null });
  const [bounceDialog, setBounceDialog] = useState({ open: false, cheque: null });
  const [clearDate, setClearDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [bounceReason, setBounceReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (tab === 'received') params.type = 'received';
      if (tab === 'issued') params.type = 'issued';
      if (tab === 'pending') params.status = 'pending';
      if (tab === 'pdc') params.isPostDated = true;
      const [c, p, s] = await Promise.all([
        getCheques(params),
        getPendingCheques(),
        getChequeSummary()
      ]);
      setCheques(c.data);
      setPending(p.data);
      setSummary(s.data);
    } catch { setError('Failed to load cheques'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab]);

  const handleClear = async () => {
    try {
      await clearCheque(clearDialog.cheque.chequeId, { clearedDate: clearDate });
      setSuccess(`✓ Cheque ${clearDialog.cheque.chequeNumber} marked as cleared`);
      setClearDialog({ open: false, cheque: null });
      load();
    } catch (e) { setError(e.response?.data?.message || 'Failed to clear cheque'); }
  };

  const handleBounce = async () => {
    try {
      await bounceCheque(bounceDialog.cheque.chequeId, { reason: bounceReason });
      setSuccess(`✓ Cheque ${bounceDialog.cheque.chequeNumber} marked as bounced`);
      setBounceDialog({ open: false, cheque: null });
      setBounceReason('');
      load();
    } catch (e) { setError(e.response?.data?.message || 'Failed to bounce cheque'); }
  };

  const columns = [
    { field: 'chequeNumber', headerName: 'Cheque No.', width: 130 },
    { field: 'bankName', headerName: 'Bank', width: 150 },
    { field: 'chequeDate', headerName: 'Cheque Date', width: 120,
      renderCell: ({ row }) => {
        const isPast = row.chequeDate < dayjs().format('YYYY-MM-DD');
        const isToday = row.chequeDate === dayjs().format('YYYY-MM-DD');
        return (
          <Box>
            <Typography variant="body2">{row.chequeDate}</Typography>
            {row.isPostDated && row.status === 'pending' && (
              <Typography variant="caption"
                sx={{ color: isPast || isToday ? '#e74c3c' : '#e67e22', fontWeight: 'bold' }}>
                {isPast ? '⚠ Overdue!' : isToday ? '✓ Due Today!' : `${dayjs(row.chequeDate).diff(dayjs(), 'day')}d left`}
              </Typography>
            )}
          </Box>
        );
      }
    },
    { field: 'party', headerName: 'Party', flex: 1 },
    { field: 'chequeType', headerName: 'Type', width: 100,
      renderCell: ({ value }) => <Chip label={value} size="small" color={value === 'received' ? 'success' : 'primary'} variant="outlined" /> },
    { field: 'amount', headerName: 'Amount', width: 130, renderCell: ({ value }) => fmt(value) },
    { field: 'isPostDated', headerName: 'PDC', width: 70,
      renderCell: ({ value }) => value ? <Chip label="PDC" size="small" color="warning" /> : '-' },
    { field: 'isPostDated', headerName: 'Type', width: 110,
      renderCell: ({ row }) => row.isPostDated
        ? <Chip label="PDC" size="small" color="warning" variant="outlined" />
        : <Chip label="Regular" size="small" color="default" variant="outlined" />
    },
    { field: 'status', headerName: 'Status', width: 110,
      renderCell: ({ row }) => (
        <Box>
          <Chip label={row.status} size="small" color={statusColor(row.status)} />
          {row.status === 'pending' && row.isPostDated && row.chequeDate <= dayjs().format('YYYY-MM-DD') && (
            <Typography variant="caption" color="error" display="block">Clear now!</Typography>
          )}
        </Box>
      )
    },
    { field: 'clearedDate', headerName: 'Cleared Date', width: 120,
      renderCell: ({ value }) => value || '-' },
    {
      field: 'actions', headerName: 'Actions', width: 110, sortable: false,
      renderCell: ({ row }) => row.status === 'pending' ? (
        <Box>
          <Tooltip title="Mark Cleared">
            <IconButton size="small" color="success"
              onClick={() => setClearDialog({ open: true, cheque: row })}>
              <CheckCircle fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Mark Bounced">
            <IconButton size="small" color="error"
              onClick={() => setBounceDialog({ open: true, cheque: row })}>
              <Cancel fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ) : '-'
    }
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Cheques</Typography>
        <Button startIcon={<Refresh />} onClick={load} variant="outlined">Refresh</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Pending Alert */}
      {pending.count > 0 && (
        <Alert severity="warning" icon={<Warning />} sx={{ mb: 2 }}>
          <strong>{pending.count} cheque(s)</strong> are pending clearance —
          Total: <strong>{fmt(pending.totalAmount)}</strong>
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summary.map((s, i) => (
          <Grid item xs={6} sm={3} key={i}>
            <Card sx={{ borderLeft: `4px solid ${s.status === 'cleared' ? '#27ae60' : s.status === 'bounced' ? '#e74c3c' : s.status === 'pending' ? '#e67e22' : '#95a5a6'}` }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {s.chequeType} — {s.status}
                </Typography>
                <Typography variant="h6" fontWeight="bold">{fmt(s.amount)}</Typography>
                <Typography variant="caption">{s.count} cheque(s)</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="All" value="all" />
        <Tab label="Received" value="received" />
        <Tab label="Issued" value="issued" />
        <Tab label="Pending" value="pending" />
        <Tab label="Post-Dated (PDC)" value="pdc" />
      </Tabs>

      <Card>
        <DataGrid
          rows={cheques} getRowId={(r) => r.chequeId}
          columns={columns} autoHeight loading={loading}
          pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </Card>

      {/* Clear Dialog */}
      <Dialog open={clearDialog.open} onClose={() => setClearDialog({ open: false, cheque: null })}>
        <DialogTitle>Mark Cheque as Cleared</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>
            Cheque: <strong>{clearDialog.cheque?.chequeNumber}</strong> —
            Amount: <strong>{fmt(clearDialog.cheque?.amount)}</strong>
          </Typography>
          {clearDialog.cheque?.isPostDated && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This is a Post-Dated Cheque. Clearing it will automatically move the amount from PDC Account (23) to Bank (17.1).
            </Alert>
          )}
          <TextField fullWidth type="date" label="Cleared Date"
            value={clearDate} InputLabelProps={{ shrink: true }}
            onChange={(e) => setClearDate(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialog({ open: false, cheque: null })}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleClear}>Confirm Clear</Button>
        </DialogActions>
      </Dialog>

      {/* Bounce Dialog */}
      <Dialog open={bounceDialog.open} onClose={() => setBounceDialog({ open: false, cheque: null })}>
        <DialogTitle>Mark Cheque as Bounced</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>
            Cheque: <strong>{bounceDialog.cheque?.chequeNumber}</strong> —
            Amount: <strong>{fmt(bounceDialog.cheque?.amount)}</strong>
          </Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Marking as bounced will automatically post a reversal journal entry.
          </Alert>
          <TextField fullWidth label="Reason for Bounce" required
            value={bounceReason} onChange={(e) => setBounceReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBounceDialog({ open: false, cheque: null })}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleBounce}
            disabled={!bounceReason}>Confirm Bounce</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
