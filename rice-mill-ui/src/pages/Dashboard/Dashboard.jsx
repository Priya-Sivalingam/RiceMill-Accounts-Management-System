import { useEffect, useState } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, CircularProgress, Alert, Chip
} from '@mui/material';
import {
  TrendingUp, TrendingDown, AccountBalance, Warning,
  People, Factory
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import dayjs from 'dayjs';
import {
  getBalanceSheet, getProfitLoss, getPendingCheques,
  getDebtors, getCreditors
} from '../../api';

function StatCard({ title, value, subtitle, icon, color, chip }) {
  return (
    <Card sx={{ height: '100%', borderLeft: `4px solid ${color}` }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" color="text.secondary">{title}</Typography>
            <Typography variant="h5" fontWeight="bold" color={color} mt={0.5}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
            )}
            {chip && <Chip label={chip.label} color={chip.color} size="small" sx={{ mt: 0.5 }} />}
          </Box>
          <Box sx={{
            p: 1, borderRadius: 2,
            bgcolor: `${color}20`, color
          }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function Dashboard() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = dayjs().format('YYYY-MM-DD');
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');

  useEffect(() => {
    const load = async () => {
      try {
        const [bs, pl, cheques,debtors, creditors] = await Promise.all([
          getBalanceSheet(today),
          getProfitLoss({ from: monthStart, to: today }),
          getPendingCheques(),
          getDebtors(today),
          getCreditors(today),
        ]);
        setData({ bs: bs.data, pl: pl.data, cheques: cheques.data,
                 debtors: debtors.data, creditors: creditors.data });
      } catch (e) {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  const cash = data.bs?.assets?.items?.find(a => a.accountCode === '24');
  const bank = data.bs?.assets?.items?.find(a => a.accountCode === '17.1');

  // P&L chart data
  const plChart = [
    { name: 'Income', amount: data.pl?.income?.total || 0 },
    { name: 'Expenses', amount: data.pl?.expenses?.total || 0 },
    { name: 'Net Profit', amount: data.pl?.netProfit || 0 },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        Dashboard — {dayjs().format('DD MMMM YYYY')}
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Cash in Hand"
            value={fmt(cash?.balance)}
            icon={<AccountBalance />}
            color="#1a5276"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Bank Balance"
            value={fmt(bank?.balance)}
            icon={<AccountBalance />}
            color="#2e86ab"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="This Month Profit"
            value={fmt(data.pl?.netProfit)}
            chip={{ label: data.pl?.status, color: data.pl?.netProfit >= 0 ? 'success' : 'error' }}
            icon={data.pl?.netProfit >= 0 ? <TrendingUp /> : <TrendingDown />}
            color={data.pl?.netProfit >= 0 ? '#27ae60' : '#e74c3c'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending Cheques"
            value={data.cheques?.count || 0}
            subtitle={fmt(data.cheques?.totalAmount)}
            icon={<Warning />}
            color="#e67e22"
            chip={data.cheques?.count > 0 ? { label: 'Action Required', color: 'warning' } : null}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Receivable"
            value={fmt(data.debtors?.totalReceivable)}
            subtitle="From customers"
            icon={<People />}
            color="#8e44ad"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Payable"
            value={fmt(data.creditors?.totalPayable)}
            subtitle="To suppliers"
            icon={<People />}
            color="#c0392b"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Income"
            value={fmt(data.pl?.income?.total)}
            subtitle="This month"
            icon={<TrendingUp />}
            color="#27ae60"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Expenses"
            value={fmt(data.pl?.expenses?.total)}
            subtitle="This month"
            icon={<TrendingDown />}
            color="#e74c3c"
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* P&L Chart */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                This Month — Income vs Expenses
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={plChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `Rs.${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Bar dataKey="amount" fill="#2e86ab" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
