import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { gamesRouter } from './routes/games.js';
import { sportsRouter } from './routes/sports.js';
import { venuesRouter } from './routes/venues.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/sports', sportsRouter);
app.use('/api/venues', venuesRouter);
app.use('/api/games', gamesRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
