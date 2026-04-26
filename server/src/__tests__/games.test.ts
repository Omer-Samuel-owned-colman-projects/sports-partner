import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { Game, Sport, Venue, Participant } from '../db/schema.js';
import { createTestToken } from './setup.js';

const app = createApp();

const userId = new mongoose.Types.ObjectId();
const otherUserId = new mongoose.Types.ObjectId();

const token = createTestToken({
  id: userId.toString(),
  email: 'test@example.com',
  name: 'Test User',
});

const otherToken = createTestToken({
  id: otherUserId.toString(),
  email: 'other@example.com',
  name: 'Other User',
});

let sportId: string;
let venueId: string;

beforeEach(async () => {
  const sport = await Sport.create({ name: 'Basketball' });
  const venue = await Venue.create({ name: 'Sportek', city: 'Tel Aviv' });
  sportId = sport._id.toString();
  venueId = venue._id.toString();
});

function futureDate(hoursFromNow = 24): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

// ── Game Creation ─────────────────────────────────────────

describe('POST /api/games', () => {
  it('should create a game and auto-join the creator', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Cookie', `token=${token}`)
      .send({
        sport_id: sportId,
        venue_id: venueId,
        date_time: futureDate(),
        max_players: 10,
        description: 'Pickup game',
      });

    expect(res.status).toBe(201);
    expect(res.body.game.id).toBeDefined();

    const participant = await Participant.findOne({
      gameId: new mongoose.Types.ObjectId(res.body.game.id),
      userId,
    });
    expect(participant).not.toBeNull();
  });

  it('should reject creation without authentication', async () => {
    const res = await request(app)
      .post('/api/games')
      .send({
        sport_id: sportId,
        venue_id: venueId,
        date_time: futureDate(),
        max_players: 10,
      });

    expect(res.status).toBe(401);
  });

  it('should reject creation with a past date_time', async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString();

    const res = await request(app)
      .post('/api/games')
      .set('Cookie', `token=${token}`)
      .send({
        sport_id: sportId,
        venue_id: venueId,
        date_time: pastDate,
        max_players: 10,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/future/i);
  });

  it('should reject creation with an invalid sport_id', async () => {
    const fakeSportId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post('/api/games')
      .set('Cookie', `token=${token}`)
      .send({
        sport_id: fakeSportId,
        venue_id: venueId,
        date_time: futureDate(),
        max_players: 10,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sport_id/i);
  });

  it('should reject creation with an invalid venue_id', async () => {
    const fakeVenueId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post('/api/games')
      .set('Cookie', `token=${token}`)
      .send({
        sport_id: sportId,
        venue_id: fakeVenueId,
        date_time: futureDate(),
        max_players: 10,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/venue_id/i);
  });

  it('should reject creation with missing required fields', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Cookie', `token=${token}`)
      .send({ sport_id: sportId });

    expect(res.status).toBe(400);
  });

  it('should reject max_players < 1', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Cookie', `token=${token}`)
      .send({
        sport_id: sportId,
        venue_id: venueId,
        date_time: futureDate(),
        max_players: 0,
      });

    expect(res.status).toBe(400);
  });

  it('should accept null description', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Cookie', `token=${token}`)
      .send({
        sport_id: sportId,
        venue_id: venueId,
        date_time: futureDate(),
        max_players: 5,
        description: null,
      });

    expect(res.status).toBe(201);
  });
});

// ── Game Search / Listing ──────────────────────────────────

describe('GET /api/games', () => {
  beforeEach(async () => {
    const sport2 = await Sport.create({ name: 'Tennis' });
    const venue2 = await Venue.create({ name: 'Hadar', city: 'Haifa' });

    await Game.create({
      creatorId: userId,
      sportId: sportId,
      venueId: venueId,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxPlayers: 10,
      description: 'Basketball game in TA',
      isOpen: true,
    });

    await Game.create({
      creatorId: userId,
      sportId: sport2._id,
      venueId: venue2._id,
      scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      maxPlayers: 4,
      description: 'Tennis in Haifa',
      isOpen: true,
    });

    await Game.create({
      creatorId: userId,
      sportId: sportId,
      venueId: venueId,
      scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      maxPlayers: 10,
      description: 'Past game',
      isOpen: true,
    });
  });

  it('should return only future open games by default', async () => {
    const res = await request(app).get('/api/games');

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(2);
    for (const g of res.body.games) {
      expect(new Date(g.scheduledAt).getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('should filter by sport name', async () => {
    const res = await request(app).get('/api/games?sport=Basketball');

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(1);
    expect(res.body.games[0].sport.name).toBe('Basketball');
  });

  it('should filter by sport name (case-insensitive)', async () => {
    const res = await request(app).get('/api/games?sport=basketball');

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(1);
  });

  it('should filter by venue name', async () => {
    const res = await request(app).get('/api/games?venue=Hadar');

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(1);
    expect(res.body.games[0].venue.name).toBe('Hadar');
  });

  it('should filter by sport ID', async () => {
    const res = await request(app).get(`/api/games?sport=${sportId}`);

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(1);
    expect(res.body.games[0].sport.id).toBe(sportId);
  });

  it('should paginate results', async () => {
    const res = await request(app).get('/api/games?page=1&limit=1');

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(1);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.pagination.totalPages).toBe(2);
    expect(res.body.pagination.hasMore).toBe(true);
  });

  it('should return all creator games (including past/closed) when user param is set', async () => {
    const res = await request(app).get(`/api/games?user=${userId.toString()}`);

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(3);
  });

  it('should ignore unrecognized sport name and return all games', async () => {
    const res = await request(app).get('/api/games?sport=Quidditch');

    expect(res.status).toBe(200);
    expect(res.body.games).toHaveLength(2);
  });
});

// ── Game Detail ────────────────────────────────────────────

describe('GET /api/games/:id', () => {
  it('should return game detail with participants', async () => {
    const game = await Game.create({
      creatorId: userId,
      sportId: sportId,
      venueId: venueId,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxPlayers: 10,
      isOpen: true,
    });

    await Participant.create({ gameId: game._id, userId });

    const res = await request(app).get(`/api/games/${game._id.toString()}`);

    expect(res.status).toBe(200);
    expect(res.body.game.id).toBe(game._id.toString());
    expect(res.body.game.participants).toHaveLength(1);
    expect(res.body.game.participants[0].userId).toBe(userId.toString());
  });

  it('should return 404 for non-existent game', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/games/${fakeId}`);

    expect(res.status).toBe(404);
  });

  it('should return 400 for invalid ObjectId', async () => {
    const res = await request(app).get('/api/games/not-a-valid-id');

    expect(res.status).toBe(400);
  });
});

// ── Join / Leave ───────────────────────────────────────────

describe('POST /api/games/:id/join', () => {
  it('should let a user join an open game', async () => {
    const game = await Game.create({
      creatorId: userId,
      sportId: sportId,
      venueId: venueId,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxPlayers: 10,
      isOpen: true,
    });

    const res = await request(app)
      .post(`/api/games/${game._id.toString()}/join`)
      .set('Cookie', `token=${otherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.game.participants).toBeDefined();
  });

  it('should reject joining when already joined', async () => {
    const game = await Game.create({
      creatorId: userId,
      sportId: sportId,
      venueId: venueId,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxPlayers: 10,
      isOpen: true,
    });

    await Participant.create({ gameId: game._id, userId: otherUserId });

    const res = await request(app)
      .post(`/api/games/${game._id.toString()}/join`)
      .set('Cookie', `token=${otherToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already/i);
  });

  it('should close the game when it fills up', async () => {
    const game = await Game.create({
      creatorId: userId,
      sportId: sportId,
      venueId: venueId,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxPlayers: 2,
      isOpen: true,
    });

    await Participant.create({ gameId: game._id, userId });

    await request(app)
      .post(`/api/games/${game._id.toString()}/join`)
      .set('Cookie', `token=${otherToken}`);

    const updated = await Game.findById(game._id);
    expect(updated!.isOpen).toBe(false);
  });

  it('should reject joining a full (closed) game', async () => {
    const game = await Game.create({
      creatorId: userId,
      sportId: sportId,
      venueId: venueId,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxPlayers: 1,
      isOpen: false,
    });

    const res = await request(app)
      .post(`/api/games/${game._id.toString()}/join`)
      .set('Cookie', `token=${otherToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/full/i);
  });
});

describe('DELETE /api/games/:id/join', () => {
  it('should let a user leave a game and re-open it', async () => {
    const game = await Game.create({
      creatorId: userId,
      sportId: sportId,
      venueId: venueId,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxPlayers: 2,
      isOpen: false,
    });

    await Participant.create({ gameId: game._id, userId });
    await Participant.create({ gameId: game._id, userId: otherUserId });

    const res = await request(app)
      .delete(`/api/games/${game._id.toString()}/join`)
      .set('Cookie', `token=${otherToken}`);

    expect(res.status).toBe(200);

    const updated = await Game.findById(game._id);
    expect(updated!.isOpen).toBe(true);
  });

  it('should return 409 if user has not joined', async () => {
    const game = await Game.create({
      creatorId: userId,
      sportId: sportId,
      venueId: venueId,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxPlayers: 10,
      isOpen: true,
    });

    const res = await request(app)
      .delete(`/api/games/${game._id.toString()}/join`)
      .set('Cookie', `token=${otherToken}`);

    expect(res.status).toBe(409);
  });
});

// ── Game Update ────────────────────────────────────────────

describe('PUT /api/games/:id', () => {
  it('should let the creator update a game', async () => {
    const game = await Game.create({
      creatorId: userId,
      sportId: sportId,
      venueId: venueId,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxPlayers: 10,
      isOpen: true,
    });

    const res = await request(app)
      .put(`/api/games/${game._id.toString()}`)
      .set('Cookie', `token=${token}`)
      .send({
        sport_id: sportId,
        venue_id: venueId,
        date_time: futureDate(48),
        max_players: 20,
        description: 'Updated',
      });

    expect(res.status).toBe(200);
    expect(res.body.game.id).toBe(game._id.toString());
  });

  it('should reject update from non-creator', async () => {
    const game = await Game.create({
      creatorId: userId,
      sportId: sportId,
      venueId: venueId,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxPlayers: 10,
      isOpen: true,
    });

    const res = await request(app)
      .put(`/api/games/${game._id.toString()}`)
      .set('Cookie', `token=${otherToken}`)
      .send({
        sport_id: sportId,
        venue_id: venueId,
        date_time: futureDate(48),
        max_players: 20,
      });

    expect(res.status).toBe(403);
  });
});
