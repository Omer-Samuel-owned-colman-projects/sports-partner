import { Navigate, Link as RouterLink } from 'react-router-dom';
import { Container, Card, CardContent, Typography, Link } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { LoginForm } from '../components/LoginForm';

export function LoginPage() {
  const { user, isLoading } = useAuth();

  if (!isLoading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom textAlign="center">
            Login
          </Typography>
          <LoginForm />
          <Typography variant="body2" textAlign="center" sx={{ mt: 2 }}>
            Don't have an account?{' '}
            <Link component={RouterLink} to="/register">Register</Link>
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}
