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
} from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import PlaceIcon from '@mui/icons-material/Place';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import uniqBy from 'lodash/uniqBy';
import { api } from '../lib/api';
import type { Game, GamesResponse } from '@shared/games';

export function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [allOpenGames, setAllOpenGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSportId, setSelectedSportId] = useState('');
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api<GamesResponse>('/api/games')
      .then(({ games }) => setAllOpenGames(games))
      .catch(() => setError('Failed to load games'));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedSportId) params.set('sport', selectedSportId);
    if (selectedVenueId) params.set('venue', selectedVenueId);

    const query = params.toString();
    const url = query ? `/api/games?${query}` : '/api/games';

    setIsLoading(true);
    setError('');
    api<GamesResponse>(url)
      .then(({ games }) => setGames(games))
      .catch(() => setError('Failed to load games'))
      .finally(() => setIsLoading(false));
  }, [selectedSportId, selectedVenueId]);

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

                  <Stack direction="row" spacing={3} sx={{ color: 'text.secondary' }}>
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
