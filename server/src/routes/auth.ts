import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import multer from 'multer';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { signToken, getCookieOptions, getClearCookieOptions, COOKIE_NAME } from '../lib/jwt.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();
const uploadsDir = path.join(process.cwd(), 'uploads', 'profiles');

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await fs.mkdir(uploadsDir, { recursive: true });
        cb(null, uploadsDir);
      } catch (err) {
        cb(err as Error, uploadsDir);
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;


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
      .values({ name, email, passwordHash, profileImageUrl: null })
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
  res.clearCookie(COOKIE_NAME, getClearCookieOptions());
  res.json({ success: true });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  const { id, name, email, profileImageUrl } = req.user!;
  res.json({ user: { id, name, email, profileImageUrl: profileImageUrl ?? null } });
});

// PUT /api/auth/profile
authRouter.put('/profile', requireAuth, async (req: Request, res: Response) => {
  upload.single('profileImage')(req, res, async (uploadErr) => {
    if (uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Profile image must be 5MB or less' });
      return;
    }
    if (uploadErr) {
      res.status(400).json({ error: 'Profile image must be a valid image file' });
      return;
    }

    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      if (name.length > 100) {
        res.status(400).json({ error: 'Name cannot exceed 100 characters' });
        return;
      }

      const [currentUser] = await db
        .select({ profileImageUrl: users.profileImageUrl })
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      if (!currentUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      let nextProfileImageUrl = currentUser.profileImageUrl;

      if (req.file) {
        nextProfileImageUrl = `/uploads/profiles/${req.file.filename}`;
        if (currentUser.profileImageUrl?.startsWith('/uploads/profiles/')) {
          const oldFile = path.basename(currentUser.profileImageUrl);
          const oldPath = path.join(uploadsDir, oldFile);
          void fs.unlink(oldPath).catch(() => undefined);
        }
      }

      const [updatedUser] = await db
        .update(users)
        .set({
          name,
          profileImageUrl: nextProfileImageUrl,
        })
        .where(eq(users.id, req.user!.id))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          profileImageUrl: users.profileImageUrl,
        });

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
});
