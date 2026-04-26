import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import passport from 'passport';
import swaggerUi from 'swagger-ui-express';
import { authRouter } from './routes/auth.js';
import { gamesRouter } from './routes/games.js';
import { sportsRouter } from './routes/sports.js';
import { venuesRouter } from './routes/venues.js';
import { aiRouter } from './routes/ai.js';
import { configurePassport } from './lib/passport.js';
import { swaggerSpec } from './lib/swagger.js';

export function createApp() {
  const app = express();

  app.use(cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  app.use(passport.initialize());

  configurePassport();

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/sports', sportsRouter);
  app.use('/api/venues', venuesRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/ai', aiRouter);

  const clientDist = path.resolve(process.cwd(), '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return app;
}
