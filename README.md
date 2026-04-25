# Sports Partner

A social app for finding partners for sports games. Users can post upcoming games, search for open games, and sign up as participants.

## Tech Stack

| Layer  | Technologies                                          |
| ------ | ----------------------------------------------------- |
| Server | Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL |
| Client | React 18, MUI (Material-UI), Vite, TypeScript         |
| Infra  | Docker (PostgreSQL), JWT                              |

## Project Structure

```
sports-partner/
├── client/              # React + MUI + Vite
├── server/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts      # Drizzle schema (all tables)
│   │   │   ├── client.ts      # DB connection
│   │   │   ├── seed.ts        # Seed sports, venues, users & games
│   │   │   └── migrations/    # Generated SQL migrations
│   │   ├── types/             # Shared API response types (inferred from Drizzle)
│   │   ├── routes/            # Express route handlers
│   │   └── index.ts           # Express entry point
│   ├── drizzle.config.ts
│   └── .env.example
├── docker-compose.yml   # PostgreSQL
└── package.json         # Shared scripts
```

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Docker](https://www.docker.com/) (for running PostgreSQL locally)

## Installation

```bash
# 1. Clone the project
git clone https://github.com/Omer-Samuel-owned-colman-projects/sports-partner.git
cd sports-partner

# 2. Install dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# 3. Set up environment variables
cp server/.env.example server/.env
# Edit server/.env as needed
```

## Setup

```bash
# Start PostgreSQL with Docker
npm run db:up

# Run the pending migrations on your DB
npm run db:migrate
```

### Database Scripts (from the server/ directory)

| Script                | Description                                |
| --------------------- | ------------------------------------------ |
| `npm run db:push`     | Push schema directly to the database       |
| `npm run db:generate` | Generate a new migration file              |
| `npm run db:migrate`  | Run pending migrations                     |
| `npm run db:studio`   | Open Drizzle Studio (GUI for the database) |
| `npm run db:seed`     | Seed sports, venues, users & sample games  |

### Docker Scripts (from the project root)

| Script             | Description                            |
| ------------------ | -------------------------------------- |
| `npm run db:up`    | Start PostgreSQL in the background     |
| `npm run db:down`  | Stop the container (data is preserved) |
| `npm run db:reset` | Delete data and restart                |

### Development

```bash
# Development — server and client in parallel
npm run dev
```

- **Client**: http://localhost:5173
- **Server**: http://localhost:3001

```bash
# Run separately
npm run dev:server
npm run dev:client
```

## Build & Production

```bash
npm run build
npm start
```

## API

| Method | Route                | Description                           |
| ------ | -------------------- | ------------------------------------- |
| `GET`  | `/api/health`        | Server health check                   |
| `GET`  | `/api/auth/me`       | Return the current user               |
| `POST` | `/api/auth/register` | Create a new user                     |
| `POST` | `/api/auth/login`    | Login with the given credentials      |
| `POST` | `/api/auth/logout`   | Logout by clearing the current cookie |
| `GET`  | `/api/sports`        | List all sports (for game forms and filters) |
| `GET`  | `/api/venues`        | List all venues (for game forms and filters) |
| `GET`  | `/api/games`         | List open games with sport, venue & participant count (supports filters) |
| `GET`  | `/api/games/:id`     | Get a single game with participant list |
| `POST` | `/api/games/:id/join`| Join a game (auth required)              |
| `DELETE` | `/api/games/:id/join` | Leave a game (auth required)           |
| `POST` | `/api/games`         | Create a game (auth required) and auto-join creator |
| `PUT`  | `/api/games/:id`     | Edit a game (auth + creator only)     |

### Weather Forecasts on Games

- `GET /api/games` and `GET /api/games/:id` include a `weather` field on each game:
  - `weather: { tempC: number; rainMm: number }` when forecast data exists
  - `weather: null` when forecast is unavailable or not eligible yet
- Fetch rules:
  - Games in the next **7 days** are eligible for weather refresh.
  - Games in the next **2 days** are marked as final after refresh (`weather_final = true`) and are not refreshed again.
  - Non-final forecasts are refreshed at a throttled interval (to reduce third-party API calls).
- Editing a game's date/venue resets cached weather, so the server can fetch the correct forecast for the updated game.

### Games Feed Filters

- `GET /api/games` returns only open games (`is_open = true`).
- Optional query filters:
  - `sport=<sport_id>`
  - `venue=<venue_id>`
- Example: `/api/games?sport=1&venue=2`

### Game Mutation Validation

- `date_time` must be a valid date in the future.
- `max_players` must be an integer between `1` and `500`.
- `sport_id` and `venue_id` must reference existing records.
