import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField,
  Button, Alert, CircularProgress, Divider, Chip
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Refresh, Print } from '@mui/icons-material';
import dayjs from 'dayjs';
import { getCashBook } from '../../api';

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function CashBook() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(dayjs().format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await getCashBook({ from, to });
      setData(res.data);
    } catch { setError('Failed to load cash book'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const columns = [
    { field: 'txnDate', headerName: 'Date', width: 110 },
    { field: 'txnNumber', headerName: 'Ref No.', width: 140 },
    { field: 'txnType', headerName: 'Type', width: 130,
      renderCell: ({ value }) => <Chip label={value} size="small" variant="outlined" /> },
    { field: 'party', headerName: 'Party', width: 160 },
    { field: 'narration', headerName: 'Narration', flex: 1 },
    { field: 'cashIn', headerName: 'Cash In (Dr)', width: 140,
      renderCell: ({ value }) => value > 0
        ? <Typography color="success.main" fontWeight="bold">{fmt(value)}</Typography>
        : '-'
    },
    { field: 'cashOut', headerName: 'Cash Out (Cr)', width: 140,
      renderCell: ({ value }) => value > 0
        ? <Typography color="error.main" fontWeight="bold">{fmt(value)}</Typography>
        : '-'
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Daily Cash Book</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField type="date" size="small" label="From" value={from}
            InputLabelProps={{ shrink: true }}
            onChange={(e) => setFrom(e.target.value)} />
          <TextField type="date" size="small" label="To" value={to}
            InputLabelProps={{ shrink: true }}
            onChange={(e) => setTo(e.target.value)} />
          <Button variant="contained" startIcon={<Refresh />} onClick={load}>Load</Button>
          <Button variant="outlined" startIcon={<Print />} onClick={() => window.print()}>Print</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}

      {data && !loading && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ borderLeft: '4px solid #27ae60' }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Total Cash In</Typography>
                  <Typography variant="h5" fontWeight="bold" color="success.main">
                    {fmt(data.totalCashIn)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ borderLeft: '4px solid #e74c3c' }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Total Cash Out</Typography>
                  <Typography variant="h5" fontWeight="bold" color="error.main">
                    {fmt(data.totalCashOut)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ borderLeft: '4px solid #1a5276' }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Closing Balance</Typography>
                  <Typography variant="h5" fontWeight="bold" color={data.closingBalance >= 0 ? 'primary.main' : 'error.main'}>
                    {fmt(data.closingBalance)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Table */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" mb={1}>
                Cash Book — {dayjs(from).format('DD MMM YYYY')} to {dayjs(to).format('DD MMM YYYY')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <DataGrid
                rows={data.entries} getRowId={(_, i) => i}
                columns={columns} autoHeight
                pageSizeOptions={[25, 50, 100]}
                initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              />
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
