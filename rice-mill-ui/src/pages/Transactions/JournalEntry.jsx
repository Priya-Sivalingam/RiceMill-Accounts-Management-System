import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField,
  MenuItem, Button, Alert, CircularProgress, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody, Chip
} from '@mui/material';
import { Save, Add, Delete } from '@mui/icons-material';
import dayjs from 'dayjs';
import { journalEntry, getAccounts, getTransactions } from '../../api';
import { DataGrid } from '@mui/x-data-grid';

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const emptyLine = () => ({ accountCode: '', drAmount: 0, crAmount: 0, narration: '' });

export default function JournalEntry() {
  const [accounts, setAccounts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [txnDate, setTxnDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);

  useEffect(() => {
    getAccounts().then(r => setAccounts(r.data));
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const res = await getTransactions({ type: 'journal' });
    setHistory(res.data);
  };

  const totalDr = lines.reduce((s, l) => s + (parseFloat(l.drAmount) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (parseFloat(l.crAmount) || 0), 0);
  const isBalanced = Math.abs(totalDr - totalCr) < 0.01 && totalDr > 0;

  const updateLine = (i, field, value) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value };
    setLines(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isBalanced) { setError('Journal does not balance — DR must equal CR'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await journalEntry({
        txnDate,
        narration,
        entries: lines.filter(l => l.accountCode).map(l => ({
          accountCode: l.accountCode,
          partyId: null,
          drAmount: parseFloat(l.drAmount) || 0,
          crAmount: parseFloat(l.crAmount) || 0,
          narration: l.narration || narration,
        }))
      });
      setSuccess(`✓ Journal Entry posted — ${res.data.txnNumber}`);
      setLines([emptyLine(), emptyLine()]);
      setNarration('');
      loadHistory();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  const columns = [
    { field: 'txnDate', headerName: 'Date', width: 110 },
    { field: 'txnNumber', headerName: 'Journal No.', width: 150 },
    { field: 'narration', headerName: 'Narration', flex: 1 },
    { field: 'totalAmount', headerName: 'Amount', width: 130, renderCell: ({ value }) => fmt(value) },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={3}>Journal Entry</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>New Journal Entry</Typography>
              {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <form onSubmit={handleSubmit}>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth type="date" label="Date" required
                      value={txnDate} InputLabelProps={{ shrink: true }}
                      onChange={(e) => setTxnDate(e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Narration / Description" required
                      value={narration} onChange={(e) => setNarration(e.target.value)} />
                  </Grid>
                </Grid>

                {/* Journal Lines Table */}
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f7fa' }}>
                      <TableCell>Account</TableCell>
                      <TableCell align="right">Debit (Rs.)</TableCell>
                      <TableCell align="right">Credit (Rs.)</TableCell>
                      <TableCell>Narration</TableCell>
                      <TableCell width={40}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <TextField select size="small" fullWidth value={line.accountCode}
                            onChange={(e) => updateLine(i, 'accountCode', e.target.value)}>
                            {accounts.map(a => (
                              <MenuItem key={a.accountId} value={a.accountCode}>
                                {a.accountCode} — {a.accountName}
                              </MenuItem>
                            ))}
                          </TextField>
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="number" value={line.drAmount}
                            onChange={(e) => updateLine(i, 'drAmount', e.target.value)}
                            inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right' } }} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="number" value={line.crAmount}
                            onChange={(e) => updateLine(i, 'crAmount', e.target.value)}
                            inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right' } }} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" value={line.narration}
                            onChange={(e) => updateLine(i, 'narration', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          {lines.length > 2 && (
                            <IconButton size="small" color="error"
                              onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                              <Delete fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Totals Row */}
                    <TableRow sx={{ bgcolor: '#f5f7fa', fontWeight: 'bold' }}>
                      <TableCell><strong>Total</strong></TableCell>
                      <TableCell align="right"><strong>{fmt(totalDr)}</strong></TableCell>
                      <TableCell align="right"><strong>{fmt(totalCr)}</strong></TableCell>
                      <TableCell colSpan={2}>
                        <Chip
                          size="small"
                          label={isBalanced ? '✓ Balanced' : `Difference: ${fmt(Math.abs(totalDr - totalCr))}`}
                          color={isBalanced ? 'success' : 'error'}
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Button startIcon={<Add />} variant="outlined"
                    onClick={() => setLines([...lines, emptyLine()])}>
                    Add Line
                  </Button>
                  <Button fullWidth variant="contained" type="submit" size="large"
                    startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Save />}
                    disabled={loading || !isBalanced}>
                    Post Journal Entry
                  </Button>
                </Box>
              </form>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>Journal History</Typography>
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
