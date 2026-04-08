# Auth: Register & Login (JWT) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement user registration and login with JWT stored in httpOnly cookies, with a React frontend featuring Hebrew UI.

**Architecture:** Express auth routes (`/api/auth/*`) handle register/login/logout/me. JWT is signed on auth success and set as an httpOnly cookie. A `requireAuth` middleware reads the cookie to protect routes. React frontend uses an AuthContext that calls `/api/auth/me` on mount to restore session, with react-router-dom for page routing.

**Tech Stack:** Express, bcryptjs, jsonwebtoken, cookie-parser, Drizzle ORM, React, MUI, react-router-dom

**Spec:** `docs/superpowers/specs/2026-04-08-auth-register-login-design.md`

---

## File Map

### Server — New Files

| File | Responsibility |
|------|---------------|
| `server/src/lib/jwt.ts` | JWT sign/verify helpers, cookie configuration |
| `server/src/middleware/auth.ts` | `requireAuth` middleware — verify token, attach `req.user` |
| `server/src/routes/auth.ts` | Express router: register, login, logout, me |

### Server — Modified Files

| File | Change |
|------|--------|
| `server/src/index.ts` | Add cookie-parser middleware, mount auth router, update CORS for credentials |
| `server/.env.example` | Add `JWT_SECRET` |
| `server/package.json` | New dependencies |

### Client — New Files

| File | Responsibility |
|------|---------------|
| `client/src/lib/api.ts` | Fetch wrapper with credentials and JSON handling |
| `client/src/contexts/AuthContext.tsx` | Auth state, login/register/logout methods, session restore |
| `client/src/components/ProtectedRoute.tsx` | Redirect to `/login` if not authenticated |
| `client/src/components/RegisterForm.tsx` | Registration form with Hebrew labels |
| `client/src/components/LoginForm.tsx` | Login form with Hebrew labels |
| `client/src/pages/RegisterPage.tsx` | Register page layout |
| `client/src/pages/LoginPage.tsx` | Login page layout |
| `client/src/pages/HomePage.tsx` | Protected home page (placeholder) |

### Client — Modified Files

| File | Change |
|------|--------|
| `client/src/App.tsx` | Add routing with react-router-dom |
| `client/src/main.tsx` | Wrap with BrowserRouter and AuthProvider |
| `client/package.json` | Add react-router-dom |

---

## Task 1: Install Server Dependencies

**Files:**
- Modify: `server/package.json`
- Modify: `server/.env.example`

- [ ] **Step 1: Install dependencies**

Run from repo root:

```bash
cd server && npm install bcryptjs jsonwebtoken cookie-parser && npm install -D @types/bcryptjs @types/jsonwebtoken @types/cookie-parser
```

- [ ] **Step 2: Add JWT_SECRET to .env.example**

Add to `server/.env.example`:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/sports_partner
PORT=3001
JWT_SECRET=change-me-to-a-random-secret
```

Also add `JWT_SECRET=dev-secret-do-not-use-in-production` to the actual `server/.env` file (git-ignored).

- [ ] **Step 3: Commit**

```bash
git add server/package.json server/package-lock.json server/.env.example
git commit -m "chore: add auth dependencies (bcryptjs, jsonwebtoken, cookie-parser)"
```

---

## Task 2: JWT Helper

**Files:**
- Create: `server/src/lib/jwt.ts`

- [ ] **Step 1: Create the JWT helper module**

```ts
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
```

- [ ] **Step 2: Verify it compiles**

```bash
cd server && npx tsc --noEmit src/lib/jwt.ts
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/lib/jwt.ts
git commit -m "feat: add JWT sign/verify helpers and cookie config"
```

---

## Task 3: Auth Middleware

**Files:**
- Create: `server/src/middleware/auth.ts`

- [ ] **Step 1: Create the requireAuth middleware**

```ts
// server/src/middleware/auth.ts
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
    res.status(401).json({ error: 'לא מחובר' });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'טוקן לא תקין' });
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd server && npx tsc --noEmit src/middleware/auth.ts
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/middleware/auth.ts
git commit -m "feat: add requireAuth middleware"
```

---

## Task 4: Auth Routes

**Files:**
- Create: `server/src/routes/auth.ts`

- [ ] **Step 1: Create the auth router**

```ts
// server/src/routes/auth.ts
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
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'שדה חובה' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'כתובת אימייל לא תקינה' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
      return;
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: 'האימייל כבר רשום במערכת' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db
      .insert(users)
      .values({ name, email, passwordHash })
      .returning({ id: users.id, name: users.name, email: users.email });

    const token = signToken({ id: newUser.id, email: newUser.email, name: newUser.name });
    res.cookie(COOKIE_NAME, token, getCookieOptions());
    res.status(201).json({ user: newUser });
  } catch {
    res.status(500).json({ error: 'שגיאת שרת, נסה שוב מאוחר יותר' });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'שדה חובה' });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
      return;
    }

    const token = signToken({ id: user.id, email: user.email, name: user.name });
    res.cookie(COOKIE_NAME, token, getCookieOptions());
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch {
    res.status(500).json({ error: 'שגיאת שרת, נסה שוב מאוחר יותר' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, getCookieOptions());
  res.json({ success: true });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});
```

- [ ] **Step 2: Verify it compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/auth.ts
git commit -m "feat: add auth routes (register, login, logout, me)"
```

---

## Task 5: Wire Up Server

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: Add cookie-parser, update CORS, mount auth router**

Replace the entire contents of `server/src/index.ts` with:

```ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Verify it compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "feat: wire up cookie-parser, CORS credentials, and auth router"
```

---

## Task 6: Install Client Dependencies

**Files:**
- Modify: `client/package.json`

- [ ] **Step 1: Install react-router-dom**

```bash
cd client && npm install react-router-dom
```

- [ ] **Step 2: Commit**

```bash
git add client/package.json client/package-lock.json
```

(Will be committed together with the next client task.)

---

## Task 7: API Helper

**Files:**
- Create: `client/src/lib/api.ts`

- [ ] **Step 1: Create the fetch wrapper**

```ts
// client/src/lib/api.ts

interface ApiError {
  error: string;
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body: ApiError = await res.json().catch(() => ({ error: 'שגיאת שרת, נסה שוב מאוחר יותר' }));
    throw new ApiRequestError(res.status, body.error);
  }

  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/api.ts client/package.json client/package-lock.json
git commit -m "feat: add API fetch helper and install react-router-dom"
```

---

## Task 8: Auth Context

**Files:**
- Create: `client/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Create AuthContext with provider and hook**

```tsx
// client/src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, ApiRequestError } from '../lib/api';

interface User {
  id: number;
  name: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api<{ user: User }>('/api/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { user } = await api<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export { type User, ApiRequestError };
```

- [ ] **Step 2: Commit**

```bash
git add client/src/contexts/AuthContext.tsx
git commit -m "feat: add AuthContext with login, register, logout, and session restore"
```

---

## Task 9: ProtectedRoute Component

**Files:**
- Create: `client/src/components/ProtectedRoute.tsx`

- [ ] **Step 1: Create ProtectedRoute**

```tsx
// client/src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/ProtectedRoute.tsx
git commit -m "feat: add ProtectedRoute component"
```

---

## Task 10: Register Form & Page

**Files:**
- Create: `client/src/components/RegisterForm.tsx`
- Create: `client/src/pages/RegisterPage.tsx`

- [ ] **Step 1: Create RegisterForm**

```tsx
// client/src/components/RegisterForm.tsx
import { useState, type FormEvent } from 'react';
import { TextField, Button, Alert, Stack } from '@mui/material';
import { useAuth, ApiRequestError } from '../contexts/AuthContext';

export function RegisterForm() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password) {
      setError('שדה חובה');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('כתובת אימייל לא תקינה');
      return;
    }

    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(name, email, password);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('שגיאת שרת, נסה שוב מאוחר יותר');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="שם"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label="אימייל"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label="סיסמה"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={isSubmitting}
        >
          {isSubmitting ? 'נרשם...' : 'הרשמה'}
        </Button>
      </Stack>
    </form>
  );
}
```

- [ ] **Step 2: Create RegisterPage**

```tsx
// client/src/pages/RegisterPage.tsx
import { Navigate, Link as RouterLink } from 'react-router-dom';
import { Container, Card, CardContent, Typography, Link } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { RegisterForm } from '../components/RegisterForm';

export function RegisterPage() {
  const { user, isLoading } = useAuth();

  if (!isLoading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom textAlign="center">
            הרשמה
          </Typography>
          <RegisterForm />
          <Typography variant="body2" textAlign="center" sx={{ mt: 2 }}>
            כבר יש לך חשבון?{' '}
            <Link component={RouterLink} to="/login">
              התחברות
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/RegisterForm.tsx client/src/pages/RegisterPage.tsx
git commit -m "feat: add registration form and page with Hebrew UI"
```

---

## Task 11: Login Form & Page

**Files:**
- Create: `client/src/components/LoginForm.tsx`
- Create: `client/src/pages/LoginPage.tsx`

- [ ] **Step 1: Create LoginForm**

```tsx
// client/src/components/LoginForm.tsx
import { useState, type FormEvent } from 'react';
import { TextField, Button, Alert, Stack } from '@mui/material';
import { useAuth, ApiRequestError } from '../contexts/AuthContext';

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('שדה חובה');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('שגיאת שרת, נסה שוב מאוחר יותר');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="אימייל"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label="סיסמה"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={isSubmitting}
        >
          {isSubmitting ? 'מתחבר...' : 'התחברות'}
        </Button>
      </Stack>
    </form>
  );
}
```

- [ ] **Step 2: Create LoginPage**

```tsx
// client/src/pages/LoginPage.tsx
import { Navigate, Link as RouterLink } from 'react-router-dom';
import { Container, Card, CardContent, Typography, Link } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { LoginForm } from '../components/LoginForm';

export function LoginPage() {
  const { user, isLoading } = useAuth();

  if (!isLoading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom textAlign="center">
            התחברות
          </Typography>
          <LoginForm />
          <Typography variant="body2" textAlign="center" sx={{ mt: 2 }}>
            אין לך חשבון?{' '}
            <Link component={RouterLink} to="/register">
              הרשמה
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/LoginForm.tsx client/src/pages/LoginPage.tsx
git commit -m "feat: add login form and page with Hebrew UI"
```

---

## Task 12: Home Page

**Files:**
- Create: `client/src/pages/HomePage.tsx`

- [ ] **Step 1: Create HomePage**

```tsx
// client/src/pages/HomePage.tsx
import { Container, Typography, Box, Button } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export function HomePage() {
  const { user, logout } = useAuth();

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Sports Partner
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          שלום, {user?.name}!
        </Typography>
        <Button variant="outlined" onClick={logout}>
          התנתקות
        </Button>
      </Box>
    </Container>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/HomePage.tsx
git commit -m "feat: add protected home page with logout button"
```

---

## Task 13: Wire Up Routing

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/main.tsx`

- [ ] **Step 1: Replace App.tsx with routing**

```tsx
// client/src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { HomePage } from './pages/HomePage';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
```

- [ ] **Step 2: Wrap main.tsx with BrowserRouter and AuthProvider**

```tsx
// client/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 3: Verify the client compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx client/src/main.tsx
git commit -m "feat: wire up routing with auth-protected home page"
```

---

## Task 14: Manual Smoke Test

- [ ] **Step 1: Start the database**

```bash
npm run db:up
```

- [ ] **Step 2: Start the dev servers**

```bash
npm run dev
```

- [ ] **Step 3: Test registration**

Open `http://localhost:5173`. You should be redirected to `/login`. Click the register link. Fill out the form and submit. You should be redirected to the home page with your name displayed.

- [ ] **Step 4: Test logout**

Click the logout button. You should be redirected to `/login`.

- [ ] **Step 5: Test login**

Log in with the credentials you just registered. You should be redirected to the home page.

- [ ] **Step 6: Test session persistence**

Refresh the page. You should still be logged in (cookie persists).

- [ ] **Step 7: Test duplicate email**

Try registering with the same email again. You should see the Hebrew error "האימייל כבר רשום במערכת".

- [ ] **Step 8: Test wrong password**

Try logging in with a wrong password. You should see "אימייל או סיסמה שגויים".
