import { seatTier } from '@/db/schema';
import { z } from 'zod';

const price = z.number().int().min(0);

export const createShowSchema = z.object({
  body: z
    .object({
      eventId: z.uuid(),
      venueId: z.uuid(),
      startsAt: z.coerce.date(),
      salesOpenAt: z.coerce.date(),
      pricing: z.record(z.enum(seatTier.enumValues), price),
      isHighDemand: z.boolean().optional(),
    })
    .superRefine((value, ctx) => {
      if (value.startsAt <= new Date()) {
        ctx.addIssue({
          code: 'custom',
          message: 'startsAt should be in future',
          path: ['startsAt'],
        });
      }
      if (value.salesOpenAt >= value.startsAt) {
        ctx.addIssue({
          code: 'custom',
          message: 'sales cannot opewn at or after the start date',
          path: ['salesOpenAt'],
        });
      }
    }),
});
