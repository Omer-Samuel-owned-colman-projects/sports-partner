import { Router, type Request, type Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { games, sports, venues, participants } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { gameMutationBodySchema, formatZodError } from '../validation/gameBody.js';
import type { GamesResponse, GameDetailResponse, GameMutationResponse } from '../types/games.js';

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
gamesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select(gameSelect)
      .from(games)
      .innerJoin(sports, eq(games.sportId, sports.id))
      .innerJoin(venues, eq(games.venueId, venues.id))
      .orderBy(games.scheduledAt);

    res.json({ games: rows } satisfies GamesResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// POST /api/games
gamesRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = gameMutationBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const { sport_id, venue_id, date_time, max_players, description } = parsed.data;

  const [sport] = await db.select({ id: sports.id }).from(sports).where(eq(sports.id, sport_id)).limit(1);
  if (!sport) {
    res.status(400).json({ error: 'sport_id does not exist' });
    return;
  }

  const [venue] = await db.select({ id: venues.id }).from(venues).where(eq(venues.id, venue_id)).limit(1);
  if (!venue) {
    res.status(400).json({ error: 'venue_id does not exist' });
    return;
  }

  const userId = req.user!.id;

  try {
    const newId = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(games)
        .values({
          creatorId: userId,
          sportId: sport_id,
          venueId: venue_id,
          scheduledAt: new Date(date_time),
          maxPlayers: max_players,
          description: description || null,
        })
        .returning({ id: games.id });

      await tx.insert(participants).values({ gameId: inserted.id, userId });
      return inserted.id;
    });

    res.status(201).json({ game: { id: newId } } satisfies GameMutationResponse);
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

// PUT /api/games/:id
gamesRouter.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const gameId = Number(req.params.id);
  if (Number.isNaN(gameId)) {
    res.status(400).json({ error: 'Invalid game ID' });
    return;
  }

  const parsed = gameMutationBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const { sport_id, venue_id, date_time, max_players, description } = parsed.data;

  const [existing] = await db
    .select({ id: games.id, creatorId: games.creatorId })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }

  if (existing.creatorId !== req.user!.id) {
    res.status(403).json({ error: 'You can only edit games you created' });
    return;
  }

  const [sport] = await db.select({ id: sports.id }).from(sports).where(eq(sports.id, sport_id)).limit(1);
  if (!sport) {
    res.status(400).json({ error: 'sport_id does not exist' });
    return;
  }

  const [venue] = await db.select({ id: venues.id }).from(venues).where(eq(venues.id, venue_id)).limit(1);
  if (!venue) {
    res.status(400).json({ error: 'venue_id does not exist' });
    return;
  }

  try {
    await db
      .update(games)
      .set({
        sportId: sport_id,
        venueId: venue_id,
        scheduledAt: new Date(date_time),
        maxPlayers: max_players,
        description: description || null,
      })
      .where(eq(games.id, gameId));

    res.json({ game: { id: gameId } } satisfies GameMutationResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});
