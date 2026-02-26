import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, IconButton, Avatar,
  Menu, MenuItem, Divider, Chip, Tooltip, Collapse
} from '@mui/material';
import {
  Dashboard, People, Receipt, AccountBalance, ExpandLess, ExpandMore,
  Assessment, Logout, Menu as MenuIcon, GrainRounded,
  AttachMoney, Payment, RequestQuote, Factory, Book,
  CheckBox, MoneyOff
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const DRAWER_WIDTH = 250;

const navItems = [
  { label: 'Dashboard', icon: <Dashboard />, path: '/' },
  { label: 'Parties', icon: <People />, path: '/parties' },
  {
    label: 'Transactions', icon: <Receipt />, children: [
      { label: 'Paddy Purchase', icon: <AttachMoney />, path: '/transactions/paddy-purchase' },
      { label: 'Rice Sale', icon: <Payment />, path: '/transactions/rice-sale' },
      { label: 'Expense', icon: <MoneyOff />, path: '/transactions/expense' },
      { label: 'Receipt', icon: <RequestQuote />, path: '/transactions/receipt' },
      { label: 'Payment', icon: <Payment />, path: '/transactions/payment' },
      // { label: 'Contract Milling', icon: <Factory />, path: '/transactions/contract-milling' },
      { label: 'Journal Entry', icon: <Book />, path: '/transactions/journal' },
    ]
  },
  { label: 'Cheques', icon: <CheckBox />, path: '/cheques' },
  // { label: 'Advances', icon: <AccountBalance />, path: '/advances' },
  {
    label: 'Reports', icon: <Assessment />, children: [
      // { label: 'Cash Book', icon: <Book />, path: '/reports/cashbook' },
      { label: 'Balance Sheet', icon: <AccountBalance />, path: '/reports/balancesheet' },
      { label: 'Profit & Loss', icon: <Assessment />, path: '/reports/profitloss' },
      { label: 'Debtors', icon: <People />, path: '/reports/debtors' },
      { label: 'Creditors', icon: <People />, path: '/reports/creditors' },
    ]
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState({ Transactions: true, Reports: false });
  const [anchorEl, setAnchorEl] = useState(null);

  const toggleMenu = (label) =>
    setOpenMenus(prev => ({ ...prev, [label]: !prev[label] }));

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Brand */}
      <Box sx={{
        p: 2, display: 'flex', alignItems: 'center', gap: 1,
        background: 'linear-gradient(135deg, #1a5276, #2e86ab)'
      }}>
        <GrainRounded sx={{ color: 'white', fontSize: 32 }} />
        <Box>
          <Typography variant="subtitle1" fontWeight="bold" color="white" lineHeight={1}>
            Rice Mill
          </Typography>
          <Typography variant="caption" color="rgba(255,255,255,0.7)">
            Accounts System
          </Typography>
        </Box>
      </Box>

      {/* Nav */}
      <List sx={{ flex: 1, pt: 1 }}>
        {navItems.map((item) =>
          item.children ? (
            <Box key={item.label}>
              <ListItem disablePadding>
                <ListItemButton onClick={() => toggleMenu(item.label)}>
                  <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                  {openMenus[item.label] ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
              </ListItem>
              <Collapse in={openMenus[item.label]}>
                <List disablePadding>
                  {item.children.map((child) => (
                    <ListItem key={child.path} disablePadding>
                      <ListItemButton
                        sx={{ pl: 4 }}
                        selected={location.pathname === child.path}
                        onClick={() => navigate(child.path)}
                      >
                        <ListItemIcon sx={{ minWidth: 32, fontSize: 18 }}>{child.icon}</ListItemIcon>
                        <ListItemText primary={child.label} primaryTypographyProps={{ fontSize: 13 }} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </Box>
          ) : (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          )
        )}
      </List>

      <Divider />
      {/* User */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
          {user?.fullName?.[0]}
        </Avatar>
        <Box flex={1}>
          <Typography variant="body2" fontWeight="bold">{user?.fullName}</Typography>
          <Chip label={user?.role} size="small" color="primary" sx={{ height: 16, fontSize: 10 }} />
        </Box>
        <Tooltip title="Logout">
          <IconButton size="small" onClick={logout}>
            <Logout fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* AppBar */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" sx={{ mr: 2, display: { sm: 'none' } }}
            onClick={() => setMobileOpen(!mobileOpen)}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            Rice Mill Accounts System
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}>
          {drawer}
        </Drawer>
        <Drawer variant="permanent"
          sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
          open>
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box component="main" sx={{
        flexGrow: 1, p: 3,
        width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
        mt: '64px', minHeight: 'calc(100vh - 64px)',
        bgcolor: '#f5f7fa'
      }}>
        <Outlet />
      </Box>
    </Box>
  );
}
