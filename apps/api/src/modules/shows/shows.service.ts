import { sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '@/db';
import { isForeignKeyViolation } from '@/db/errors';
import { seats, shows } from '@/db/schema';
import { Errors } from '@/lib/errors';
import type { createShowSchema } from './shows.schema';

type CreateShowInput = z.infer<typeof createShowSchema>['body'];

export const createShow = async ({
  eventId,
  venueId,
  startsAt,
  salesOpenAt,
  pricing,
  isHighDemand = false,
}: CreateShowInput) =>
  db
    .transaction(async (tx) => {
      const [show] = await tx
        .insert(shows)
        .values({ eventId, venueId, startsAt, salesOpenAt, pricing, isHighDemand })
        .returning();

      const inserted = await tx.execute(sql`
        INSERT INTO show_seats (show_id, seat_id, price_cents)
        SELECT ${show!.id}::uuid, ${seats.id}, (${JSON.stringify(pricing)}::jsonb ->> ${seats.tier}::text)::int
        FROM ${seats}
        WHERE ${seats.venueId} = ${venueId}
      `);

      const seatCount = inserted.rowCount ?? 0;

      if (seatCount === 0) throw Errors.validation('The venue has no seats');

      return { ...show!, seatCount };
    })
    .catch((err) => {
      // An unknown eventId or venueId violates a foreign key instead of returning no rows.
      if (isForeignKeyViolation(err)) throw Errors.notFound('Event or venue not found');
      throw err;
    });
