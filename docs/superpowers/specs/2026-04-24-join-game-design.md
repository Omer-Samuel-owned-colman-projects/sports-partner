# Join a Game — Design Spec

Resolves [#5](https://github.com/Omer-Samuel-owned-colman-projects/sports-partner/issues/5).

## API

### `POST /api/games/:id/join` (new, requires auth)

1. Validate `id` is a valid integer; 400 otherwise.
2. Fetch the game row; 404 if not found.
3. Reject (409) if `is_open = false` (game is full).
4. Reject (409) if user is already a participant (composite PK will also enforce this).
5. Insert `(gameId, userId)` into `participants`.
6. Count participants — if `count === max_players`, update `is_open = false`.
7. Return `{ game: GameDetail }` with the refreshed game (including `currentUserJoined: true`).

Steps 4-6 run inside a transaction to prevent race conditions.

### `GET /api/games` (modified)

Optionally reads the JWT cookie (no `requireAuth`). If a valid token is present, each game row includes `currentUserJoined: true/false` computed via a subquery against `participants`. When no token is present, `currentUserJoined` defaults to `false`.

### `GET /api/games/:id` (modified)

Same optional JWT enrichment — adds `currentUserJoined` to the game detail response.

## Types (`server/src/types/games.ts`)

```ts
// Add to Game type
currentUserJoined: boolean;
```

No new response type needed — the join endpoint returns `GameDetailResponse`.

## Client

### GameDetailPage

- A "Join Game" button rendered below the game info section, above the participants list.
- Visibility rules:
  - Hidden if user is not logged in.
  - Disabled with label "Joined" if `currentUserJoined` is true.
  - Disabled with label "Full" if `isOpen` is false.
  - Active with label "Join Game" otherwise.
- On click: `POST /api/games/:id/join`. On success, replace local `game` state with the response. On error, show an alert.

### GamesPage

- A "Join" button on each game card, placed on the right side of the metadata row.
- Same visibility/disabled logic as the detail page.
- `event.stopPropagation()` on the button to prevent card navigation.
- On success: refetch the games list to get fresh state (participant counts, open status, join status).

### Auth dependency

The `useAuth()` hook provides the current user. When `user` is `null` (not logged in), join buttons are hidden. No additional auth state is needed.

## Files to change

| File | Change |
|------|--------|
| `server/src/routes/games.ts` | Add `POST /:id/join`, add optional auth + `currentUserJoined` to GET endpoints |
| `server/src/types/games.ts` | Add `currentUserJoined` to `Game` type |
| `server/src/middleware/auth.ts` | Add `optionalAuth` middleware (reads token if present, does not reject) |
| `client/src/pages/GameDetailPage.tsx` | Add join button with state logic |
| `client/src/pages/GamesPage.tsx` | Add join button on cards |
