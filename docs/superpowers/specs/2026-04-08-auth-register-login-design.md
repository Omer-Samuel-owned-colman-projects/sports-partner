# Auth: Register & Login (JWT) — Design Spec

**Issue:** #2
**Date:** 2026-04-08
**Approach:** Minimal Express middleware + cookie-based JWT

## Overview

Implement user registration and login with JWT stored in httpOnly cookies. Includes server-side auth endpoints, middleware for protecting routes, and a React frontend with auth context, forms, and routing. All UI is in Hebrew.

## Backend

### Dependencies

- `bcryptjs` + `@types/bcryptjs` — password hashing
- `jsonwebtoken` + `@types/jsonwebtoken` — JWT creation/verification
- `cookie-parser` + `@types/cookie-parser` — parse cookies from requests

### API Endpoints

| Method | Endpoint | Body | Response | Cookie |
|--------|----------|------|----------|--------|
| `POST` | `/api/auth/register` | `{ name, email, password }` | `{ user: { id, name, email } }` | Sets `token` httpOnly cookie |
| `POST` | `/api/auth/login` | `{ email, password }` | `{ user: { id, name, email } }` | Sets `token` httpOnly cookie |
| `POST` | `/api/auth/logout` | — | `{ success: true }` | Clears `token` cookie |
| `GET` | `/api/auth/me` | — | `{ user }` or `401` | Reads `token` cookie |

### Register flow

1. Validate input: name, email, password required. Password min 6 chars.
2. Check if email already exists in DB — return 409 with Hebrew error if so.
3. Hash password with `bcryptjs` (salt rounds: 10).
4. Insert user into `users` table.
5. Sign JWT with user id, email, name. Expiry: 7 days.
6. Set JWT in httpOnly cookie. Return user object (no password hash).

### Login flow

1. Validate input: email, password required.
2. Look up user by email — return 401 with Hebrew error if not found.
3. Compare password with stored hash — return 401 if mismatch.
4. Sign JWT, set cookie, return user object.

### Auth middleware (`requireAuth`)

- Reads JWT from `req.cookies.token`.
- Verifies with `jsonwebtoken` using `JWT_SECRET`.
- Attaches `req.user` (id, email, name) to the request.
- Returns 401 JSON error if token missing or invalid.

### Cookie configuration

- `httpOnly: true` — not accessible to client JS
- `sameSite: 'strict'` — CSRF protection
- `secure: false` in dev, `true` in production (based on `NODE_ENV`)
- `maxAge: 7 * 24 * 60 * 60 * 1000` (7 days, matches JWT expiry)
- `path: '/'`

### Environment variables

- `JWT_SECRET` — signing key (added to `.env.example`)

### Server file structure

```
server/src/
  routes/
    auth.ts          # register, login, logout, me endpoints
  middleware/
    auth.ts          # requireAuth middleware
  lib/
    jwt.ts           # sign/verify helpers, cookie config
```

## Frontend

### Dependencies

- `react-router-dom` — client-side routing

### Auth Context (`AuthContext`)

- React context providing `{ user, isLoading, login, register, logout }`.
- On mount, calls `GET /api/auth/me` to restore session from cookie.
- `login(email, password)` calls `POST /api/auth/login`, sets user state on success.
- `register(name, email, password)` calls `POST /api/auth/register`, sets user state on success.
- `logout()` calls `POST /api/auth/logout`, clears user state.
- `isLoading` prevents flash of login screen during initial `/me` check.

### Pages & Routing

| Route | Component | Auth |
|-------|-----------|------|
| `/login` | `LoginPage` | Public — redirects to `/` if already logged in |
| `/register` | `RegisterPage` | Public — redirects to `/` if already logged in |
| `/` | `HomePage` | Protected — redirects to `/login` if not logged in |

### UI Components

- **`LoginForm`** — email + password fields, submit button, link to register page. Hebrew labels and error messages.
- **`RegisterForm`** — name + email + password fields, submit button, link to login page. Hebrew labels and error messages.
- Both use MUI components: `TextField`, `Button`, `Card`, `Alert`.
- Client-side validation: required fields, email format, password min 6 chars.
- Server errors displayed in Hebrew via `Alert` component (e.g. "האימייל כבר קיים", "סיסמה שגויה").

### `ProtectedRoute` component

Wraps routes that require auth. If `user` is null and `isLoading` is false, redirects to `/login`.

### API helper (`lib/api.ts`)

Thin wrapper around `fetch` for `/api` calls. Handles JSON parsing and error extraction.

### Client file structure

```
client/src/
  contexts/
    AuthContext.tsx     # AuthProvider + useAuth hook
  pages/
    LoginPage.tsx
    RegisterPage.tsx
    HomePage.tsx
  components/
    LoginForm.tsx
    RegisterForm.tsx
    ProtectedRoute.tsx
  lib/
    api.ts             # fetch wrapper
```

## Hebrew Error Messages

| Scenario | Message |
|----------|---------|
| Email already registered | האימייל כבר רשום במערכת |
| Invalid credentials | אימייל או סיסמה שגויים |
| Missing required field | שדה חובה |
| Invalid email format | כתובת אימייל לא תקינה |
| Password too short | הסיסמה חייבת להכיל לפחות 6 תווים |
| Server error | שגיאת שרת, נסה שוב מאוחר יותר |

## What's NOT in scope

- Refresh token rotation
- Password reset / forgot password
- Email verification
- OAuth / social login
- Rate limiting on auth endpoints
- Account deletion
