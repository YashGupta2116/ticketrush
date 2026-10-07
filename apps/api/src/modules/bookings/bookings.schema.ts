import { paginationQuery } from '@/lib/pagination';
import { z } from 'zod';

export const createBookingSchema = z.object({
  body: z.object({
    showId: z.uuid(),
    holdId: z.uuid(),
  }),
});

export const listBookingsSchema = z.object({ query: paginationQuery });
