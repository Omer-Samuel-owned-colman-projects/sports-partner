import { FormEvent, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { api, ApiRequestError } from '../lib/api';

type SupportedLanguage = 'hebrew' | 'english' | 'russian';

type AiGameSummary = {
  id: number;
  sport: string;
  venue: string;
  city: string;
  scheduledAt: string;
  maxPlayers: number;
  isOpen: boolean;
  description: string | null;
};

type AiSearchResponse = {
  detectedLanguage: SupportedLanguage;
  parsedSearch: {
    sportType: string | null;
    city: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    detectedLanguage: SupportedLanguage;
  };
  games: AiGameSummary[];
  answer: string;
};

export function ChatbotPage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputError, setInputError] = useState('');
  const [result, setResult] = useState<AiSearchResponse | null>(null);

  const hasNonEnglishLetters = (value: string) => /[^\x00-\x7F]/.test(value);
  const sanitizeToEnglishInput = (value: string) => value.replace(/[^\x00-\x7F]/g, '');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const userQuery = query.trim();
    if (!userQuery) return;

    setIsLoading(true);
    setError('');
    try {
      const res = await api<AiSearchResponse>('/api/ai/search', {
        method: 'POST',
        body: JSON.stringify({ query: userQuery }),
      });
      setResult(res);
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'Failed to get AI response';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        AI Assistant
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Ask in English only. Non-English letters are blocked.
      </Typography>

      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
        <TextField
          fullWidth
          label="Ask for games"
          value={query}
          onChange={(event) => {
            const raw = event.target.value;
            const cleaned = sanitizeToEnglishInput(raw);
            setQuery(cleaned);
            if (hasNonEnglishLetters(raw)) {
              setInputError('Only English characters are allowed.');
            } else {
              setInputError('');
            }
          }}
          placeholder="e.g. Basketball in Tel Aviv tomorrow evening"
          disabled={isLoading}
          error={Boolean(inputError)}
          helperText={inputError || ' '}
        />
        <Button type="submit" variant="contained" disabled={isLoading || !query.trim()}>
          {isLoading ? 'Searching...' : 'Ask'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress />
        </Box>
      )}

      {result && !isLoading && (
        <Stack spacing={2}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Detected language: {result.detectedLanguage}
              </Typography>
              <Typography variant="body1" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                {result.answer}
              </Typography>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Matching games ({result.games.length})
              </Typography>
              {result.games.length === 0 ? (
                <Typography color="text.secondary">No matching open games found.</Typography>
              ) : (
                <Stack spacing={1.25}>
                  {result.games.map((game) => (
                    <Box key={game.id} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                      <Typography variant="subtitle1">{game.sport}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {game.venue}, {game.city}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(game.scheduledAt).toLocaleString()}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}
    </Container>
  );
}

