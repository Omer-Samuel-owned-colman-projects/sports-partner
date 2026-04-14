import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { GameForm, buildMutationBody, type GameFormValues } from '../components/GameForm';
import { api, ApiRequestError } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { GameDetailResponse, GameMutationResponse } from '@shared/games';

export function EditGamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [defaults, setDefaults] = useState<Partial<GameFormValues> | null>(null);
  const [loadError, setLoadError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoadError('Invalid game');
      setIsLoading(false);
      return;
    }

    api<GameDetailResponse>(`/api/games/${id}`)
      .then(({ game }) => {
        if (user && game.creator.id !== user.id) {
          setForbidden(true);
          return;
        }
        
        // `datetime-local` needs local calendar/clock, not `toISOString()` (UTC).
        const d = new Date(game.scheduledAt);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const minute = String(d.getMinutes()).padStart(2, '0');
        const scheduledAtLocal = `${year}-${month}-${day}T${hour}:${minute}`;

        setDefaults({
          sportId: game.sport.id,
          venueId: game.venue.id,
          scheduledAt: scheduledAtLocal,
          maxPlayers: game.maxPlayers,
          description: game.description ?? '',
        });
      })
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 404) {
          setLoadError('Game not found');
        } else {
          setLoadError('Failed to load game');
        }
      })
      .finally(() => setIsLoading(false));
  }, [id, user]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{loadError}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Back to games
        </Button>
      </Container>
    );
  }

  if (forbidden || !defaults || !id) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning">You can only edit games you created.</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/games/${id}`)} sx={{ mt: 2 }}>
          Back to game
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/games/${id}`)} sx={{ mb: 2 }}>
        Back to game
      </Button>
      <Typography variant="h4" component="h1" gutterBottom>
        Edit game
      </Typography>
      <Box sx={{ mt: 2 }}>
        <GameForm
          key={id}
          defaultValues={defaults}
          submitLabel="Save changes"
          onSubmit={async (values) => {
            const { game } = await api<GameMutationResponse>(`/api/games/${id}`, {
              method: 'PUT',
              body: JSON.stringify(buildMutationBody(values)),
            });
            navigate(`/games/${game.id}`, { replace: true });
          }}
        />
      </Box>
    </Container>
  );
}
