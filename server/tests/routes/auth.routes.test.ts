import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';

jest.mock('../../src/db/client.js', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
  },
}));
jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
    compare: jest.fn(),
  },
}));
jest.mock('../../src/lib/jwt.js', () => ({
  COOKIE_NAME: 'token',
  signToken: jest.fn(),
  getCookieOptions: jest.fn(),
}));
jest.mock('../../src/middleware/auth.js', () => ({
  requireAuth: jest.fn(),
}));

import { createApp } from '../../src/app.js';
import { db } from '../../src/db/client.js';
import { signToken, getCookieOptions } from '../../src/lib/jwt.js';
import { requireAuth } from '../../src/middleware/auth.js';

const createSelectChain = (result: unknown) => {
  const limit = jest.fn() as jest.Mock<any>;
  limit.mockResolvedValue(result);

  const chain = {
    from: jest.fn() as jest.Mock,
    where: jest.fn() as jest.Mock,
    limit,
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
};

const createInsertChain = (result: unknown) => {
  const returning = jest.fn() as jest.Mock<any>;
  returning.mockResolvedValue(result);

  const chain = {
    values: jest.fn() as jest.Mock,
    returning,
  };
  chain.values.mockReturnValue(chain);
  return chain;
};

describe('auth routes', () => {
  const app = createApp();

  const selectMock = db.select as jest.Mock;
  const insertMock = db.insert as jest.Mock;
  const hashMock = bcrypt.hash as jest.Mock<any>;
  const compareMock = bcrypt.compare as jest.Mock<any>;
  const signTokenMock = signToken as jest.Mock;
  const getCookieOptionsMock = getCookieOptions as jest.Mock;
  const requireAuthMock = requireAuth as jest.Mock;

  beforeEach(() => {
    selectMock.mockReset();
    insertMock.mockReset();
    hashMock.mockReset();
    compareMock.mockReset();
    signTokenMock.mockReset();
    getCookieOptionsMock.mockReset();
    requireAuthMock.mockReset();

    getCookieOptionsMock.mockReturnValue({ httpOnly: true });
    signTokenMock.mockReturnValue('signed-token');
    requireAuthMock.mockImplementation((req: unknown, _res: unknown, next: unknown) => {
      (req as Request).user = { id: 1, name: 'Test', email: 'test@example.com' };
      (next as NextFunction)();
    });
  });

  it('POST /register returns 400 for missing fields', async () => {
    const response = await request(app).post('/api/auth/register').send({ email: 'a@a.com' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'This field is required' });
  });

  it('POST /register returns 409 when email exists', async () => {
    selectMock.mockReturnValue(createSelectChain([{ id: 1 }]));

    const response = await request(app).post('/api/auth/register').send({
      name: 'User',
      email: 'exists@example.com',
      password: '123456',
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'Email is already registered' });
  });

  it('POST /register returns 201 for successful registration', async () => {
    selectMock.mockReturnValue(createSelectChain([]));
    insertMock.mockReturnValue(createInsertChain([{ id: 2, name: 'User', email: 'new@example.com' }]));
    hashMock.mockResolvedValue('hashed-password');

    const response = await request(app).post('/api/auth/register').send({
      name: 'User',
      email: 'new@example.com',
      password: '123456',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ user: { id: 2, name: 'User', email: 'new@example.com' } });
  });

  it('POST /login returns 401 when user not found', async () => {
    selectMock.mockReturnValue(createSelectChain([]));

    const response = await request(app).post('/api/auth/login').send({
      email: 'missing@example.com',
      password: '123456',
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid email or password' });
  });

  it('POST /login returns 200 with user when credentials are valid', async () => {
    selectMock.mockReturnValue(createSelectChain([{
      id: 3,
      name: 'Login User',
      email: 'login@example.com',
      passwordHash: 'stored-hash',
    }]));
    compareMock.mockResolvedValue(true);

    const response = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: '123456',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: { id: 3, name: 'Login User', email: 'login@example.com' },
    });
  });

  it('POST /logout returns success', async () => {
    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it('GET /me returns authenticated user', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: { id: 1, name: 'Test', email: 'test@example.com' },
    });
  });
});
