import { z } from 'zod';
import { env } from '@/config/env';

export const holdSeatsSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: z.object({
    showSeatIds: z
      .array(z.uuid())
      .min(1)
      .max(env.MAX_SEATS_PER_HOLD)
      .refine((ids) => new Set(ids).size === ids.length, 'showSeatIds must be unique'),
  }),
});
