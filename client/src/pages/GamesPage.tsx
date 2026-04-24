import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import PlaceIcon from '@mui/icons-material/Place';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import uniqBy from 'lodash/uniqBy';
import { api, ApiRequestError } from '../lib/api';
import type { Game, GamesResponse, GameDetailResponse } from '@shared/games';

export function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [allOpenGames, setAllOpenGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSportId, setSelectedSportId] = useState('');
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [membershipGameId, setMembershipGameId] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api<GamesResponse>('/api/games')
      .then(({ games }) => setAllOpenGames(games))
      .catch(() => setError('Failed to load games'));
  }, []);

  const fetchGames = (sportId: string, venueId: string) => {
    const params = new URLSearchParams();
    if (sportId) params.set('sport', sportId);
    if (venueId) params.set('venue', venueId);

    const query = params.toString();
    const url = query ? `/api/games?${query}` : '/api/games';

    setIsLoading(true);
    setError('');
    api<GamesResponse>(url)
      .then(({ games }) => setGames(games))
      .catch(() => setError('Failed to load games'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchGames(selectedSportId, selectedVenueId);
  }, [selectedSportId, selectedVenueId]);

  const handleMembershipToggle = async (e: React.MouseEvent, game: Game) => {
    e.stopPropagation();
    setMembershipGameId(game.id);
    try {
      await api<GameDetailResponse>(`/api/games/${game.id}/join`, {
        method: game.currentUserJoined ? 'DELETE' : 'POST',
      });
      fetchGames(selectedSportId, selectedVenueId);
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'Failed to update game participation';
      setError(message);
    } finally {
      setMembershipGameId(null);
    }
  };

  const handleLikeToggle = async (e: React.MouseEvent, game: Game) => {
    e.stopPropagation();
    const nextLiked = !game.currentUserLiked;
    const nextLikeCount = Math.max(0, game.likeCount + (nextLiked ? 1 : -1));

    const patchLikeState = (targetGames: Game[]) =>
      targetGames.map((candidate) =>
        candidate.id === game.id
          ? { ...candidate, currentUserLiked: nextLiked, likeCount: nextLikeCount }
          : candidate,
      );

    setGames((prev) => patchLikeState(prev));
    setAllOpenGames((prev) => patchLikeState(prev));

    try {
      await api<void>(`/api/games/${game.id}/like`, {
        method: game.currentUserLiked ? 'DELETE' : 'POST',
      });
    } catch (err) {
      const rollback = (targetGames: Game[]) =>
        targetGames.map((candidate) =>
          candidate.id === game.id
            ? { ...candidate, currentUserLiked: game.currentUserLiked, likeCount: game.likeCount }
            : candidate,
        );
      setGames((prev) => rollback(prev));
      setAllOpenGames((prev) => rollback(prev));
      const message = err instanceof ApiRequestError ? err.message : 'Failed to update like';
      setError(message);
    }
  };

  const sportOptions = uniqBy(
    allOpenGames.map((game) => game.sport),
    'id',
  );

  const venueOptions = uniqBy(
    allOpenGames.map((game) => game.venue),
    'id',
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Games
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="sport-filter-label">Sport</InputLabel>
          <Select
            labelId="sport-filter-label"
            label="Sport"
            value={selectedSportId}
            onChange={(event) => setSelectedSportId(event.target.value)}
          >
            <MenuItem value="">All sports</MenuItem>
            {sportOptions.map((sport) => (
              <MenuItem key={sport.id} value={String(sport.id)}>
                {sport.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel id="venue-filter-label">Venue</InputLabel>
          <Select
            labelId="venue-filter-label"
            label="Venue"
            value={selectedVenueId}
            onChange={(event) => setSelectedVenueId(event.target.value)}
          >
            <MenuItem value="">All venues</MenuItem>
            {venueOptions.map((venue) => (
              <MenuItem key={venue.id} value={String(venue.id)}>
                {venue.name}, {venue.city}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {games.length === 0 ? (
        <Typography color="text.secondary">No open games match the selected filters.</Typography>
      ) : (
        <Stack spacing={2}>
          {games.map((game) => (
            <Card key={game.id} variant="outlined">
              <CardActionArea onClick={() => navigate(`/games/${game.id}`)}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6">{game.sport.name}</Typography>
                    <Chip
                      label={game.isOpen ? 'Open' : 'Full'}
                      color={game.isOpen ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>

                  {game.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {game.description}
                    </Typography>
                  )}

                  <Stack direction="row" spacing={3} sx={{ color: 'text.secondary', flexWrap: 'wrap', rowGap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PlaceIcon fontSize="small" />
                      <Typography variant="body2">
                        {game.venue.name}, {game.venue.city}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarTodayIcon fontSize="small" />
                      <Typography variant="body2">
                        {new Date(game.scheduledAt).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <GroupIcon fontSize="small" />
                      <Typography variant="body2">
                        {game.participantCount}/{game.maxPlayers}
                      </Typography>
                    </Box>
                    <Box sx={{ ml: 'auto' }}>
                      <Button
                        size="small"
                        variant={game.currentUserLiked ? 'contained' : 'outlined'}
                        color={game.currentUserLiked ? 'error' : 'inherit'}
                        startIcon={game.currentUserLiked ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                        onClick={(e) => handleLikeToggle(e, game)}
                        sx={{ mr: 1 }}
                      >
                        {game.likeCount}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ChatBubbleOutlineIcon />}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/games/${game.id}/comments`);
                        }}
                        sx={{ mr: 1 }}
                      >
                        {game.commentCount}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={membershipGameId === game.id || (!game.currentUserJoined && !game.isOpen)}
                        onClick={(e) => handleMembershipToggle(e, game)}
                      >
                        {membershipGameId === game.id
                          ? 'Updating...'
                          : game.currentUserJoined
                            ? 'Leave'
                            : game.isOpen
                              ? 'Join'
                              : 'Full'}
                      </Button>
                    </Box>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
}
