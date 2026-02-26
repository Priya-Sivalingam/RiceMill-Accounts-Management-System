import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button,
  Typography, Alert, CircularProgress, InputAdornment, IconButton
} from '@mui/material';
import { Visibility, VisibilityOff, GrainRounded } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a5276 0%, #2e86ab 50%, #a8d5ba 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <Card sx={{ width: 400, borderRadius: 3, boxShadow: 10 }}>
        <CardContent sx={{ p: 4 }}>
          {/* Logo */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{
              width: 70, height: 70, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1a5276, #2e86ab)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mx: 'auto', mb: 1
            }}>
              <GrainRounded sx={{ color: 'white', fontSize: 40 }} />
            </Box>
            <Typography variant="h5" fontWeight="bold" color="primary">
              Rice Mill Accounts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to your account
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth label="Username" margin="normal"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required autoFocus
            />
            <TextField
              fullWidth label="Password" margin="normal"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <Button
              fullWidth type="submit" variant="contained" size="large"
              sx={{ mt: 3, py: 1.5, borderRadius: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </form>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
            Default: admin / Admin@1234
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
