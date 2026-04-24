import { Router, type Request, type Response } from 'express';
import { db } from '../db/client.js';
import { sports } from '../db/schema.js';
import type { SportsResponse } from '../types/catalog.js';

export const sportsRouter = Router();

sportsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({ id: sports.id, name: sports.name })
      .from(sports)
      .orderBy(sports.name);

    res.json({ sports: rows } satisfies SportsResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});
