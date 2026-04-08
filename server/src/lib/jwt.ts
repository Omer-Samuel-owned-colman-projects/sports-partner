// server/src/lib/jwt.ts
import jwt from 'jsonwebtoken';
import type { CookieOptions } from 'express';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRY = '7d';
const COOKIE_NAME = 'token';

export interface JwtPayload {
  id: number;
  email: string;
  name: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function getCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };
}

export { COOKIE_NAME };
