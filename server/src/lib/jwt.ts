import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { CookieOptions } from 'express';
import { RefreshToken, User } from '../db/schema.js';

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
  id: string;
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

export async function createRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await RefreshToken.create({ userId, token, expiresAt });

  return token;
}

export async function rotateRefreshToken(oldToken: string): Promise<{ accessToken: string; refreshToken: string; user: JwtPayload } | null> {
  const row = await RefreshToken.findOne({ token: oldToken });

  if (!row || row.expiresAt < new Date()) {
    if (row) {
      await RefreshToken.deleteOne({ _id: row._id });
    }
    return null;
  }

  await RefreshToken.deleteOne({ _id: row._id });

  const user = await User.findById(row.userId).select('name email profileImageUrl');
  if (!user) return null;

  const payload: JwtPayload = {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    profileImageUrl: user.profileImageUrl ?? null,
  };
  const accessToken = signToken(payload);
  const refreshToken = await createRefreshToken(user._id.toString());

  return { accessToken, refreshToken, user: payload };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await RefreshToken.deleteOne({ token });
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await RefreshToken.deleteMany({ userId });
}

export async function cleanExpiredTokens(): Promise<void> {
  await RefreshToken.deleteMany({ expiresAt: { $lt: new Date() } });
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
