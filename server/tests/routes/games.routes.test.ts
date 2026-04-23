import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

jest.mock('../../src/db/client.js', () => ({
  db: {
    select: jest.fn(),
  },
}));

import { createApp } from '../../src/app.js';
import { db } from '../../src/db/client.js';

type ListChain = {
  from: jest.Mock;
  innerJoin: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
};

type DetailChain = {
  from: jest.Mock;
  innerJoin?: jest.Mock;
  where: jest.Mock;
  limit?: jest.Mock;
};

const createListGamesChain = (result: unknown, shouldReject = false): ListChain => {
  // `jest.Mock` without type args becomes `Mock<unknown, ...>` and `mockResolvedValue`/`mockRejectedValue`
  // infer `never` for their arguments. Loosen with `any` for test doubles only.
  const orderBy = jest.fn() as jest.Mock<any>;
  if (shouldReject) {
    orderBy.mockRejectedValue(new Error('db failure'));
  } else {
    orderBy.mockResolvedValue(result);
  }

  const chain: ListChain = {
    from: jest.fn() as jest.Mock,
    innerJoin: jest.fn() as jest.Mock,
    where: jest.fn() as jest.Mock,
    orderBy,
  };

  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);

  return chain;
};

const createGameDetailChain = (result: unknown): DetailChain => {
  const limit = jest.fn() as jest.Mock<any>;
  limit.mockResolvedValue(result);

  const chain = {
    from: jest.fn() as jest.Mock,
    innerJoin: jest.fn() as jest.Mock,
    where: jest.fn() as jest.Mock,
    limit,
  } as DetailChain;

  chain.from.mockReturnValue(chain);
  chain.innerJoin?.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);

  return chain;
};

const createParticipantsChain = (result: unknown): DetailChain => {
  const where = jest.fn() as jest.Mock<any>;
  where.mockResolvedValue(result);

  const chain = {
    from: jest.fn() as jest.Mock,
    where,
  } as DetailChain;

  chain.from.mockReturnValue(chain);

  return chain;
};

describe('games routes', () => {
  const app = createApp();

  const selectMock = db.select as jest.Mock;

  beforeEach(() => {
    selectMock.mockReset();
  });

  describe('GET /api/games', () => {
    it('returns 200 and game list without filters', async () => {
      const rows = [{ id: 1, isOpen: true }];
      const chain = createListGamesChain(rows);
      selectMock.mockReturnValue(chain);

      const response = await request(app).get('/api/games');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ games: rows });
      expect(chain.where).toHaveBeenCalledTimes(1);
    });

    it('returns 200 when sport and venue filters are valid', async () => {
      const rows = [{ id: 2, isOpen: true }];
      const chain = createListGamesChain(rows);
      selectMock.mockReturnValue(chain);

      const response = await request(app).get('/api/games?sport=1&venue=2');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ games: rows });
    });

    it('returns 400 for invalid sport query value', async () => {
      const response = await request(app).get('/api/games?sport=abc');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'must be a positive integer' });
      expect(selectMock).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid venue query value', async () => {
      const response = await request(app).get('/api/games?venue=0');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'must be a positive integer' });
      expect(selectMock).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/games/:id', () => {
    it('returns 400 for invalid id', async () => {
      const response = await request(app).get('/api/games/not-a-number');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid game ID' });
      expect(selectMock).not.toHaveBeenCalled();
    });

    it('returns 404 when game does not exist', async () => {
      const detailChain = createGameDetailChain([]);
      selectMock.mockReturnValueOnce(detailChain);

      const response = await request(app).get('/api/games/999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Game not found' });
    });

    it('returns 200 with game and participants', async () => {
      const row = { id: 10, sport: { id: 1, name: 'Tennis' } };
      const participants = [{ userId: 1, joinedAt: new Date().toISOString() }];
      const detailChain = createGameDetailChain([row]);
      const participantsChain = createParticipantsChain(participants);
      selectMock
        .mockReturnValueOnce(detailChain)
        .mockReturnValueOnce(participantsChain);

      const response = await request(app).get('/api/games/10');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ game: { ...row, participants } });
    });
  });
});
