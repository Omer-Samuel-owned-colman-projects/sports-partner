import { Router, type Request, type Response } from 'express';
import { and, count, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '../db/client.js';

import { gameComments, gameLikes, games, sports, venues, participants } from '../db/schema.js';
import { parsePositiveIntQueryParam } from '../lib/query.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import type { GamesResponse, GameCommentsResponse, GameDetailResponse, GameMutationResponse } from '../types/games.js';
import { gameMutationBodySchema, formatZodError } from '../validation/gameBody.js';
import {
  hydrateGameWeatherForRows,
  shapeGameDetailRow,
  shapeGameRow,
} from '../lib/gameWeather.js';

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
  weatherTempC: games.weatherTempC,
  weatherRainMm: games.weatherRainMm,
  weatherFetchedAt: games.weatherFetchedAt,
  weatherFinal: games.weatherFinal,
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
    const { sport, venue, user, page, limit } = req.query;

    let sportId: number | null = null;
    let venueId: number | null = null;
    let userId: number | null = null;
    let pageNum: number | null = null;
    let limitNum: number | null = null;

    try {
      sportId = parsePositiveIntQueryParam(sport);
      venueId = parsePositiveIntQueryParam(venue);
      userId = parsePositiveIntQueryParam(user);
      pageNum = parsePositiveIntQueryParam(page);
      limitNum = parsePositiveIntQueryParam(limit);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid query params' });
      return;
    }
    const shouldPaginate = pageNum !== null || limitNum !== null;
    const resolvedPage = pageNum ?? 1;
    const resolvedLimit = Math.min(limitNum ?? 10, 50);

    const whereConditions = [];
    if (!userId) {
      whereConditions.push(eq(games.isOpen, true));
      whereConditions.push(gt(games.scheduledAt, new Date()));
    }
    if (sportId) whereConditions.push(eq(games.sportId, sportId));
    if (venueId) whereConditions.push(eq(games.venueId, venueId));
    if (userId) whereConditions.push(eq(games.creatorId, userId));
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    let total = 0;
    if (shouldPaginate) {
      [{ value: total }] = await db
        .select({ value: count() })
        .from(games)
        .where(whereClause);
    }

    const baseQuery = db
      .select({
        ...gameSelect,
        currentUserLiked: currentUserLiked(req.user?.id),
        currentUserJoined: currentUserJoined(req.user?.id),
      })
      .from(games)
      .innerJoin(sports, eq(games.sportId, sports.id))
      .innerJoin(venues, eq(games.venueId, venues.id))
      .where(whereClause)
      .orderBy(games.scheduledAt);

    const rows = shouldPaginate
      ? await baseQuery.limit(resolvedLimit).offset((resolvedPage - 1) * resolvedLimit)
      : await baseQuery;

    await hydrateGameWeatherForRows(rows);
    const shaped = rows.map(shapeGameRow);

    if (!shouldPaginate) {
      res.json({ games: shaped } satisfies GamesResponse);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(total / resolvedLimit));
    res.json({
      games: shaped,
      pagination: {
        page: resolvedPage,
        limit: resolvedLimit,
        total,
        totalPages,
        hasMore: resolvedPage < totalPages,
      },
    } satisfies GamesResponse);
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

    await hydrateGameWeatherForRows([row]);

    const gameParticipants = await db
      .select({
        userId: participants.userId,
        joinedAt: participants.joinedAt,
      })
      .from(participants)
      .where(eq(participants.gameId, gameId));

    res.json({
      game: shapeGameDetailRow(row, gameParticipants),
    } satisfies GameDetailResponse);
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

    await hydrateGameWeatherForRows([row!]);

    const gameParticipants = await db
      .select({
        userId: participants.userId,
        joinedAt: participants.joinedAt,
      })
      .from(participants)
      .where(eq(participants.gameId, gameId));

    res.json({
      game: shapeGameDetailRow(row!, gameParticipants),
    } satisfies GameDetailResponse);
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

    await hydrateGameWeatherForRows([row!]);

    const gameParticipants = await db
      .select({
        userId: participants.userId,
        joinedAt: participants.joinedAt,
      })
      .from(participants)
      .where(eq(participants.gameId, gameId));

    res.json({
      game: shapeGameDetailRow(row!, gameParticipants),
    } satisfies GameDetailResponse);
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
})
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
    .select({
      id: games.id,
      creatorId: games.creatorId,
      scheduledAt: games.scheduledAt,
      venueId: games.venueId,
    })
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
    const nextScheduled = new Date(date_time);
    const scheduleChanged = existing.scheduledAt.getTime() !== nextScheduled.getTime();
    const venueChanged = existing.venueId !== venue_id;
    const resetWeather = scheduleChanged || venueChanged;

    await db
      .update(games)
      .set({
        sportId: sport_id,
        venueId: venue_id,
        scheduledAt: nextScheduled,
        maxPlayers: max_players,
        description: description || null,
        ...(resetWeather
          ? {
              weatherTempC: null,
              weatherRainMm: null,
              weatherFetchedAt: null,
              weatherFinal: false,
            }
          : {}),
      })
      .where(eq(games.id, gameId));

    res.json({ game: { id: gameId } } satisfies GameMutationResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});
