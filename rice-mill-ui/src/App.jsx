import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Parties from './pages/Parties/Parties';
import BalanceSheet from './pages/Reports/BalanceSheet';
import CashBook from './pages/Reports/CashBook';
import ProfitLoss from './pages/Reports/ProfitLoss';
import DebtorsCreditors from './pages/Reports/DebtorsCreditors';
import PaddyPurchase from './pages/Transactions/PaddyPurchase';
import RiceSale from './pages/Transactions/RiceSale';
import Expense from './pages/Transactions/Expense';
import ReceiptPayment from './pages/Transactions/ReceiptPayment';
// import ContractMilling from './pages/Transactions/ContractMilling';
import JournalEntry from './pages/Transactions/JournalEntry';
import Cheques from './pages/Cheques/Cheques';
// import Advances from './pages/Advances/Advances';

const theme = createTheme({
  palette: {
    primary: { main: '#1a5276' },
    secondary: { main: '#2e86ab' },
    background: { default: '#f5f7fa' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 }
      }
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, mx: 1,
          '&.Mui-selected': {
            backgroundColor: '#e8f4fd',
            color: '#1a5276',
            fontWeight: 700,
          }
        }
      }
    }
  }
});

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="parties" element={<Parties />} />
        <Route path="transactions/paddy-purchase" element={<PaddyPurchase />} />
        <Route path="transactions/rice-sale" element={<RiceSale />} />
        <Route path="transactions/expense" element={<Expense />} />
        <Route path="transactions/receipt" element={<ReceiptPayment mode="receipt" />} />
        <Route path="transactions/payment" element={<ReceiptPayment mode="payment" />} />
        {/* <Route path="transactions/contract-milling" element={<ContractMilling />} /> */}
        <Route path="transactions/journal" element={<JournalEntry />} />
        <Route path="cheques" element={<Cheques />} />
        {/* <Route path="advances" element={<Advances />} /> */}
        <Route path="reports/balancesheet" element={<BalanceSheet />} />
        <Route path="reports/cashbook" element={<CashBook />} />
        <Route path="reports/profitloss" element={<ProfitLoss />} />
        <Route path="reports/debtors" element={<DebtorsCreditors />} />
        <Route path="reports/creditors" element={<DebtorsCreditors />} />
        {/* More routes will be added as pages are built */}
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
