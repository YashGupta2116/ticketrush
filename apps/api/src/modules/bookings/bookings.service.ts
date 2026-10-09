import { AppError, Errors } from '@/lib/errors';
import { redis } from '@/lib/redis';
import { metaKey } from '../holds/holds.keys';
import { randomUUID } from 'node:crypto';
import { env } from '@/config/env';
import { db } from '@/db';
import { bookingItems, bookings, seats, showSeats } from '@/db/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { releaseHold } from '../holds/holds.service';
import { logger } from '@/lib/logger';
import { paginate, parseCursor } from '@/lib/pagination';
import { z } from 'zod';
import { createStateMachine } from '@/lib/state-machine';
import type { listBookingsSchema } from './bookings.schema';

export type BookingStatus = (typeof bookings.$inferSelect)['status'];

/** Nothing leaves confirmed / expired / cancelled (for now). */
export const bookingMachine = createStateMachine<BookingStatus>('booking', {
  pending: ['confirmed', 'expired', 'cancelled'],
  confirmed: [],
  expired: [],
  cancelled: [],
});

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ReservedSeat = { id: string; priceCents: number };

const seatsUnavailable = () =>
  new AppError(409, 'Some seats are no longer available', 'SEATS_UNAVAILABLE');

/** One conditional UPDATE: Postgres lets exactly one writer flip each row from 'available'. */
const reserveConditional = async (
  tx: Tx,
  bookingId: string,
  showId: string,
  showSeatIds: string[],
): Promise<ReservedSeat[]> => {
  const reserved = await tx
    .update(showSeats)
    .set({ status: 'reserved', bookingId, version: sql`${showSeats.version} + 1` })
    .where(
      and(
        eq(showSeats.showId, showId),
        inArray(showSeats.id, showSeatIds),
        eq(showSeats.status, 'available'),
      ),
    )
    .returning({ id: showSeats.id, priceCents: showSeats.priceCents });

  if (reserved.length !== showSeatIds.length) throw seatsUnavailable();
  return reserved;
};

/**
 * Lock the rows first, check them in TypeScript, then update. `ORDER BY id` gives every
 * transaction the same lock order, so two overlapping bookings cannot deadlock each other.
 * A waiter blocks until the winner commits, then re-reads the row as 'reserved' and fails.
 */
const reservePessimistic = async (
  tx: Tx,
  bookingId: string,
  showId: string,
  showSeatIds: string[],
): Promise<ReservedSeat[]> => {
  const locked = await tx
    .select({ id: showSeats.id, status: showSeats.status, priceCents: showSeats.priceCents })
    .from(showSeats)
    .where(and(eq(showSeats.showId, showId), inArray(showSeats.id, showSeatIds)))
    .orderBy(showSeats.id)
    .for('update');

  if (locked.length !== showSeatIds.length || locked.some((s) => s.status !== 'available')) {
    throw seatsUnavailable();
  }

  await tx
    .update(showSeats)
    .set({ status: 'reserved', bookingId, version: sql`${showSeats.version} + 1` })
    .where(inArray(showSeats.id, showSeatIds));

  return locked.map(({ id, priceCents }) => ({ id, priceCents }));
};

const reserve =
  env.BOOKING_LOCK_STRATEGY === 'pessimistic' ? reservePessimistic : reserveConditional;

export const createBooking = async (userId: string, showId: string, holdId: string) => {
  const raw = await redis.get(metaKey(showId, holdId));
  if (!raw) throw new AppError(410, 'Your hold has expired', 'HOLD_EXPIRED');

  const meta = JSON.parse(raw) as { userId: string; showSeatIds: string[] };
  if (meta.userId !== userId) throw Errors.notFound('Hold not found');

  const bookingId = randomUUID();
  const expiresAt = new Date(Date.now() + env.PAYMENT_WINDOW_MINUTES * 60_000);

  const booking = await db.transaction(async (tx) => {
    await tx.insert(bookings).values({ id: bookingId, userId, showId, expiresAt, totalCents: 0 });

    const reserved = await reserve(tx, bookingId, showId, meta.showSeatIds);

    await tx
      .insert(bookingItems)
      .values(reserved.map((s) => ({ bookingId, showSeatId: s.id, priceCents: s.priceCents })));

    const totalCents = reserved.reduce((sum, s) => sum + s.priceCents, 0);
    const [booked] = await tx
      .update(bookings)
      .set({ totalCents })
      .where(eq(bookings.id, bookingId))
      .returning();

    return booked!;
  });

  await releaseHold(userId, showId, holdId).catch((err) =>
    logger.error({ err, holdId }, 'Failed to release the hold after booking'),
  );

  // TODO: (9.2) schedule expiry
  // TODO: (10.2) publish seat changes

  return booking;
};

const cursorSchema = z.object({ createdAt: z.coerce.date(), id: z.uuid() });

type ListBookingsQuery = z.infer<typeof listBookingsSchema>['query'];

export const listMyBookings = async (userId: string, { limit, cursor }: ListBookingsQuery) => {
  const after = cursor ? parseCursor(cursorSchema, cursor) : undefined;

  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, userId),
        after
          ? sql`(${bookings.createdAt}, ${bookings.id}) < (${after.createdAt}::timestamptz, ${after.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(bookings.createdAt), desc(bookings.id))
    .limit(limit + 1);

  return paginate(rows, limit, (last) => ({ createdAt: last.createdAt, id: last.id }));
};

export const getMyBooking = async (userId: string, id: string) => {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.userId, userId), eq(bookings.id, id)))
    .limit(1);

  if (!booking) throw Errors.notFound('Booking not found');

  const items = await db
    .select({
      showSeatId: bookingItems.showSeatId,
      priceCents: bookingItems.priceCents,
      section: seats.section,
      row: seats.row,
      number: seats.number,
      tier: seats.tier,
    })
    .from(bookingItems)
    .innerJoin(showSeats, eq(bookingItems.showSeatId, showSeats.id))
    .innerJoin(seats, eq(showSeats.seatId, seats.id))
    .where(eq(bookingItems.bookingId, booking.id))
    .orderBy(seats.section, seats.row, seats.number);

  return { ...booking, items };
};
