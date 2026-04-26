import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { Game, GameComment, GameLike, Participant, Sport, Venue } from '../db/schema.js';
import { parsePositiveIntQueryParam } from '../lib/query.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import type {
  GamesResponse,
  GameCommentsResponse,
  GameDetailResponse,
  GameMutationResponse,
} from '../types/games.js';
import { gameMutationBodySchema, formatZodError } from '../validation/gameBody.js';
import { hydrateGameWeatherForRows, shapeGameDetailRow, shapeGameRow } from '../lib/gameWeather.js';

export const gamesRouter = Router();

function toObjectId(val: string) {
  return new mongoose.Types.ObjectId(val);
}

type AggregatedGameRow = {
  id: string;
  scheduledAt: Date;
  maxPlayers: number;
  description: string | null;
  isOpen: boolean;
  createdAt: Date;
  sport: { id: string; name: string };
  venue: { id: string; name: string; city: string };
  creator: { id: string };
  participantCount: number;
  likeCount: number;
  commentCount: number;
  currentUserLiked: boolean;
  currentUserJoined: boolean;
  weatherTempC: number | null;
  weatherRainMm: number | null;
  weatherFetchedAt: Date | null;
  weatherFinal: boolean;
};

async function aggregateGames(
  matchFilter: Record<string, unknown>,
  userId: string | undefined,
  options?: { skip?: number; limit?: number },
): Promise<AggregatedGameRow[]> {
  const userOid = userId ? toObjectId(userId) : null;

  const pipeline: mongoose.PipelineStage[] = [
    { $match: matchFilter },
    {
      $lookup: {
        from: 'sports',
        localField: 'sportId',
        foreignField: '_id',
        as: '_sport',
      },
    },
    { $unwind: '$_sport' },
    {
      $lookup: {
        from: 'venues',
        localField: 'venueId',
        foreignField: '_id',
        as: '_venue',
      },
    },
    { $unwind: '$_venue' },
    {
      $lookup: {
        from: 'participants',
        localField: '_id',
        foreignField: 'gameId',
        as: '_participants',
      },
    },
    {
      $lookup: {
        from: 'gamelikes',
        localField: '_id',
        foreignField: 'gameId',
        as: '_likes',
      },
    },
    {
      $lookup: {
        from: 'gamecomments',
        localField: '_id',
        foreignField: 'gameId',
        as: '_comments',
      },
    },
    { $sort: { scheduledAt: 1 as const } },
    ...(options?.skip ? [{ $skip: options.skip }] : []),
    ...(options?.limit ? [{ $limit: options.limit }] : []),
    {
      $project: {
        _id: 0,
        id: { $toString: '$_id' },
        scheduledAt: 1,
        maxPlayers: 1,
        description: 1,
        isOpen: 1,
        createdAt: 1,
        sport: { id: { $toString: '$_sport._id' }, name: '$_sport.name' },
        venue: {
          id: { $toString: '$_venue._id' },
          name: '$_venue.name',
          city: '$_venue.city',
        },
        creator: { id: { $toString: '$creatorId' } },
        participantCount: { $size: '$_participants' },
        likeCount: { $size: '$_likes' },
        commentCount: { $size: '$_comments' },
        currentUserLiked: userOid
          ? { $in: [userOid, '$_likes.userId'] }
          : { $literal: false },
        currentUserJoined: userOid
          ? { $in: [userOid, '$_participants.userId'] }
          : { $literal: false },
        weatherTempC: 1,
        weatherRainMm: 1,
        weatherFetchedAt: 1,
        weatherFinal: 1,
      },
    },
  ];

  return Game.aggregate<AggregatedGameRow>(pipeline);
}

async function fetchGameDetail(gameId: string, userId: string | undefined): Promise<GameDetailResponse | null> {
  const rows = await aggregateGames({ _id: toObjectId(gameId) }, userId);
  const row = rows[0];
  if (!row) return null;

  await hydrateGameWeatherForRows([row]);

  const gameParticipants = await Participant.find({ gameId: toObjectId(gameId) })
    .select('userId joinedAt')
    .lean();

  const participants = gameParticipants.map((p) => ({
    userId: p.userId.toString(),
    joinedAt: p.joinedAt,
  }));

  return { game: shapeGameDetailRow(row, participants) };
}

// GET /api/games
gamesRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { sport, venue, user, page, limit } = req.query;

    let sportId: string | null = null;
    let venueId: string | null = null;
    let userId: string | null = null;
    let pageNum: number | null = null;
    let limitNum: number | null = null;

    try {
      if (typeof sport === 'string' && sport) {
        if (mongoose.Types.ObjectId.isValid(sport)) {
          sportId = sport;
        } else {
          const s = await Sport.findOne({ name: { $regex: `^${sport}$`, $options: 'i' } });
          sportId = s?._id.toString() ?? null;
        }
      }
      if (typeof venue === 'string' && venue) {
        if (mongoose.Types.ObjectId.isValid(venue)) {
          venueId = venue;
        } else {
          const v = await Venue.findOne({ name: { $regex: `^${venue}$`, $options: 'i' } });
          venueId = v?._id.toString() ?? null;
        }
      }
      if (typeof user === 'string' && user) userId = user;
      pageNum = parsePositiveIntQueryParam(page);
      limitNum = parsePositiveIntQueryParam(limit);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid query params' });
      return;
    }

    const shouldPaginate = pageNum !== null || limitNum !== null;
    const resolvedPage = pageNum ?? 1;
    const resolvedLimit = Math.min(limitNum ?? 10, 50);

    const matchFilter: Record<string, unknown> = {};
    if (!userId) {
      matchFilter.isOpen = true;
      matchFilter.scheduledAt = { $gt: new Date() };
    }
    if (sportId) matchFilter.sportId = toObjectId(sportId);
    if (venueId) matchFilter.venueId = toObjectId(venueId);
    if (userId) matchFilter.creatorId = toObjectId(userId);

    let total = 0;
    if (shouldPaginate) {
      total = await Game.countDocuments(matchFilter);
    }

    const rows = await aggregateGames(matchFilter, req.user?.id, {
      skip: shouldPaginate ? (resolvedPage - 1) * resolvedLimit : undefined,
      limit: shouldPaginate ? resolvedLimit : undefined,
    });

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

  const sport = await Sport.findById(sport_id);
  if (!sport) {
    res.status(400).json({ error: 'sport_id does not exist' });
    return;
  }

  const venue = await Venue.findById(venue_id);
  if (!venue) {
    res.status(400).json({ error: 'venue_id does not exist' });
    return;
  }

  const userId = req.user!.id;

  try {
    const game = await Game.create({
      creatorId: toObjectId(userId),
      sportId: toObjectId(sport_id),
      venueId: toObjectId(venue_id),
      scheduledAt: new Date(date_time),
      maxPlayers: max_players,
      description: description || null,
    });

    await Participant.create({ gameId: game._id, userId: toObjectId(userId) });

    res.status(201).json({ game: { id: game._id.toString() } } satisfies GameMutationResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// GET /api/games/:id
gamesRouter.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const gameId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const detail = await fetchGameDetail(gameId, req.user?.id);
    if (!detail) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    res.json(detail satisfies GameDetailResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// POST /api/games/:id/join
gamesRouter.post('/:id/join', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const userId = req.user!.id;

    const game = await Game.findById(gameId).select('maxPlayers isOpen');
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    if (!game.isOpen) {
      res.status(409).json({ error: 'Game is full' });
      return;
    }

    const existing = await Participant.findOne({
      gameId: toObjectId(gameId),
      userId: toObjectId(userId),
    });
    if (existing) {
      res.status(409).json({ error: 'Already joined' });
      return;
    }

    await Participant.create({ gameId: toObjectId(gameId), userId: toObjectId(userId) });

    const participantCount = await Participant.countDocuments({ gameId: toObjectId(gameId) });
    if (participantCount >= game.maxPlayers) {
      await Game.updateOne({ _id: gameId }, { isOpen: false });
    }

    const detail = await fetchGameDetail(gameId, userId);
    res.json(detail! satisfies GameDetailResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// DELETE /api/games/:id/join
gamesRouter.delete('/:id/join', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const userId = req.user!.id;

    const game = await Game.findById(gameId).select('maxPlayers');
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const existing = await Participant.findOne({
      gameId: toObjectId(gameId),
      userId: toObjectId(userId),
    });
    if (!existing) {
      res.status(409).json({ error: 'Not joined' });
      return;
    }

    await Participant.deleteOne({ gameId: toObjectId(gameId), userId: toObjectId(userId) });

    const participantCount = await Participant.countDocuments({ gameId: toObjectId(gameId) });
    if (participantCount < game.maxPlayers) {
      await Game.updateOne({ _id: gameId }, { isOpen: true });
    }

    const detail = await fetchGameDetail(gameId, userId);
    res.json(detail! satisfies GameDetailResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// POST /api/games/:id/like
gamesRouter.post('/:id/like', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const userId = req.user!.id;
    const game = await Game.findById(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    await GameLike.updateOne(
      { gameId: toObjectId(gameId), userId: toObjectId(userId) },
      { $setOnInsert: { gameId: toObjectId(gameId), userId: toObjectId(userId) } },
      { upsert: true },
    );
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// DELETE /api/games/:id/like
gamesRouter.delete('/:id/like', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const userId = req.user!.id;
    await GameLike.deleteOne({ gameId: toObjectId(gameId), userId: toObjectId(userId) });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// GET /api/games/:id/comments
gamesRouter.get('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }

    const game = await Game.findById(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const comments = await GameComment.find({ gameId: toObjectId(gameId) })
      .sort({ createdAt: -1 })
      .select('userId content createdAt')
      .lean();

    res.json({
      comments: comments.map((c) => ({
        id: c._id.toString(),
        userId: c.userId.toString(),
        content: c.content,
        createdAt: c.createdAt,
      })),
    } satisfies GameCommentsResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// POST /api/games/:id/comments
gamesRouter.post('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const gameId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
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

    const game = await Game.findById(gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const comment = await GameComment.create({
      gameId: toObjectId(gameId),
      userId: toObjectId(req.user!.id),
      content,
    });

    res.status(201).json({
      comment: {
        id: comment._id.toString(),
        userId: comment.userId.toString(),
        content: comment.content,
        createdAt: comment.createdAt,
      },
    });
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// PUT /api/games/:id
gamesRouter.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const gameId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(gameId)) {
    res.status(400).json({ error: 'Invalid game ID' });
    return;
  }

  const parsed = gameMutationBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const { sport_id, venue_id, date_time, max_players, description } = parsed.data;

  const existing = await Game.findById(gameId).select('creatorId scheduledAt venueId');
  if (!existing) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }

  if (existing.creatorId.toString() !== req.user!.id) {
    res.status(403).json({ error: 'You can only edit games you created' });
    return;
  }

  const sport = await Sport.findById(sport_id);
  if (!sport) {
    res.status(400).json({ error: 'sport_id does not exist' });
    return;
  }

  const venue = await Venue.findById(venue_id);
  if (!venue) {
    res.status(400).json({ error: 'venue_id does not exist' });
    return;
  }

  try {
    const nextScheduled = new Date(date_time);
    const scheduleChanged = existing.scheduledAt.getTime() !== nextScheduled.getTime();
    const venueChanged = existing.venueId.toString() !== venue_id;
    const resetWeather = scheduleChanged || venueChanged;

    await Game.updateOne(
      { _id: gameId },
      {
        sportId: toObjectId(sport_id),
        venueId: toObjectId(venue_id),
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
      },
    );

    res.json({ game: { id: gameId } } satisfies GameMutationResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});
