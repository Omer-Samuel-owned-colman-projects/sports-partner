import { Router, type Request, type Response } from 'express';
import { Sport } from '../db/schema.js';
import type { SportsResponse } from '../types/catalog.js';

export const sportsRouter = Router();

sportsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await Sport.find().sort({ name: 1 }).lean();

    res.json({
      sports: rows.map((r) => ({ id: r._id.toString(), name: r.name })),
    } satisfies SportsResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});
