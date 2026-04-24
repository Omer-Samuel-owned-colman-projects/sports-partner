import { Router, type Request, type Response } from 'express';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { gameComments, gameLikes, games, sports, venues, participants } from '../db/schema.js';
import { parsePositiveIntQueryParam } from '../lib/query.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import type { GamesResponse, GameCommentsResponse, GameDetailResponse } from '../types/games.js';

export const gamesRouter = Router();

const participantCount = sql<number>`(
  SELECT count(*)::int FROM participants WHERE participants.game_id = games.id
)`.as('participant_count');
const likeCount = sql<number>`(
  SELECT count(*)::int FROM game_likes WHERE game_likes.game_id = games.id
)`.as('like_count');
const commentCount = sql<number>`(
  SELECT count(*)::int FROM game_comments WHERE game_comments.game_id = games.id
)`.as('comment_count');

const gameSelect = {
  id: games.id,
  scheduledAt: games.scheduledAt,
  maxPlayers: games.maxPlayers,
  description: games.description,
  isOpen: games.isOpen,
  createdAt: games.createdAt,
  sport: { id: sports.id, name: sports.name },
  venue: { id: venues.id, name: venues.name, city: venues.city },
  creator: { id: games.creatorId },
  participantCount,
  likeCount,
  commentCount,
} as const;

function currentUserLiked(userId: number | undefined) {
  if (!userId) return sql<boolean>`false`.as('current_user_liked');
  return sql<boolean>`EXISTS (
    SELECT 1 FROM game_likes
    WHERE game_likes.game_id = games.id
    AND game_likes.user_id = ${userId}
  )`.as('current_user_liked');
}

function currentUserJoined(userId: number | undefined) {
  if (!userId) return sql<boolean>`false`.as('current_user_joined');
  return sql<boolean>`EXISTS (
    SELECT 1 FROM participants
    WHERE participants.game_id = games.id
    AND participants.user_id = ${userId}
  )`.as('current_user_joined');
}

// GET /api/games
gamesRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { sport, venue } = req.query;

    let sportId: number | null = null;
    let venueId: number | null = null;

    try {
      sportId = parsePositiveIntQueryParam(sport);
      venueId = parsePositiveIntQueryParam(venue);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid query params' });
      return;
    }

    const whereConditions = [eq(games.isOpen, true)];
    if (sportId) whereConditions.push(eq(games.sportId, sportId));
    if (venueId) whereConditions.push(eq(games.venueId, venueId));

    const rows = await db
      .select({
        ...gameSelect,
        currentUserLiked: currentUserLiked(req.user?.id),
        currentUserJoined: currentUserJoined(req.user?.id),
      })
      .from(games)
      .innerJoin(sports, eq(games.sportId, sports.id))
      .innerJoin(venues, eq(games.venueId, venues.id))
      .where(and(...whereConditions))
      .orderBy(games.scheduledAt);

    res.json({ games: rows } satisfies GamesResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// GET /api/games/:id
gamesRouter.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const gameId = Number(req.params.id);
    if (Number.isNaN(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const [row] = await db
      .select({
        ...gameSelect,
        currentUserLiked: currentUserLiked(req.user?.id),
        currentUserJoined: currentUserJoined(req.user?.id),
      })
      .from(games)
      .innerJoin(sports, eq(games.sportId, sports.id))
      .innerJoin(venues, eq(games.venueId, venues.id))
      .where(eq(games.id, gameId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const gameParticipants = await db
      .select({
        userId: participants.userId,
        joinedAt: participants.joinedAt,
      })
      .from(participants)
      .where(eq(participants.gameId, gameId));

    res.json({ game: { ...row, participants: gameParticipants } } satisfies GameDetailResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// POST /api/games/:id/join
gamesRouter.post('/:id/join', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = Number(req.params.id);
    if (Number.isNaN(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const userId = req.user!.id;

    const result = await db.transaction(async (tx) => {
      const [game] = await tx
        .select({ maxPlayers: games.maxPlayers, isOpen: games.isOpen })
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1);

      if (!game) return { error: 'Game not found', status: 404 as const };
      if (!game.isOpen) return { error: 'Game is full', status: 409 as const };

      const [existing] = await tx
        .select({ gameId: participants.gameId })
        .from(participants)
        .where(and(eq(participants.gameId, gameId), eq(participants.userId, userId)))
        .limit(1);

      if (existing) return { error: 'Already joined', status: 409 as const };

      await tx.insert(participants).values({ gameId, userId });

      const [{ value: participantCount }] = await tx
        .select({ value: count() })
        .from(participants)
        .where(eq(participants.gameId, gameId));

      if (participantCount >= game.maxPlayers) {
        await tx.update(games).set({ isOpen: false }).where(eq(games.id, gameId));
      }

      return null;
    });

    if (result) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    // Return refreshed game detail
    const [row] = await db
      .select({
        ...gameSelect,
        currentUserLiked: currentUserLiked(userId),
        currentUserJoined: currentUserJoined(userId),
      })
      .from(games)
      .innerJoin(sports, eq(games.sportId, sports.id))
      .innerJoin(venues, eq(games.venueId, venues.id))
      .where(eq(games.id, gameId))
      .limit(1);

    const gameParticipants = await db
      .select({
        userId: participants.userId,
        joinedAt: participants.joinedAt,
      })
      .from(participants)
      .where(eq(participants.gameId, gameId));

    res.json({ game: { ...row!, participants: gameParticipants } } satisfies GameDetailResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// DELETE /api/games/:id/join
gamesRouter.delete('/:id/join', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = Number(req.params.id);
    if (Number.isNaN(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const userId = req.user!.id;

    const result = await db.transaction(async (tx) => {
      const [game] = await tx
        .select({ id: games.id, maxPlayers: games.maxPlayers })
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1);

      if (!game) return { error: 'Game not found', status: 404 as const };

      const [existing] = await tx
        .select({ gameId: participants.gameId })
        .from(participants)
        .where(and(eq(participants.gameId, gameId), eq(participants.userId, userId)))
        .limit(1);

      if (!existing) return { error: 'Not joined', status: 409 as const };

      await tx
        .delete(participants)
        .where(and(eq(participants.gameId, gameId), eq(participants.userId, userId)));

      const [{ value: participantCount }] = await tx
        .select({ value: count() })
        .from(participants)
        .where(eq(participants.gameId, gameId));

      if (participantCount < game.maxPlayers) {
        await tx.update(games).set({ isOpen: true }).where(eq(games.id, gameId));
      }

      return null;
    });

    if (result) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const [row] = await db
      .select({
        ...gameSelect,
        currentUserLiked: currentUserLiked(userId),
        currentUserJoined: currentUserJoined(userId),
      })
      .from(games)
      .innerJoin(sports, eq(games.sportId, sports.id))
      .innerJoin(venues, eq(games.venueId, venues.id))
      .where(eq(games.id, gameId))
      .limit(1);

    const gameParticipants = await db
      .select({
        userId: participants.userId,
        joinedAt: participants.joinedAt,
      })
      .from(participants)
      .where(eq(participants.gameId, gameId));

    res.json({ game: { ...row!, participants: gameParticipants } } satisfies GameDetailResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// POST /api/games/:id/like
gamesRouter.post('/:id/like', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = Number(req.params.id);
    if (Number.isNaN(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const userId = req.user!.id;
    const [game] = await db.select({ id: games.id }).from(games).where(eq(games.id, gameId)).limit(1);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    await db.insert(gameLikes).values({ gameId, userId }).onConflictDoNothing();
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// DELETE /api/games/:id/like
gamesRouter.delete('/:id/like', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = Number(req.params.id);
    if (Number.isNaN(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const userId = req.user!.id;
    await db.delete(gameLikes).where(and(eq(gameLikes.gameId, gameId), eq(gameLikes.userId, userId)));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// GET /api/games/:id/comments
gamesRouter.get('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = Number(req.params.id);
    if (Number.isNaN(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const [game] = await db.select({ id: games.id }).from(games).where(eq(games.id, gameId)).limit(1);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const comments = await db
      .select({
        id: gameComments.id,
        userId: gameComments.userId,
        content: gameComments.content,
        createdAt: gameComments.createdAt,
      })
      .from(gameComments)
      .where(eq(gameComments.gameId, gameId))
      .orderBy(desc(gameComments.createdAt));

    res.json({ comments } satisfies GameCommentsResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// POST /api/games/:id/comments
gamesRouter.post('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = Number(req.params.id);
    if (Number.isNaN(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content) {
      res.status(400).json({ error: 'Comment cannot be empty' });
      return;
    }
    if (content.length > 500) {
      res.status(400).json({ error: 'Comment cannot exceed 500 characters' });
      return;
    }

    const [game] = await db.select({ id: games.id }).from(games).where(eq(games.id, gameId)).limit(1);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const [comment] = await db
      .insert(gameComments)
      .values({ gameId, userId: req.user!.id, content })
      .returning({
        id: gameComments.id,
        userId: gameComments.userId,
        content: gameComments.content,
        createdAt: gameComments.createdAt,
      });

    res.status(201).json({ comment });
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});
