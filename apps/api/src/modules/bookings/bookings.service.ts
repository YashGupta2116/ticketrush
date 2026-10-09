import { AppError, Errors } from '@/lib/errors';
import { redis } from '@/lib/redis';
import { metaKey } from '../holds/holds.keys';
import { randomUUID } from 'node:crypto';
import { env } from '@/config/env';
import { db, type Executor } from '@/db';
import {
  bookingItems,
  bookings,
  events,
  payments,
  seats,
  showSeats,
  shows,
  venues,
} from '@/db/schema';
import { and, desc, eq, getTableColumns, inArray, lt, sql } from 'drizzle-orm';
import { releaseHold } from '../holds/holds.service';
import { logger } from '@/lib/logger';
import { paginate, parseCursor } from '@/lib/pagination';
import { z } from 'zod';
import { createStateMachine } from '@/lib/state-machine';
import { bookingQueue } from '@/jobs/queues';
import { emitSeatChanges } from '../shows/seat-events';
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

  // The sweeper (reconcileExpiredBookings) covers a crash or Redis failure between commit and here.
  await bookingQueue
    .add(
      'expire',
      { bookingId },
      { delay: Math.max(0, expiresAt.getTime() - Date.now()), jobId: `expire-${bookingId}` },
    )
    .catch((err) => logger.error({ err, bookingId }, 'Failed to schedule booking expiry'));
  await emitSeatChanges(showId, meta.showSeatIds, 'reserved');

  return booking;
};

const showInfo = {
  eventTitle: events.title,
  startsAt: shows.startsAt,
  venueName: venues.name,
};

const cursorSchema = z.object({ createdAt: z.coerce.date(), id: z.uuid() });

type ListBookingsQuery = z.infer<typeof listBookingsSchema>['query'];

export const listMyBookings = async (userId: string, { limit, cursor }: ListBookingsQuery) => {
  const after = cursor ? parseCursor(cursorSchema, cursor) : undefined;

  const rows = await db
    .select({ ...getTableColumns(bookings), ...showInfo })
    .from(bookings)
    .innerJoin(shows, eq(bookings.showId, shows.id))
    .innerJoin(events, eq(shows.eventId, events.id))
    .innerJoin(venues, eq(shows.venueId, venues.id))
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
    .select({ ...getTableColumns(bookings), ...showInfo })
    .from(bookings)
    .innerJoin(shows, eq(bookings.showId, shows.id))
    .innerJoin(events, eq(shows.eventId, events.id))
    .innerJoin(venues, eq(shows.venueId, venues.id))
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

  const payment = await db.query.payments.findFirst({
    columns: { id: true, status: true },
    where: eq(payments.bookingId, booking.id),
    orderBy: desc(payments.createdAt),
  });

  return { ...booking, items, payment: payment ?? null };
};

/** Moves every seat of a booking from one status to another. Returns the ids that moved. */
export const moveBookingSeats = async (
  executor: Executor,
  bookingId: string,
  from: 'reserved',
  to: 'booked' | 'available',
) => {
  const moved = await executor
    .update(showSeats)
    .set({
      status: to,
      bookingId: to === 'available' ? null : bookingId,
      version: sql`${showSeats.version} + 1`,
    })
    .where(and(eq(showSeats.bookingId, bookingId), eq(showSeats.status, from)))
    .returning({ id: showSeats.id });
  return moved.map((s) => s.id);
};

/**
 * Expires a pending booking and frees its seats. Idempotent: jobs are delivered at least once.
 * If a payment is still processing at this moment we expire anyway: a late success webhook
 * turns that payment into `refund_pending` (see payments.service), it never resurrects the booking.
 */
export const expireBooking = async (bookingId: string) => {
  const result = await db.transaction(async (tx) => {
    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .for('update');
    if (!booking || booking.status !== 'pending') return null;

    bookingMachine.assert(booking.status, 'expired');
    await tx.update(bookings).set({ status: 'expired' }).where(eq(bookings.id, bookingId));
    const seatIds = await moveBookingSeats(tx, bookingId, 'reserved', 'available');
    return { showId: booking.showId, seatIds };
  });

  if (!result) return false;
  await emitSeatChanges(result.showId, result.seatIds, 'available');
  return true;
};

/** Safety net for the dual write "commit booking, then enqueue expiry". */
export const reconcileExpiredBookings = async () => {
  const stale = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, 'pending'),
        lt(bookings.expiresAt, sql`now() - interval '30 seconds'`),
      ),
    )
    .limit(100);

  let expired = 0;
  for (const { id } of stale) if (await expireBooking(id)) expired++;
  return expired;
};
