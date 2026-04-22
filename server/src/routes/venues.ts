import { Router, type Request, type Response } from 'express';
import { db } from '../db/client.js';
import { venues } from '../db/schema.js';
import type { VenuesResponse } from '../types/catalog.js';

export const venuesRouter = Router();

venuesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({ id: venues.id, name: venues.name, city: venues.city })
      .from(venues)
      .orderBy(venues.name);

    res.json({ venues: rows } satisfies VenuesResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});
