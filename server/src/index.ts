import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import passport from 'passport';
import { authRouter } from './routes/auth.js';
import { gamesRouter } from './routes/games.js';
import { sportsRouter } from './routes/sports.js';
import { venuesRouter } from './routes/venues.js';
import { aiRouter } from './routes/ai.js';
import { configurePassport } from './lib/passport.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(passport.initialize());

configurePassport();

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/sports', sportsRouter);
app.use('/api/venues', venuesRouter);
app.use('/api/games', gamesRouter);
app.use('/api/ai', aiRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
