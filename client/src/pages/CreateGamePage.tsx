import { useNavigate } from 'react-router-dom';
import { Container, Typography, Button, Box } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { GameForm, buildMutationBody } from '../components/GameForm';
import { api } from '../lib/api';
import type { GameMutationResponse } from '@shared/games';

export function CreateGamePage() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} sx={{ mb: 2 }}>
        Back to games
      </Button>
      <Typography variant="h4" component="h1" gutterBottom>
        Create game
      </Typography>
      <Box sx={{ mt: 2 }}>
        <GameForm
          submitLabel="Create game"
          onSubmit={async (values) => {
            const { game } = await api<GameMutationResponse>('/api/games', {
              method: 'POST',
              body: JSON.stringify(buildMutationBody(values)),
            });
            navigate(`/games/${game.id}`, { replace: true });
          }}
        />
      </Box>
    </Container>
  );
}
