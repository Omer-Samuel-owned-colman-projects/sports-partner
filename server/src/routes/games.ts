import { Router, type Request, type Response } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { games, sports, venues, participants } from '../db/schema.js';
import { parsePositiveIntQueryParam } from '../lib/query.js';
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

// GET /api/games
gamesRouter.get('/', async (req: Request, res: Response) => {
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
      .select(gameSelect)
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
gamesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const gameId = Number(req.params.id);
    if (Number.isNaN(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const [row] = await db
      .select(gameSelect)
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
