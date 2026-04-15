import { z } from 'zod';

export const gameMutationBodySchema = z
  .object({
    sport_id: z.coerce.number().int().positive(),
    venue_id: z.coerce.number().int().positive(),
    date_time: z.string().min(1, 'date_time is required'),
    max_players: z.coerce.number().int().min(1).max(500),
    description: z.union([z.string(), z.null()]).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const date = new Date(data.date_time);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Invalid date_time', path: ['date_time'] });
      return;
    }

    if (date <= new Date()) {
      ctx.addIssue({ code: 'custom', message: 'date_time must be in the future', path: ['date_time'] });
      return;
    }
  });

export function formatZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid request';
}
