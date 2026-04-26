import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { CookieOptions } from 'express';
import { db } from '../db/client.js';
import { refreshTokens } from '../db/schema.js';
import { eq, lt } from 'drizzle-orm';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ACCESS_COOKIE_NAME = 'token';
const REFRESH_COOKIE_NAME = 'refresh_token';

export interface JwtPayload {
  id: number;
  email: string;
  name: string;
  profileImageUrl?: string | null;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function createRefreshToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await db.insert(refreshTokens).values({ userId, token, expiresAt });

  return token;
}

export async function rotateRefreshToken(oldToken: string): Promise<{ accessToken: string; refreshToken: string; user: JwtPayload } | null> {
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, oldToken))
    .limit(1);

  if (!row || row.expiresAt < new Date()) {
    if (row) {
      await db.delete(refreshTokens).where(eq(refreshTokens.token, oldToken));
    }
    return null;
  }

  // Delete the old token
  await db.delete(refreshTokens).where(eq(refreshTokens.token, oldToken));

  // Look up the user to build the JWT payload
  const { users } = await import('../db/schema.js');
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);

  if (!user) return null;

  const payload: JwtPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    profileImageUrl: user.profileImageUrl ?? null,
  };
  const accessToken = signToken(payload);
  const refreshToken = await createRefreshToken(user.id);

  return { accessToken, refreshToken, user: payload };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
}

export async function revokeAllUserRefreshTokens(userId: number): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
}

export async function cleanExpiredTokens(): Promise<void> {
  await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date()));
}

export function getAccessCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
  };
}

export function getRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
    path: '/api/auth',
  };
}

export { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME };
