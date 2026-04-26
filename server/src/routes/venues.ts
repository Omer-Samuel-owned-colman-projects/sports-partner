import { Router, type Request, type Response } from 'express';
import { Venue } from '../db/schema.js';
import type { VenuesResponse } from '../types/catalog.js';

export const venuesRouter = Router();

venuesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await Venue.find().sort({ name: 1 }).lean();

    res.json({
      venues: rows.map((r) => ({ id: r._id.toString(), name: r.name, city: r.city })),
    } satisfies VenuesResponse);
  } catch {
    res.status(500).json({ error: 'Server error, please try again later' });
  }
});
