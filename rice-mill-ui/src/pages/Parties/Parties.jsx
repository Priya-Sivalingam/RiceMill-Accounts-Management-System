import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Grid, Chip,
  IconButton, Tooltip, Tab, Tabs, Alert
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Edit, Delete, AccountBalance } from '@mui/icons-material';
import { getParties, createParty, updateParty, deleteParty, getPartyLedger, getAccounts } from '../../api';

const PARTY_TYPES = [
  { value: 'supplier',        label: 'Paddy Supplier' },
  { value: 'customer',        label: 'Rice Customer' },
];

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const emptyForm = {
  partyName: '', partyType: 'supplier', phone: '', address: '',
  openingBalance: 0, openingBalanceType: 'DR', creditLimit: 0, linkedAccountId: ''
};

export default function Parties() {
  const [parties,      setParties]      = useState([]);
  const [accounts,     setAccounts]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState('all');
  const [dialog,       setDialog]       = useState({ open: false, mode: 'add', data: null });
  const [ledgerDialog, setLedgerDialog] = useState({ open: false, party: null, entries: [] });
  const [form,         setForm]         = useState(emptyForm);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const type = tab === 'all' ? undefined : tab;
      const [p, a] = await Promise.all([getParties(type), getAccounts()]);
      setParties(p.data);
      setAccounts(a.data);
    } catch {
      setError('Failed to load parties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  const openAdd = () => {
    setForm(emptyForm);
    setDialog({ open: true, mode: 'add', data: null });
  };

  const openEdit = (row) => {
    setForm({
      partyName:          row.partyName          || '',
      partyType:          row.partyType          || 'supplier',
      phone:              row.phone              || '',
      address:            row.address            || '',
    });
    setDialog({ open: true, mode: 'edit', data: row });
  };

  const openLedger = async (row) => {
    try {
      const res = await getPartyLedger(row.partyId);
      setLedgerDialog({ open: true, party: row, entries: res.data });
    } catch {
      setError('Failed to load ledger');
    }
  };

  const handleSave = async () => {
    setError('');
    try {
      const payload = { ...form, linkedAccountId: form.linkedAccountId || null };
      if (dialog.mode === 'add') {
        await createParty(payload);
        setSuccess('Party added successfully');
      } else {
        await updateParty(dialog.data.partyId, payload);
        setSuccess('Party updated successfully');
      }
      setDialog({ open: false, mode: 'add', data: null });
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save party');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this party?')) return;
    try {
      await deleteParty(id);
      setSuccess('Party deactivated');
      load();
    } catch {
      setError('Failed to delete party');
    }
  };

  const columns = [
    { field: 'partyCode', headerName: 'Code', width: 100 },
    { field: 'partyName', headerName: 'Name', flex: 1 },
    { field: 'partyType', headerName: 'Type', width: 160,
      renderCell: ({ value }) => (
        <Chip label={value?.replace(/_/g, ' ')} size="small" color="primary" variant="outlined" />
      )
    },
    { field: 'phone', headerName: 'Phone', width: 130 },
    { field: 'actions', headerName: 'Actions', width: 130, sortable: false,
      renderCell: ({ row }) => (
        <Box>
          <Tooltip title="Ledger">
            <IconButton size="small" onClick={() => openLedger(row)}>
              <AccountBalance fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" color="primary" onClick={() => openEdit(row)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDelete(row.partyId)}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

  const ledgerColumns = [
    { field: 'txnDate',   headerName: 'Date',      width: 110 },
    { field: 'txnNumber', headerName: 'Ref No.',   width: 140 },
    { field: 'txnType',   headerName: 'Type',      width: 120 },
    { field: 'narration', headerName: 'Narration', flex: 1 },
    { field: 'drAmount',  headerName: 'Debit',     width: 130,
      renderCell: ({ value }) => value > 0 ? <span style={{color:'#e74c3c'}}>{fmt(value)}</span> : '-' },
    { field: 'crAmount',  headerName: 'Credit',    width: 130,
      renderCell: ({ value }) => value > 0 ? <span style={{color:'#27ae60'}}>{fmt(value)}</span> : '-' },
    { field: 'balance',   headerName: 'Balance',   width: 150,
      renderCell: ({ row }) => `${fmt(row.balance)} ${row.balanceType || ''}` },
  ];

  const ledgerEntries = Array.isArray(ledgerDialog.entries?.entries)
    ? ledgerDialog.entries.entries
    : Array.isArray(ledgerDialog.entries) ? ledgerDialog.entries : [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Parties</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openAdd}>Add Party</Button>
      </Box>

      {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="All"              value="all" />
        <Tab label="Suppliers"        value="supplier" />
        <Tab label="Customers"        value="customer" />
      </Tabs>

      <Card>
        <DataGrid
          rows={parties} getRowId={(r) => r.partyId}
          columns={columns} autoHeight loading={loading}
          pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, mode: 'add', data: null })} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog.mode === 'add' ? 'Add New Party' : `Edit — ${dialog.data?.partyName}`}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Party Name" required value={form.partyName}
                onChange={(e) => setForm({ ...form, partyName: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth select label="Party Type" value={form.partyType}
                onChange={(e) => setForm({ ...form, partyType: e.target.value })}>
                {PARTY_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Phone" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Address" multiline rows={2} value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Grid>
            
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog({ open: false, mode: 'add', data: null })}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {dialog.mode === 'add' ? 'Add Party' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ledger Dialog */}
      <Dialog open={ledgerDialog.open} onClose={() => setLedgerDialog({ open: false, party: null, entries: [] })} maxWidth="lg" fullWidth>
        <DialogTitle>Party Ledger — {ledgerDialog.party?.partyName}</DialogTitle>
        <DialogContent>
          {ledgerEntries.length === 0
            ? <Alert severity="info">No transactions found for this party.</Alert>
            : <DataGrid
                rows={ledgerEntries}
                getRowId={(row, i) => row.txnId ? `${row.txnId}-${row.entryId || i}` : String(i)}
                columns={ledgerColumns} autoHeight
                pageSizeOptions={[25, 50]}
              />
          }
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLedgerDialog({ open: false, party: null, entries: [] })}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
