import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { signToken, getCookieOptions, COOKIE_NAME } from '../lib/jwt.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, profileImageUrl } = req.body;
    const normalizedProfileImageUrl = typeof profileImageUrl === 'string' ? profileImageUrl.trim() : '';
    if (normalizedProfileImageUrl) {
      try {
        const parsedUrl = new URL(normalizedProfileImageUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          res.status(400).json({ error: 'Profile image URL must use http or https' });
          return;
        }
      } catch {
        res.status(400).json({ error: 'Profile image URL must be a valid URL' });
        return;
      }
    }


    if (!name || !email || !password) {
      res.status(400).json({ error: 'This field is required' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: 'Email is already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db
      .insert(users)
      .values({ name, email, passwordHash, profileImageUrl: normalizedProfileImageUrl || null })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        profileImageUrl: users.profileImageUrl,
      });

    const token = signToken({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      profileImageUrl: newUser.profileImageUrl ?? null,
    });
    res.cookie(COOKIE_NAME, token, getCookieOptions());
    res.status(201).json({ user: newUser });
  } catch (err: unknown) {
    if (
      typeof err === 'object' && err !== null &&
      'code' in err && (err as { code: string }).code === '23505'
    ) {
      res.status(409).json({ error: 'Email is already registered' });
      return;
    }
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'This field is required' });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      profileImageUrl: user.profileImageUrl ?? null,
    });
    res.cookie(COOKIE_NAME, token, getCookieOptions());
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
      },
    });
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, getCookieOptions());
  res.json({ success: true });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  const { id, name, email, profileImageUrl } = req.user!;
  res.json({ user: { id, name, email, profileImageUrl: profileImageUrl ?? null } });
});

// PUT /api/auth/profile
authRouter.put('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const profileImageUrlRaw =
      typeof req.body?.profileImageUrl === 'string' ? req.body.profileImageUrl.trim() : '';

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    if (name.length > 100) {
      res.status(400).json({ error: 'Name cannot exceed 100 characters' });
      return;
    }

    if (profileImageUrlRaw) {
      try {
        const parsedUrl = new URL(profileImageUrlRaw);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          res.status(400).json({ error: 'Profile image URL must use http or https' });
          return;
        }
      } catch {
        res.status(400).json({ error: 'Profile image URL must be a valid URL' });
        return;
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        name,
        profileImageUrl: profileImageUrlRaw || null,
      })
      .where(eq(users.id, req.user!.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        profileImageUrl: users.profileImageUrl,
      });

    if (!updatedUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const token = signToken({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      profileImageUrl: updatedUser.profileImageUrl ?? null,
    });
    res.cookie(COOKIE_NAME, token, getCookieOptions());
    res.json({ user: updatedUser });
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});
