import type { Request, Response, NextFunction } from 'express';
import { verifyToken, COOKIE_NAME, type JwtPayload } from '../lib/jwt.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    next();
    return;
  }
  try {
    req.user = verifyToken(token);
  } catch {
    // Invalid token: treat as unauthenticated
  }
  next();
}
