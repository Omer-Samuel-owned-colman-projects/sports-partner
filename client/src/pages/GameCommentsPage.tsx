import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import { api, ApiRequestError } from '../lib/api';
import type { GameCommentsResponse, GameComment } from '@shared/games';

interface CreateCommentResponse {
  comment: GameComment;
}

export function GameCommentsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [comments, setComments] = useState<GameComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadComments = async () => {
    try {
      const { comments: loadedComments } = await api<GameCommentsResponse>(`/api/games/${id}/comments`);
      setComments(loadedComments);
      setError('');
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'Failed to load comments';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!commentText.trim()) return;

    setSaving(true);
    try {
      const { comment } = await api<CreateCommentResponse>(`/api/games/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: commentText }),
      });
      setComments((prev) => [comment, ...prev]);
      setCommentText('');
      setError('');
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'Failed to add comment';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/games/${id}`)} sx={{ mb: 2 }}>
        Back to game
      </Button>

      <Typography variant="h5" component="h1" gutterBottom>
        Comments
      </Typography>

      <Box component="form" onSubmit={handleSubmit} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            placeholder="Write a comment..."
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            inputProps={{ maxLength: 500 }}
          />
          <Button
            type="submit"
            variant="contained"
            endIcon={<SendIcon />}
            disabled={saving || !commentText.trim()}
          >
            {saving ? 'Posting...' : 'Post'}
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {comments.length === 0 ? (
        <Typography color="text.secondary">No comments yet.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {comments.map((comment) => (
            <Card key={comment.id} variant="outlined">
              <CardContent>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {comment.content}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Player #{comment.userId} - {new Date(comment.createdAt).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
}
