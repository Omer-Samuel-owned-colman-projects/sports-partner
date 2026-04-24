import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Button,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GroupIcon from '@mui/icons-material/Group';
import PlaceIcon from '@mui/icons-material/Place';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { api } from '../lib/api';
import type { GameDetail, GameDetailResponse } from '@shared/games';

export function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipError, setMembershipError] = useState('');

  useEffect(() => {
    api<GameDetailResponse>(`/api/games/${id}`)
      .then(({ game }) => setGame(game))
      .catch(() => setError('Failed to load game details'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleMembershipToggle = async () => {
    if (!game) return;

    setMembershipLoading(true);
    setMembershipError('');
    try {
      const { game: updatedGame } = await api<GameDetailResponse>(`/api/games/${id}/join`, {
        method: game.currentUserJoined ? 'DELETE' : 'POST',
      });
      setGame(updatedGame);
    } catch (err) {
      setMembershipError(err instanceof Error ? err.message : 'Failed to update game participation');
    } finally {
      setMembershipLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !game) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Game not found'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Back to games
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} sx={{ mb: 2 }}>
        Back to games
      </Button>

      <Card variant="outlined">
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" component="h1">
              {game.sport.name}
            </Typography>
            <Chip
              label={game.isOpen ? 'Open' : 'Full'}
              color={game.isOpen ? 'success' : 'default'}
              size="medium"
            />
          </Box>

          {game.description && (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {game.description}
            </Typography>
          )}

          <Stack spacing={2} sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PlaceIcon color="action" />
              <Typography>
                {game.venue.name}, {game.venue.city}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarTodayIcon color="action" />
              <Typography>
                {new Date(game.scheduledAt).toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GroupIcon color="action" />
              <Typography>
                {game.participantCount} / {game.maxPlayers} players
              </Typography>
            </Box>
          </Stack>

          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleMembershipToggle}
            disabled={membershipLoading || (!game.currentUserJoined && !game.isOpen)}
            sx={{ mb: 3 }}
          >
            {membershipLoading
              ? 'Updating...'
              : game.currentUserJoined
                ? 'Leave Game'
                : game.isOpen
                  ? 'Join Game'
                  : 'Full'}
          </Button>

          {membershipError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {membershipError}
            </Alert>
          )}

          <Divider sx={{ mb: 2 }} />

          <Typography variant="h6" gutterBottom>
            Participants ({game.participants.length})
          </Typography>

          {game.participants.length === 0 ? (
            <Typography color="text.secondary">No participants yet.</Typography>
          ) : (
            <Stack spacing={1}>
              {game.participants.map((p) => (
                <Typography key={p.userId} variant="body2" color="text.secondary">
                  Player #{p.userId} — joined{' '}
                  {new Date(p.joinedAt).toLocaleDateString()}
                </Typography>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
