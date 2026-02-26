import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button,
  Alert, CircularProgress, Tabs, Tab, Chip, Collapse, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Tooltip, Divider
} from '@mui/material';
import { Refresh, Print, ExpandMore, ExpandLess, MonetizationOn, Payment } from '@mui/icons-material';
import dayjs from 'dayjs';
import { getDebtors, getCreditors } from '../../api';
import PrintReceipt from '../../components/PrintReceipt';

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// Days overdue badge
function DaysBadge({ days }) {
  const color = days > 60 ? '#e74c3c' : days > 30 ? '#e67e22' : days > 15 ? '#f39c12' : '#27ae60';
  const label = days === 0 ? 'Today' : `${days}d`;
  return (
    <Chip label={label} size="small"
      sx={{ bgcolor: color, color: 'white', fontWeight: 'bold', fontSize: 11 }} />
  );
}

// Invoice row inside expanded party
function InvoiceRow({ inv, isDebtor }) {
  const cheque = inv.chequeInfo;
  return (
    <TableRow hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
      <TableCell sx={{ fontSize: 12, py: 0.8 }}>{String(inv.txnDate)}</TableCell>
      <TableCell sx={{ fontSize: 12, py: 0.8, color: '#1a5276', fontWeight: 600 }}>
        {inv.txnNumber}
      </TableCell>
      <TableCell sx={{ fontSize: 12, py: 0.8 }}>{fmt(inv.totalAmount)}</TableCell>
      <TableCell sx={{ fontSize: 12, py: 0.8, color: '#27ae60', fontWeight: 600 }}>
        {fmt(inv.paidAmount)}
      </TableCell>
      <TableCell sx={{ fontSize: 12, py: 0.8, color: '#e74c3c', fontWeight: 700 }}>
        {fmt(inv.balanceDue)}
      </TableCell>
      <TableCell sx={{ fontSize: 12, py: 0.8 }}>
        <DaysBadge days={inv.daysOverdue} />
      </TableCell>
      <TableCell sx={{ fontSize: 12, py: 0.8 }}>
        {cheque ? (
          <Box>
            <Typography variant="caption" display="block" fontWeight="bold">
              🏦 {cheque.chequeNumber}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {cheque.bankName} · {String(cheque.chequeDate)}
            </Typography>
            <Chip
              size="small"
              label={cheque.isPostDated ? `PDC · ${cheque.status}` : cheque.status}
              sx={{ mt: 0.3, fontSize: 10 }}
              color={cheque.status === 'cleared' ? 'success' : cheque.status === 'bounced' ? 'error' : 'warning'}
            />
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">—</Typography>
        )}
      </TableCell>
      <TableCell sx={{ py: 0.8 }}>
        <PrintReceipt txnId={inv.txnId} txnType={isDebtor ? 'sale' : 'purchase'} />
      </TableCell>
    </TableRow>
  );
}

// Party card with expand/collapse
function PartyCard({ party, isDebtor, accent }) {
  const [open, setOpen] = useState(false);

  const agingColor = party.oldestInvoice
    ? (() => {
        const days = dayjs().diff(dayjs(String(party.oldestInvoice)), 'day');
        return days > 60 ? '#e74c3c' : days > 30 ? '#e67e22' : '#f39c12';
      })()
    : '#27ae60';

  return (
    <Card sx={{ mb: 1.5, border: `1px solid #e8ecf0`, borderLeft: `4px solid ${accent}` }}>
      {/* Party summary row — clickable to expand */}
      <Box onClick={() => setOpen(o => !o)} sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: '#fafbfc' }
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton size="small" sx={{ p: 0 }} disableRipple>
            {open
              ? <ExpandLess fontSize="small" color="primary" />
              : <ExpandMore fontSize="small" color="disabled" />}
          </IconButton>
          <Box>
            <Typography fontWeight="bold">{party.partyName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {party.partyCode}
              {party.phone && ` · 📞 ${party.phone}`}
              {` · ${party.invoiceCount} invoice${party.invoiceCount > 1 ? 's' : ''}`}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Oldest invoice age */}
          {party.oldestInvoice && (
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">Oldest</Typography>
              <Typography variant="caption" display="block" sx={{ color: agingColor, fontWeight: 'bold' }}>
                {dayjs().diff(dayjs(String(party.oldestInvoice)), 'day')}d ago
              </Typography>
            </Box>
          )}
          {/* Total outstanding */}
          <Box sx={{ textAlign: 'right', minWidth: 130 }}>
            <Typography variant="caption" color="text.secondary">
              {isDebtor ? 'Receivable' : 'Payable'}
            </Typography>
            <Typography variant="h6" fontWeight="bold" sx={{ color: accent }}>
              {fmt(party.totalOutstanding)}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Invoice list */}
      <Collapse in={open} unmountOnExit>
        <Divider />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f7fa' }}>
                <TableCell sx={{ fontWeight: 'bold', fontSize: 11 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: 11 }}>Invoice No.</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: 11 }}>Total</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: 11 }}>Paid</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: 11 }}>Balance Due</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: 11 }}>Age</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: 11 }}>Cheque Details</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: 11 }}>Receipt</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {party.invoices.map((inv, i) => (
                <InvoiceRow key={i} inv={inv} isDebtor={isDebtor} />
              ))}
              {/* Party total row */}
              <TableRow sx={{ bgcolor: accent + '15' }}>
                <TableCell colSpan={4} sx={{ fontWeight: 'bold', fontSize: 12, borderTop: `2px solid ${accent}` }}>
                  Total Outstanding — {party.partyName}
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: 13, color: accent, borderTop: `2px solid ${accent}` }}>
                  {fmt(party.totalOutstanding)}
                </TableCell>
                <TableCell colSpan={3} sx={{ borderTop: `2px solid ${accent}` }} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function DebtorsCreditors() {
  const [tab,     setTab]     = useState('debtors');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [asOf,    setAsOf]    = useState(dayjs().format('YYYY-MM-DD'));

  const isDebtor = tab === 'debtors';
  const accent   = isDebtor ? '#27ae60' : '#e74c3c';

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = isDebtor ? await getDebtors(asOf) : await getCreditors(asOf);
      setData(res.data);
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab]);

  const list  = isDebtor ? data?.debtors  : data?.creditors;
  const total = isDebtor ? data?.totalReceivable : data?.totalPayable;

  // Aging buckets
  const aging = list ? {
    over60:  list.filter(p => dayjs().diff(dayjs(String(p.oldestInvoice)), 'day') > 60),
    over30:  list.filter(p => { const d = dayjs().diff(dayjs(String(p.oldestInvoice)), 'day'); return d > 30 && d <= 60; }),
    current: list.filter(p => dayjs().diff(dayjs(String(p.oldestInvoice)), 'day') <= 30),
  } : null;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Debtors & Creditors</Typography>
          <Typography variant="caption" color="text.secondary">
            Outstanding invoices only — updates automatically when paid or cheque cleared
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField type="date" size="small" label="As of Date" value={asOf}
            InputLabelProps={{ shrink: true }} onChange={(e) => setAsOf(e.target.value)} />
          <Button variant="contained" startIcon={<Refresh />} onClick={load}>Refresh</Button>
          <Button variant="outlined" startIcon={<Print />} onClick={() => window.print()}>Print</Button>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => { setTab(v); setData(null); }} sx={{ mb: 2 }}>
        <Tab label={`Debtors (Customers owe us)`}  value="debtors"   icon={<MonetizationOn />} iconPosition="start" />
        <Tab label={`Creditors (We owe suppliers)`} value="creditors" icon={<Payment />}         iconPosition="start" />
      </Tabs>

      {error   && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}><CircularProgress /></Box>}

      {data && !loading && (
        <>
          {/* Summary Banner */}
          <Card sx={{ mb: 2, borderLeft: `6px solid ${accent}`,
                      background: `linear-gradient(135deg, ${accent}15, white)` }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <Typography variant="caption" color="text.secondary">
                    Total {isDebtor ? 'Receivable' : 'Payable'} as of {dayjs(asOf).format('DD MMM YYYY')}
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" sx={{ color: accent }}>
                    {fmt(total)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {data.partyCount} {isDebtor ? 'customers' : 'suppliers'} · {list?.reduce((s, p) => s + p.invoiceCount, 0)} invoices outstanding
                  </Typography>
                </Grid>

                {/* Aging summary */}
                {aging && (
                  <>
                    <Grid item xs={4} md={2.5} sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight="bold" color="#27ae60">
                        {aging.current.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">0–30 days</Typography>
                      <Typography variant="body2" fontWeight="bold" color="#27ae60">
                        {fmt(aging.current.reduce((s, p) => s + p.totalOutstanding, 0))}
                      </Typography>
                    </Grid>
                    <Grid item xs={4} md={2.5} sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight="bold" color="#e67e22">
                        {aging.over30.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">31–60 days</Typography>
                      <Typography variant="body2" fontWeight="bold" color="#e67e22">
                        {fmt(aging.over30.reduce((s, p) => s + p.totalOutstanding, 0))}
                      </Typography>
                    </Grid>
                    <Grid item xs={4} md={2.5} sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight="bold" color="#e74c3c">
                        {aging.over60.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">60+ days</Typography>
                      <Typography variant="body2" fontWeight="bold" color="#e74c3c">
                        {fmt(aging.over60.reduce((s, p) => s + p.totalOutstanding, 0))}
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Party list */}
          {list?.length === 0 ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              🎉 No outstanding {isDebtor ? 'receivables' : 'payables'} as of {dayjs(asOf).format('DD MMM YYYY')}!
              All {isDebtor ? 'customers have paid' : 'suppliers have been paid'}.
            </Alert>
          ) : (
            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Click any party to see individual invoices and cheque details
              </Typography>
              {list.map((party, i) => (
                <PartyCard key={i} party={party} isDebtor={isDebtor} accent={accent} />
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
