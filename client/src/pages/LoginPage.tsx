import { Navigate, Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Container, Card, CardContent, Typography, Link, Divider, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { LoginForm } from '../components/LoginForm';
import { GoogleLoginButton } from '../components/GoogleLoginButton';

export function LoginPage() {
  const { user, isLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const oauthError = searchParams.get('error');

  if (!isLoading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom textAlign="center">
            Login
          </Typography>
          {oauthError && (
            <Alert severity="error">Google login failed. Please try again.</Alert>
          )}
          <GoogleLoginButton />
          <Divider>or</Divider>
          <LoginForm />
          <Typography variant="body2" textAlign="center">
            Don't have an account?{' '}
            <Link component={RouterLink} to="/register">Register</Link>
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}
