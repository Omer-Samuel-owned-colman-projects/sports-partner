import { useEffect, useState, type FormEvent } from 'react';
import {
  TextField,
  Button,
  Alert,
  Stack,
  MenuItem,
  CircularProgress,
  Box,
} from '@mui/material';
import { api, ApiRequestError } from '../lib/api';
import type { SportsResponse, VenuesResponse } from '@shared/catalog';

export interface GameFormValues {
  sportId: number;
  venueId: number;
  scheduledAt: string;
  maxPlayers: number;
  description: string;
}

function initialFieldState(defaultValues?: Partial<GameFormValues>) {
  return {
    sportId: defaultValues?.sportId ?? 0,
    venueId: defaultValues?.venueId ?? 0,
    scheduledAt: defaultValues?.scheduledAt ?? '',
    maxPlayers:
      defaultValues?.maxPlayers != null ? String(defaultValues.maxPlayers) : '10',
    description: defaultValues?.description ?? '',
  };
}

export function buildMutationBody(values: GameFormValues) {
  return {
    sport_id: values.sportId,
    venue_id: values.venueId,
    date_time: new Date(values.scheduledAt).toISOString(),
    max_players: values.maxPlayers,
    description: values.description?.trim() || undefined,
  };
}

interface GameFormProps {
  defaultValues?: Partial<GameFormValues>;
  submitLabel: string;
  onSubmit: (values: GameFormValues) => Promise<void>;
}

export function GameForm({ defaultValues, submitLabel, onSubmit }: GameFormProps) {
  const init = initialFieldState(defaultValues);
  const [sportId, setSportId] = useState(init.sportId);
  const [venueId, setVenueId] = useState(init.venueId);
  const [scheduledAt, setScheduledAt] = useState(init.scheduledAt);
  const [maxPlayers, setMaxPlayers] = useState(init.maxPlayers);
  const [description, setDescription] = useState(init.description);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [sportsList, setSportsList] = useState<SportsResponse['sports']>([]);
  const [venuesList, setVenuesList] = useState<VenuesResponse['venues']>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<SportsResponse>('/api/sports'), api<VenuesResponse>('/api/venues')])
      .then(([sportsRes, venuesRes]) => {
        if (!cancelled) {
          setSportsList(sportsRes.sports);
          setVenuesList(venuesRes.venues);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load sports and venues');
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (sportId <= 0) {
      setError('Select a sport');
      return;
    }
    if (venueId <= 0) {
      setError('Select a venue');
      return;
    }
    if (!scheduledAt.trim()) {
      setError('Date and time is required');
      return;
    }
    if (Number.isNaN(new Date(scheduledAt).getTime())) {
      setError('Invalid date and time');
      return;
    }

    const maxParsed = Number.parseInt(maxPlayers, 10);
    if (!Number.isFinite(maxParsed) || maxParsed < 1 || maxParsed > 500) {
      setError('Max players must be between 1 and 500');
      return;
    }

    const values: GameFormValues = {
      sportId,
      venueId,
      scheduledAt,
      maxPlayers: maxParsed,
      description,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Server error, please try again later');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const optionsUnavailable = !optionsLoading && (sportsList.length === 0 || venuesList.length === 0);

  if (optionsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}

        <TextField
          select
          label="Sport"
          value={sportId === 0 ? '' : sportId}
          onChange={(e) => {
            const v = e.target.value;
            setSportId(v === '' ? 0 : Number(v));
          }}
          required
          fullWidth
          disabled={optionsUnavailable}
        >
          <MenuItem value="">
            <em>Select sport</em>
          </MenuItem>
          {sportsList.map((sport) => (
            <MenuItem key={sport.id} value={sport.id}>
              {sport.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Venue"
          value={venueId === 0 ? '' : venueId}
          onChange={(e) => {
            const v = e.target.value;
            setVenueId(v === '' ? 0 : Number(v));
          }}
          required
          fullWidth
          disabled={optionsUnavailable}
        >
          <MenuItem value="">
            <em>Select venue</em>
          </MenuItem>
          {venuesList.map((venue) => (
            <MenuItem key={venue.id} value={venue.id}>
              {venue.name}, {venue.city}
            </MenuItem>
          ))}
        </TextField>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}
        >
          <TextField
            label="Date and time"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
            size="small"
            fullWidth
            sx={{ flex: 1, minWidth: 0 }}
            slotProps={{ inputLabel: { shrink: true } }}
            disabled={optionsUnavailable}
          />
          <TextField
            label="Max players"
            type="number"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(e.target.value)}
            required
            size="small"
            fullWidth
            sx={{ width: { xs: '100%', sm: 120 }, flexShrink: 0 }}
            slotProps={{ htmlInput: { min: 1, max: 500 } }}
            disabled={optionsUnavailable}
          />
        </Stack>

        <TextField
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          minRows={3}
          fullWidth
          disabled={optionsUnavailable}
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={isSubmitting || optionsUnavailable}
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </Stack>
    </form>
  );
}
