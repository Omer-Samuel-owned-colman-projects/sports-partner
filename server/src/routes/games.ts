import { Router, type Request, type Response } from 'express';
import { and, count, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { games, sports, venues, participants } from '../db/schema.js';
import { parsePositiveIntQueryParam } from '../lib/query.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import type { GamesResponse, GameDetailResponse } from '../types/games.js';

export const gamesRouter = Router();

const participantCount = sql<number>`(
  SELECT count(*)::int FROM participants WHERE participants.game_id = games.id
)`.as('participant_count');

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
} as const;

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
