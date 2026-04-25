import { Router, type Request, type Response } from 'express';
import { runGameSearchAssistant } from '../lib/ai.service.js';

export const aiRouter = Router();

// POST /api/ai/search
aiRouter.post('/search', async (req: Request, res: Response) => {
  try {
    const userQuery = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!userQuery) {
      res.status(400).json({ error: 'query is required' });
      return;
    }

    const result = await runGameSearchAssistant(userQuery);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error, please try again later';
    res.status(500).json({ error: message });
  }
});

