import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { api, ApiRequestError } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Game, GamesResponse } from '@shared/games';

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [profileImageUrl, setProfileImageUrl] = useState(user?.profileImageUrl ?? '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    api<GamesResponse>(`/api/games?user=${user.id}`)
      .then(({ games }) => setGames(games))
      .catch(() => setError('Failed to load your games'))
      .finally(() => setIsLoadingGames(false));
  }, [user]);

  useEffect(() => {
    setName(user?.name ?? '');
    setProfileImageUrl(user?.profileImageUrl ?? '');
  }, [user, editOpen]);

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">Unable to load user profile.</Alert>
      </Container>
    );
  }

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile(name, profileImageUrl);
      setEditOpen(false);
      setError('');
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'Failed to update profile';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Avatar src={user.profileImageUrl ?? undefined} sx={{ width: 72, height: 72 }}>
            {user.name.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5">{user.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
          </Box>
          <Button variant="outlined" onClick={() => setEditOpen(true)}>
            Edit Profile
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 2 }}>
        My Games
      </Typography>

      {isLoadingGames ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : games.length === 0 ? (
        <Typography color="text.secondary">You have not created any games yet.</Typography>
      ) : (
        <Stack spacing={2}>
          {games.map((game) => (
            <Card key={game.id} variant="outlined">
              <CardActionArea onClick={() => navigate(`/games/${game.id}`)}>
                <CardContent>
                  <Typography variant="h6">{game.sport.name}</Typography>
                  {game.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {game.description}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {game.venue.name}, {game.venue.city}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(game.scheduledAt).toLocaleString()}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleSaveProfile}>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              inputProps={{ maxLength: 100 }}
            />
            <TextField
              label="Profile Image URL"
              value={profileImageUrl}
              onChange={(event) => setProfileImageUrl(event.target.value)}
              placeholder="https://example.com/photo.jpg"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isSaving || !name.trim()}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Container>
  );
}
