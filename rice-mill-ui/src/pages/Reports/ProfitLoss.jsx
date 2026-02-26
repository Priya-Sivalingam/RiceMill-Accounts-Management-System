import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField,
  Button, Alert, CircularProgress, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, Paper
} from '@mui/material';
import { Refresh, Print, TrendingUp, TrendingDown } from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import dayjs from 'dayjs';
import { getProfitLoss } from '../../api';

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function EntryTable({ title, items, total, color, emptyMsg }) {
  return (
    <Card sx={{ mb: 2, borderTop: `3px solid ${color}` }}>
      <CardContent sx={{ pb: 1 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ color, mb: 1 }}>
          {title}
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f7fa' }}>
                <TableCell sx={{ fontWeight: 'bold', width: 80 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Account Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(!items || items.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 2 }}>
                    {emptyMsg || 'No entries'}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, i) => (
                  <TableRow key={i} hover
                    sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{item.accountCode}</TableCell>
                    <TableCell>{item.accountName}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{item.category}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{fmt(item.amount)}</TableCell>
                  </TableRow>
                ))
              )}

              {/* Total Row */}
              <TableRow sx={{ bgcolor: color + '15' }}>
                <TableCell colSpan={3} sx={{ fontWeight: 'bold', fontSize: 14, borderTop: `2px solid ${color}` }}>
                  Total {title}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: 14, color, borderTop: `2px solid ${color}` }}>
                  {fmt(total)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

export default function ProfitLoss() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await getProfitLoss({ from, to });
      setData(res.data);
    } catch { setError('Failed to load P&L'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const chartData = data ? [
    { name: 'Income',     value: data.income?.total   || 0, color: '#27ae60' },
    { name: 'Expenses',   value: data.expenses?.total || 0, color: '#e74c3c' },
    { name: 'Net Profit', value: Math.abs(data.netProfit || 0),
      color: (data?.netProfit >= 0) ? '#1a5276' : '#e74c3c' },
  ] : [];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Profit & Loss</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField type="date" size="small" label="From" value={from}
            InputLabelProps={{ shrink: true }} onChange={(e) => setFrom(e.target.value)} />
          <TextField type="date" size="small" label="To" value={to}
            InputLabelProps={{ shrink: true }} onChange={(e) => setTo(e.target.value)} />
          <Button variant="contained" startIcon={<Refresh />} onClick={load}>Load</Button>
          <Button variant="outlined" startIcon={<Print />} onClick={() => window.print()}>Print</Button>
        </Box>
      </Box>

      {error   && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}

      {data && !loading && (
        <>
          {/* Net Profit Banner */}
          <Card sx={{
            mb: 3,
            background: data.netProfit >= 0
              ? 'linear-gradient(135deg, #1a5276, #27ae60)'
              : 'linear-gradient(135deg, #922b21, #e74c3c)',
            color: 'white'
          }}>
            <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h6">
                  {data.status} — {dayjs(from).format('DD MMM')} to {dayjs(to).format('DD MMM YYYY')}
                </Typography>
                <Typography variant="h3" fontWeight="bold">{fmt(data.netProfit)}</Typography>
              </Box>
              {data.netProfit >= 0
                ? <TrendingUp sx={{ fontSize: 80, opacity: 0.3 }} />
                : <TrendingDown sx={{ fontSize: 80, opacity: 0.3 }} />
              }
            </CardContent>
          </Card>

          <Grid container spacing={3}>
            {/* Chart */}
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" mb={2}>Summary</Typography>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Summary totals below chart */}
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8,
                               borderBottom: '1px solid #eee' }}>
                      <Typography variant="body2" color="success.main" fontWeight="bold">Total Income</Typography>
                      <Typography variant="body2" fontWeight="bold">{fmt(data.income?.total)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8,
                               borderBottom: '1px solid #eee' }}>
                      <Typography variant="body2" color="error.main" fontWeight="bold">Total Expenses</Typography>
                      <Typography variant="body2" fontWeight="bold">{fmt(data.expenses?.total)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8,
                               bgcolor: data.netProfit >= 0 ? '#eafaf1' : '#fdf2f2',
                               px: 1, borderRadius: 1, mt: 0.5 }}>
                      <Typography variant="body2" fontWeight="bold"
                        color={data.netProfit >= 0 ? 'success.main' : 'error.main'}>
                        Net {data.status}
                      </Typography>
                      <Typography variant="body2" fontWeight="bold"
                        color={data.netProfit >= 0 ? 'success.main' : 'error.main'}>
                        {fmt(data.netProfit)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Income & Expense Tables */}
            <Grid item xs={12} md={8}>
              <EntryTable
                title="INCOME"
                color="#27ae60"
                items={data.income?.items}
                total={data.income?.total}
                emptyMsg="No income entries for this period"
              />
              <EntryTable
                title="EXPENSES"
                color="#e74c3c"
                items={data.expenses?.items}
                total={data.expenses?.total}
                emptyMsg="No expense entries for this period"
              />
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
