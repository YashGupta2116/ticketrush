import { z } from 'zod';

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(100).trim(),
    description: z.string().min(50).max(2000).trim(),
    durationMinutes: z.number().int().min(60).max(600),
  }),
});
