import axios from 'axios';

const api = axios.create({
  baseURL:'http://13.62.230.54:5001/api',
  // baseURL: 'http://localhost:5000/api',
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────
export const login = (data) => api.post('/auth/login', data);

// ── Accounts ─────────────────────────────────────────────────────
export const getAccounts = (type) => api.get('/accounts', { params: { type } });
export const getAccountBalance = (id, asOf) => api.get(`/accounts/${id}/balance`, { params: { asOf } });

// ── Parties ──────────────────────────────────────────────────────
export const getParties = (type) => api.get('/parties', { params: { type } });
export const getParty = (id) => api.get(`/parties/${id}`);
export const createParty = (data) => api.post('/parties', data);
export const updateParty = (id, data) => api.put(`/parties/${id}`, data);
export const deleteParty = (id) => api.delete(`/parties/${id}`);
export const getPartyLedger = (id, params) => api.get(`/parties/${id}/ledger`, { params });

// ── Transactions ─────────────────────────────────────────────────
export const getTransactions = (params) => api.get('/transactions', { params });
export const getTransaction = (id) => api.get(`/transactions/${id}`);
export const paddyPurchase = (data) => api.post('/transactions/paddy-purchase', data);
export const riceSale = (data) => api.post('/transactions/rice-sale', data);
export const recordExpense = (data) => api.post('/transactions/expense', data);
export const recordReceipt = (data) => api.post('/transactions/receipt', data);
export const recordPayment = (data) => api.post('/transactions/payment', data);
export const contractMilling = (data) => api.post('/transactions/contract-milling', data);
export const journalEntry = (data) => api.post('/transactions/journal', data);
export const cancelTransaction = (id, data) => api.post(`/transactions/${id}/cancel`, data);

// ── Cheques ───────────────────────────────────────────────────────
export const getCheques = (params) => api.get('/cheques', { params });
export const getPendingCheques = () => api.get('/cheques/pending-today');
export const clearCheque = (id, data) => api.post(`/cheques/${id}/clear`, data);
export const bounceCheque = (id, data) => api.post(`/cheques/${id}/bounce`, data);
export const getChequeSummary = () => api.get('/cheques/summary');

// ── Advances ──────────────────────────────────────────────────────
export const getAdvances = (params) => api.get('/advances', { params });
export const salaryAdvance = (data) => api.post('/advances/salary', data);
export const paddyAdvance = (data) => api.post('/advances/paddy-purchase', data);
export const customerAdvance = (data) => api.post('/advances/customer', data);
export const adjustAdvance = (id, data) => api.post(`/advances/${id}/adjust`, data);
export const getAdvanceSummary = () => api.get('/advances/summary');

// ── Fiscal Years ──────────────────────────────────────────────────
export const getFiscalYears = () => api.get('/fiscalyears');
export const getActiveFiscalYear = () => api.get('/fiscalyears/active');
export const createFiscalYear = (data) => api.post('/fiscalyears', data);
export const closeFiscalYear = (id) => api.post(`/fiscalyears/${id}/close`);

// ── Reports ───────────────────────────────────────────────────────
export const getCashBook = (params) => api.get('/reports/cashbook', { params });
export const getBalanceSheet = (asOf) => api.get('/reports/balancesheet', { params: { asOf } });
export const getProfitLoss = (params) => api.get('/reports/profitloss', { params });
export const getIncomeExpense = (params) => api.get('/reports/incomexpense', { params });
export const getDebtors = (asOf) => api.get('/reports/debtors', { params: { asOf } });
export const getCreditors = (asOf) => api.get('/reports/creditors', { params: { asOf } });

export default api;
