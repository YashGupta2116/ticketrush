import type { z } from 'zod';
import { db } from '@/db';
import { seats, venues } from '@/db/schema';
import type { createVenueSchema } from './venues.schema';
import { Errors } from '@/lib/errors';
import { count, eq } from 'drizzle-orm';

type CreateVenueInput = z.infer<typeof createVenueSchema>['body'];

export const createVenue = async ({ name, city, sections }: CreateVenueInput) =>
  db.transaction(async (tx) => {
    const [venue] = await tx.insert(venues).values({ name, city }).returning();

    const allSeats = sections.flatMap(({ name: section, rows, seatsPerRow, tier }) =>
      Array.from({ length: rows }, (_, r) =>
        Array.from({ length: seatsPerRow }, (_, n) => ({
          venueId: venue!.id,
          section,
          row: String.fromCharCode(65 + r), // 0 → A, 1 → B …
          number: n + 1,
          tier,
        })),
      ).flat(),
    );

    await tx.insert(seats).values(allSeats);

    return { ...venue!, seatCount: allSeats.length };
  });

export const getVenue = async (id: string) => {
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, id) });
  if (!venue) throw Errors.notFound('Venue not found');

  const sections = await db
    .select({ section: seats.section, tier: seats.tier, seatCount: count() })
    .from(seats)
    .where(eq(seats.venueId, id))
    .groupBy(seats.section, seats.tier)
    .orderBy(seats.section);

  return { ...venue, sections };
};
