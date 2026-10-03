import { z } from 'zod';
import { seatTier } from '@/db/schema';

const MAX_SEATS = 5000;

export const createVenueSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).max(120),
      city: z.string().trim().min(1).max(80),
      sections: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(60),
            rows: z.number().int().min(1).max(26), // 26 = row labels A..Z
            seatsPerRow: z.number().int().min(1).max(100),
            tier: z.enum(seatTier.enumValues),
          }),
        )
        .min(1),
    })
    .superRefine((value, ctx) => {
      const total = value.sections.reduce((sum, s) => sum + s.rows * s.seatsPerRow, 0);
      if (total > MAX_SEATS) {
        ctx.addIssue({
          code: 'custom',
          message: `A venue cannot have more than ${MAX_SEATS} seats`,
          path: ['sections'],
        });
      }
    }),
});
