import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';

jest.mock('../../src/lib/jwt.js', () => ({
  COOKIE_NAME: 'token',
  verifyToken: jest.fn(),
}));

import { requireAuth } from '../../src/middleware/auth.js';
import { verifyToken } from '../../src/lib/jwt.js';

const createResponseMock = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  return { status, json };
};

describe('requireAuth', () => {
  const verifyTokenMock = jest.mocked(verifyToken);

  beforeEach(() => {
    verifyTokenMock.mockReset();
  });

  it('returns 401 when cookie token is missing', () => {
    const req = { cookies: {} } as unknown as Request;
    const res = createResponseMock() as unknown as Response;
    const next = jest.fn() as NextFunction;

    requireAuth(req, res, next);

    expect((res as unknown as { status: jest.Mock }).status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches user and calls next for valid token', () => {
    verifyTokenMock.mockReturnValue({ id: 1, email: 'a@a.com', name: 'A' });
    const req = { cookies: { token: 'valid-token' } } as unknown as Request;
    const res = createResponseMock() as unknown as Response;
    const next = jest.fn() as NextFunction;

    requireAuth(req, res, next);

    expect(verifyTokenMock).toHaveBeenCalledWith('valid-token');
    expect(req.user).toEqual({ id: 1, email: 'a@a.com', name: 'A' });
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when token verification fails', () => {
    verifyTokenMock.mockImplementation(() => {
      throw new Error('bad token');
    });
    const req = { cookies: { token: 'invalid-token' } } as unknown as Request;
    const res = createResponseMock() as unknown as Response;
    const next = jest.fn() as NextFunction;

    requireAuth(req, res, next);

    expect((res as unknown as { status: jest.Mock }).status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
