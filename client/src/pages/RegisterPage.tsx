import { Navigate, Link as RouterLink } from 'react-router-dom';
import { Container, Card, CardContent, Typography, Link, Divider } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { RegisterForm } from '../components/RegisterForm';
import { GoogleLoginButton } from '../components/GoogleLoginButton';

export function RegisterPage() {
  const { user, isLoading } = useAuth();

  if (!isLoading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom textAlign="center">
            Register
          </Typography>
          <GoogleLoginButton />
          <Divider>or</Divider>
          <RegisterForm />
          <Typography variant="body2" textAlign="center">
            Already have an account?{' '}
            <Link component={RouterLink} to="/login">Login</Link>
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}
