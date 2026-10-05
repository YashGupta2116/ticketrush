import { and, asc, eq, gt, gte, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { isForeignKeyViolation } from '@/db/errors';
import { events, seats, shows, showSeats, venues } from '@/db/schema';
import { Errors } from '@/lib/errors';
import { decodeCursor, paginate } from '@/lib/pagination';
import type { createShowSchema, listShowsSchema } from './shows.schema';
import { redis } from '@/lib/redis';
import { seatKey } from '../holds/holds.keys';

type CreateShowInput = z.infer<typeof createShowSchema>['body'];
type ListShowsQuery = z.infer<typeof listShowsSchema>['query'];

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

const cursorSchema = z.object({ startsAt: z.coerce.date(), id: z.uuid() });

const parseCursor = (cursor: string) => {
  const parsed = cursorSchema.safeParse(decodeCursor(cursor));
  if (!parsed.success) throw Errors.badRequest('Invalid cursor');
  return parsed.data;
};

export const listShows = async ({ city, from, limit, cursor }: ListShowsQuery) => {
  const after = cursor ? parseCursor(cursor) : undefined;

  const rows = await db
    .select({
      id: shows.id,
      startsAt: shows.startsAt,
      salesOpenAt: shows.salesOpenAt,
      isHighDemand: shows.isHighDemand,
      eventId: events.id,
      eventTitle: events.title,
      venueId: venues.id,
      venueName: venues.name,
      venueCity: venues.city,
    })
    .from(shows)
    .innerJoin(events, eq(shows.eventId, events.id))
    .innerJoin(venues, eq(shows.venueId, venues.id))
    .where(
      and(
        ne(shows.status, 'cancelled'),
        gt(shows.startsAt, new Date()),
        from ? gte(shows.startsAt, from) : undefined,
        city ? eq(venues.city, city) : undefined,
        after
          ? sql`(${shows.startsAt}, ${shows.id}) > (${after.startsAt.toISOString()}::timestamptz, ${after.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(asc(shows.startsAt), asc(shows.id))
    .limit(limit + 1);

  return paginate(rows, limit, (last) => ({ startsAt: last.startsAt, id: last.id }));
};

type IsOnSaleSchema = {
  show: typeof shows.$inferSelect;
  now?: Date;
};

export const isOnSale = ({ show, now = new Date() }: IsOnSaleSchema) => {
  return show.salesOpenAt <= now && now < show.startsAt && show.status === 'scheduled';
};

export const getShow = async (id: string) => {
  const [row] = await db
    .select({
      show: shows,
      event: {
        id: events.id,
        title: events.title,
        description: events.description,
        durationMinutes: events.durationMinutes,
      },
      venue: { id: venues.id, name: venues.name, city: venues.city, address: venues.address },
    })
    .from(shows)
    .innerJoin(events, eq(shows.eventId, events.id))
    .innerJoin(venues, eq(shows.venueId, venues.id))
    .where(eq(shows.id, id));

  if (!row) throw Errors.notFound('Show not found');

  return { ...row.show, onSale: isOnSale({ show: row.show }), event: row.event, venue: row.venue };
};

export const getSeatMap = async (showId: string) => {
  // An existing show always has seats, so an empty result can only mean the show is unknown.
  const show = await db.query.shows.findFirst({
    columns: { id: true },
    where: eq(shows.id, showId),
  });
  if (!show) throw Errors.notFound('Show not found');

  // `id` is the show_seat id: that is what gets held and booked, not the physical seat's id.
  const rows = await db
    .select({
      id: showSeats.id,
      section: seats.section,
      row: seats.row,
      number: seats.number,
      tier: seats.tier,
      priceCents: showSeats.priceCents,
      status: showSeats.status,
    })
    .from(showSeats)
    .innerJoin(seats, eq(showSeats.seatId, seats.id))
    .where(eq(showSeats.showId, showId))
    .orderBy(asc(seats.section), asc(seats.row), asc(seats.number));

  const holds = rows.length ? await redis.mget(rows.map((s) => seatKey(showId, s.id))) : [];

  return rows.map((seat, i) => ({
    ...seat,
    status: seat.status === 'available' && holds[i] ? 'held' : seat.status,
  }));
};
