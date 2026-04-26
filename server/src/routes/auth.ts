import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import multer from 'multer';
import passport from 'passport';
import { User } from '../db/schema.js';
import {
  signToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  getAccessCookieOptions,
  getRefreshCookieOptions,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '../lib/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

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

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
}

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

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ error: 'Email is already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await User.create({ name, email, passwordHash, profileImageUrl: null });

    const accessToken = signToken({
      id: newUser._id.toString(),
      email: newUser.email,
      name: newUser.name,
      profileImageUrl: newUser.profileImageUrl ?? null,
    });
    const refreshToken = await createRefreshToken(newUser._id.toString());
    setAuthCookies(res, accessToken, refreshToken);
    res.status(201).json({
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        profileImageUrl: newUser.profileImageUrl,
      },
    });
  } catch (err: unknown) {
    if (
      typeof err === 'object' && err !== null &&
      'code' in err && (err as { code: number }).code === 11000
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

    const user = await User.findOne({ email });

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const accessToken = signToken({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      profileImageUrl: user.profileImageUrl ?? null,
    });
    const refreshToken = await createRefreshToken(user._id.toString());
    setAuthCookies(res, accessToken, refreshToken);
    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
      },
    });
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// POST /api/auth/refresh
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const oldToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!oldToken) {
      res.status(401).json({ error: 'No refresh token' });
      return;
    }

    const result = await rotateRefreshToken(oldToken);
    if (!result) {
      res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        profileImageUrl: result.user.profileImageUrl ?? null,
      },
    });
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (refreshToken) {
    await revokeRefreshToken(refreshToken).catch(() => {});
  }
  res.clearCookie(ACCESS_COOKIE_NAME, getAccessCookieOptions());
  res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
  res.json({ success: true });
});

// GET /api/auth/google
authRouter.get(
  '/google',
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] }),
);

// GET /api/auth/google/callback
authRouter.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${CLIENT_ORIGIN}/login?error=oauth_failed`,
  }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user! as { id: string; _id: { toString(): string }; email: string; name: string; profileImageUrl: string | null | undefined };
      const userId = user.id ?? user._id.toString();

      const accessToken = signToken({
        id: userId,
        email: user.email,
        name: user.name,
        profileImageUrl: user.profileImageUrl ?? null,
      });
      const refreshToken = await createRefreshToken(userId);

      res.cookie(ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
      res.redirect(CLIENT_ORIGIN);
    } catch {
      res.redirect(`${CLIENT_ORIGIN}/login?error=oauth_failed`);
    }
  },
);

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

      const currentUser = await User.findById(req.user!.id).select('profileImageUrl');

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

      const updatedUser = await User.findByIdAndUpdate(
        req.user!.id,
        { name, profileImageUrl: nextProfileImageUrl },
        { new: true, projection: { name: 1, email: 1, profileImageUrl: 1 } },
      );

      if (!updatedUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const accessToken = signToken({
        id: updatedUser._id.toString(),
        email: updatedUser.email,
        name: updatedUser.name,
        profileImageUrl: updatedUser.profileImageUrl ?? null,
      });
      res.cookie(ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
      res.json({
        user: {
          id: updatedUser._id.toString(),
          name: updatedUser.name,
          email: updatedUser.email,
          profileImageUrl: updatedUser.profileImageUrl,
        },
      });
    } catch {
      res.status(500).json({ error: 'Server error, please try again later' });
    }
  });
});
