import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const originalEnv = process.env;

const importJwtModule = async () => {
  jest.resetModules();
  return import('../../src/lib/jwt.js');
};

describe('jwt lib', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('signs and verifies token payload', async () => {
    process.env.JWT_SECRET = 'test-secret';
    const { signToken, verifyToken } = await importJwtModule();

    const token = signToken({ id: 7, email: 'test@example.com', name: 'Tester' });
    const payload = verifyToken(token);

    expect(payload.id).toBe(7);
    expect(payload.email).toBe('test@example.com');
    expect(payload.name).toBe('Tester');
  });

  it('uses secure cookie in production', async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'production';
    const { getCookieOptions } = await importJwtModule();

    expect(getCookieOptions().secure).toBe(true);
  });

  it('does not use secure cookie in non-production', async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'development';
    const { getCookieOptions } = await importJwtModule();

    expect(getCookieOptions().secure).toBe(false);
  });

  it('throws when JWT_SECRET is missing at module load', async () => {
    delete process.env.JWT_SECRET;

    await expect(importJwtModule()).rejects.toThrow('JWT_SECRET environment variable is required');
  });
});
