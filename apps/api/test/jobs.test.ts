import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/db';
import { bookings, showSeats } from '@/db/schema';
import { bookingQueue } from '@/jobs/queues';
import { expireBooking, reconcileExpiredBookings } from '@/modules/bookings/bookings.service';
import { createPendingBooking } from './helpers';

describe('expireBooking', () => {
  it('expires a pending booking, frees its seats, and is a no-op the second time', async () => {
    const { booking, seatIds } = await createPendingBooking(3);

    expect(await expireBooking(booking.id)).toBe(true);
    expect(await expireBooking(booking.id)).toBe(false);

    expect((await db.query.bookings.findFirst())!.status).toBe('expired');
    const seats = await db.select().from(showSeats).where(eq(showSeats.id, seatIds[0]!));
    expect(seats[0]).toMatchObject({ status: 'available', bookingId: null });
    expect(
      (await db.select().from(showSeats).where(eq(showSeats.status, 'available'))).length,
    ).toBe(20);
  });

  it('does not touch a confirmed booking', async () => {
    const { booking } = await createPendingBooking();
    await db.update(bookings).set({ status: 'confirmed' }).where(eq(bookings.id, booking.id));
    expect(await expireBooking(booking.id)).toBe(false);
    expect((await db.query.bookings.findFirst())!.status).toBe('confirmed');
  });
});

describe('createBooking scheduling', () => {
  it('enqueues a delayed expire job', async () => {
    const { booking } = await createPendingBooking();
    const job = await bookingQueue.getJob(`expire-${booking.id}`);
    expect(job?.name).toBe('expire');
    expect(job?.opts.delay).toBeGreaterThan(0);
  });
});

describe('reconcileExpiredBookings', () => {
  it('expires pending bookings that are past their deadline and leaves fresh ones', async () => {
    const stale = await createPendingBooking();
    const fresh = await createPendingBooking();
    await db
      .update(bookings)
      .set({ expiresAt: new Date(Date.now() - 3_600_000) })
      .where(eq(bookings.id, stale.booking.id));

    expect(await reconcileExpiredBookings()).toBe(1);

    const rows = new Map((await db.select().from(bookings)).map((b) => [b.id, b.status]));
    expect(rows.get(stale.booking.id)).toBe('expired');
    expect(rows.get(fresh.booking.id)).toBe('pending');
  });
});
