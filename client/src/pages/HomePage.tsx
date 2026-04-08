import { Container, Typography, Box, Button } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export function HomePage() {
  const { user, logout } = useAuth();

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Sports Partner
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Hello, {user?.name}!
        </Typography>
        <Button variant="outlined" onClick={logout}>
          Logout
        </Button>
      </Box>
    </Container>
  );
}
