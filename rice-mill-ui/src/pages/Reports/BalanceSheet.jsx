import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField,
  Button, CircularProgress, Alert, Chip, Collapse,
  IconButton, Table, TableHead, TableBody, TableRow,
  TableCell, TableContainer
} from '@mui/material';
import { Print, Refresh, ExpandMore, ExpandLess } from '@mui/icons-material';
import dayjs from 'dayjs';
import { getBalanceSheet, getAccountBalance } from '../../api';

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const TXN_LABELS = {
  sale:             '🛒 Sale',
  purchase:         '🌾 Purchase',
  expense:          '💸 Expense',
  receipt:          '💰 Receipt',
  payment:          '💳 Payment',
  journal:          '📖 Journal',
  contract_milling: '🏭 Milling',
};

// ── Single account row with drilldown ────────────────────────────────────
function AccountRow({ accountId, code, name, balance, category, asOf }) {
  const [open,    setOpen]    = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (entries !== null) { setOpen(o => !o); return; }
    setLoading(true);
    try {
      const res = await getAccountBalance(accountId, asOf);
      setEntries(res.data?.entries || []);
      setOpen(true);
    } catch { setEntries([]); setOpen(true); }
    finally { setLoading(false); }
  };

  return (
    <>
      {/* Account header row — clickable */}
      <Box onClick={toggle} sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        py: 0.8, px: 1, borderBottom: '1px solid #f0f0f0',
        cursor: 'pointer', borderRadius: 1,
        '&:hover': { bgcolor: '#f5f8ff' },
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" sx={{ p: 0 }} disableRipple>
            {loading
              ? <CircularProgress size={14} />
              : open
                ? <ExpandLess fontSize="small" color="primary" />
                : <ExpandMore fontSize="small" color="disabled" />}
          </IconButton>
          <Box>
            <Typography variant="body2" fontWeight="500">{code} — {name}</Typography>
            <Typography variant="caption" color="text.secondary">{category}</Typography>
          </Box>
        </Box>
        <Typography variant="body2" fontWeight="bold">{fmt(balance)}</Typography>
      </Box>

      {/* Drilldown transaction table */}
      <Collapse in={open} unmountOnExit>
        <Box sx={{ mx: 1, mb: 1, border: '1px solid #e0e8f4', borderRadius: 1, overflow: 'hidden' }}>
          {entries?.length === 0 ? (
            <Typography variant="caption" color="text.secondary"
              sx={{ display: 'block', p: 1.5, bgcolor: '#fafbfc' }}>
              No transactions found for this account
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#eef2f9' }}>
                    <TableCell sx={{ fontSize: 11, fontWeight: 'bold', py: 0.6, width: 90 }}>Date</TableCell>
                    <TableCell sx={{ fontSize: 11, fontWeight: 'bold', py: 0.6, width: 120 }}>Ref No.</TableCell>
                    <TableCell sx={{ fontSize: 11, fontWeight: 'bold', py: 0.6, width: 110 }}>Type</TableCell>
                    <TableCell sx={{ fontSize: 11, fontWeight: 'bold', py: 0.6 }}>Party</TableCell>
                    <TableCell sx={{ fontSize: 11, fontWeight: 'bold', py: 0.6 }}>Narration</TableCell>
                    <TableCell sx={{ fontSize: 11, fontWeight: 'bold', py: 0.6, textAlign: 'right', width: 110 }}>DR</TableCell>
                    <TableCell sx={{ fontSize: 11, fontWeight: 'bold', py: 0.6, textAlign: 'right', width: 110 }}>CR</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((e, i) => (
                    <TableRow key={i} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell sx={{ fontSize: 11, py: 0.4 }}>{e.txnDate}</TableCell>
                      <TableCell sx={{ fontSize: 11, py: 0.4, color: '#1a5276', fontWeight: '500' }}>
                        {e.txnNumber}
                      </TableCell>
                      <TableCell sx={{ fontSize: 11, py: 0.4 }}>
                        {TXN_LABELS[e.txnType] || e.txnType}
                      </TableCell>
                      <TableCell sx={{ fontSize: 11, py: 0.4 }}>{e.party}</TableCell>
                      <TableCell sx={{ fontSize: 11, py: 0.4, color: 'text.secondary' }}>
                        {e.narration}
                      </TableCell>
                      <TableCell sx={{ fontSize: 11, py: 0.4, textAlign: 'right',
                                       color: '#27ae60', fontWeight: e.drAmount > 0 ? 'bold' : 'normal' }}>
                        {e.drAmount > 0 ? fmt(e.drAmount) : '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: 11, py: 0.4, textAlign: 'right',
                                       color: '#e74c3c', fontWeight: e.crAmount > 0 ? 'bold' : 'normal' }}>
                        {e.crAmount > 0 ? fmt(e.crAmount) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Net balance footer row */}
                  <TableRow sx={{ bgcolor: '#f0f4ff' }}>
                    <TableCell colSpan={5}
                      sx={{ fontSize: 11, fontWeight: 'bold', py: 0.5,
                            borderTop: '1px solid #c5cfe8' }}>
                      Net Balance
                    </TableCell>
                    <TableCell colSpan={2}
                      sx={{ fontSize: 11, fontWeight: 'bold', py: 0.5,
                            textAlign: 'right', borderTop: '1px solid #c5cfe8' }}>
                      {fmt(balance)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Collapse>
    </>
  );
}

// ── Section card (Fixed Assets / Current Assets etc.) ────────────────────
function Section({ title, items, total, color, asOf }) {
  return (
    <Card sx={{ mb: 2, borderTop: `3px solid ${color}` }}>
      <CardContent sx={{ pb: '8px !important' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ color }}>
            {title}
          </Typography>
        </Box>

        {(!items || items.length === 0) ? (
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, display: 'block', py: 1 }}>
            No entries
          </Typography>
        ) : items.map((item, i) => (
          <AccountRow key={i} {...item} asOf={asOf} />
        ))}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, pt: 1,
                   borderTop: `2px solid ${color}`, px: 1 }}>
          <Typography fontWeight="bold">Total {title}</Typography>
          <Typography fontWeight="bold" sx={{ color }}>{fmt(total || 0)}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Main Balance Sheet page ───────────────────────────────────────────────
export default function BalanceSheet() {
  const [asOf,    setAsOf]    = useState(dayjs().format('YYYY-MM-DD'));
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await getBalanceSheet(asOf);
      setData(res.data);
    } catch { setError('Failed to load balance sheet'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const totalAssets      = data?.assets?.total           || 0;
  const totalLiabilities = data?.liabilities?.grandTotal || 0;
  const balanced         = Math.abs(totalAssets - totalLiabilities) < 1;

  const filterItems = (items, category) =>
    (items || []).filter(a => a.category === category);

  const sumItems = (items, category) =>
    filterItems(items, category).reduce((s, i) => s + i.balance, 0);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Balance Sheet</Typography>
          <Typography variant="caption" color="text.secondary">
            Click any account row to see purchases, sales, income, and all transactions
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField type="date" size="small" label="As of Date" value={asOf}
            onChange={(e) => setAsOf(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" startIcon={<Refresh />} onClick={load}>Load</Button>
          <Button variant="outlined" startIcon={<Print />} onClick={() => window.print()}>Print</Button>
        </Box>
      </Box>

      {error   && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}

      {data && !loading && (
        <>
          {/* Balance status */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
            <Chip
              label={balanced ? '✓ Balance Sheet is Balanced' : '⚠ Balance Sheet does not balance'}
              color={balanced ? 'success' : 'error'}
            />
            <Typography variant="caption" color="text.secondary">
              As of {dayjs(asOf).format('DD MMMM YYYY')}
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {/* ── ASSETS ── */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" fontWeight="bold" mb={1} color="#1a5276">ASSETS</Typography>

              <Section title="Fixed Assets"   color="#1a5276" asOf={asOf}
                items={filterItems(data.assets?.items, 'Fixed Asset')}
                total={sumItems(data.assets?.items, 'Fixed Asset')} />

              <Section title="Current Assets" color="#2e86ab" asOf={asOf}
                items={filterItems(data.assets?.items, 'Current Asset')}
                total={sumItems(data.assets?.items, 'Current Asset')} />

              {/* Other asset categories (Prepaid, Long-Term etc.) */}
              {(data.assets?.items || [])
                .filter(a => !['Fixed Asset','Current Asset'].includes(a.category))
                .length > 0 && (
                <Section title="Other Assets" color="#5d6d7e" asOf={asOf}
                  items={(data.assets?.items || []).filter(a =>
                    !['Fixed Asset','Current Asset'].includes(a.category))}
                  total={(data.assets?.items || [])
                    .filter(a => !['Fixed Asset','Current Asset'].includes(a.category))
                    .reduce((s, i) => s + i.balance, 0)} />
              )}

              {/* Total Assets */}
              <Card sx={{ bgcolor: '#1a5276', color: 'white' }}>
                <CardContent sx={{ py: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography fontWeight="bold" fontSize={18}>TOTAL ASSETS</Typography>
                    <Typography fontWeight="bold" fontSize={18}>{fmt(totalAssets)}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* ── LIABILITIES & EQUITY ── */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" fontWeight="bold" mb={1} color="#c0392b">
                LIABILITIES & EQUITY
              </Typography>

              <Section title="Current Liabilities"   color="#c0392b" asOf={asOf}
                items={filterItems(data.liabilities?.items, 'Current Liability')}
                total={sumItems(data.liabilities?.items, 'Current Liability')} />

              <Section title="Long-Term Liabilities" color="#922b21" asOf={asOf}
                items={filterItems(data.liabilities?.items, 'Long-Term Liability')}
                total={sumItems(data.liabilities?.items, 'Long-Term Liability')} />

              {/* Owner's Equity (Capital) */}
              {data.liabilities?.equity?.items?.length > 0 && (
                <Section title="Owner's Equity" color="#8e44ad" asOf={asOf}
                  items={data.liabilities.equity.items}
                  total={data.liabilities.equity.total} />
              )}

              {/* Net Profit */}
              <Card sx={{ mb: 2, borderTop: '3px solid #27ae60' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography fontWeight="bold">Net Profit / (Loss)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Total Income − Total Expenses up to {dayjs(asOf).format('DD MMM YYYY')}
                      </Typography>
                    </Box>
                    <Typography fontWeight="bold" fontSize={16}
                      color={data.liabilities?.netProfit >= 0 ? '#27ae60' : '#e74c3c'}>
                      {fmt(data.liabilities?.netProfit)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              {/* Total Liabilities & Equity */}
              <Card sx={{ bgcolor: '#c0392b', color: 'white' }}>
                <CardContent sx={{ py: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography fontWeight="bold" fontSize={18}>TOTAL LIABILITIES & EQUITY</Typography>
                    <Typography fontWeight="bold" fontSize={18}>{fmt(totalLiabilities)}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
