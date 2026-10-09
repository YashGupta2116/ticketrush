import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { isUniqueViolation } from '@/db/errors';
import { bookings, payments, processedWebhookEvents } from '@/db/schema';
import { hmacSign, safeEqual } from '@/lib/crypto';
import { env } from '@/config/env';
import { AppError, Errors } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createStateMachine } from '@/lib/state-machine';
import { bookingMachine, moveBookingSeats } from '../bookings/bookings.service';
import { emitSeatChanges } from '../shows/seat-events';
import { paymentProvider } from './payments.provider';

export type PaymentStatus = 'processing' | 'succeeded' | 'failed' | 'refund_pending';

export const paymentMachine = createStateMachine<PaymentStatus>('payment', {
  processing: ['succeeded', 'failed', 'refund_pending'],
  succeeded: [],
  failed: [],
  refund_pending: [],
});

const summary = (p: { id: string; status: PaymentStatus }) => ({
  paymentId: p.id,
  status: p.status,
});

const findProcessing = (bookingId: string) =>
  db.query.payments.findFirst({
    where: and(eq(payments.bookingId, bookingId), eq(payments.status, 'processing')),
  });

export const startPayment = async (userId: string, bookingId: string) => {
  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), eq(bookings.userId, userId)),
  });
  if (!booking) throw Errors.notFound('Booking not found');
  if (
    booking.status === 'expired' ||
    (booking.status === 'pending' && booking.expiresAt <= new Date())
  ) {
    throw new AppError(410, 'This booking has expired', 'BOOKING_EXPIRED');
  }
  if (booking.status !== 'pending') throw Errors.conflict(`Booking is already ${booking.status}`);

  const existing = await findProcessing(bookingId);
  if (existing) return summary(existing);

  // Never hold a DB transaction open across a network call: create the intent first.
  const { intentId } = await paymentProvider.createIntent({
    bookingId,
    amountCents: booking.totalCents,
  });

  try {
    const [payment] = await db
      .insert(payments)
      .values({ bookingId, providerIntentId: intentId, amountCents: booking.totalCents })
      .returning();
    return summary(payment!);
  } catch (err) {
    // The partial unique index: a racing request already inserted the in-flight payment.
    if (!isUniqueViolation(err)) throw err;
    const winner = await findProcessing(bookingId);
    if (!winner) throw err;
    return summary(winner);
  }
};

const eventSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['payment.succeeded', 'payment.failed']),
  data: z.object({
    intentId: z.string().min(1),
    bookingId: z.uuid(),
    amountCents: z.number().int(),
  }),
});

const TOLERANCE_SECONDS = 300;

const verifySignature = (rawBody: Buffer, header: string | undefined) => {
  const parts = Object.fromEntries(
    (header ?? '').split(',').map((part) => part.trim().split('=') as [string, string]),
  );
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || !parts.v1) throw Errors.badRequest('Invalid signature');
  if (Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) {
    throw Errors.badRequest('Signature timestamp outside tolerance');
  }
  const expected = hmacSign(`${timestamp}.${rawBody.toString()}`, env.PAYMENT_WEBHOOK_SECRET);
  if (!safeEqual(expected, parts.v1)) throw Errors.badRequest('Invalid signature');
};

export const handlePaymentWebhook = async (rawBody: Buffer, signature: string | undefined) => {
  verifySignature(rawBody, signature);

  const parsed = eventSchema.safeParse(
    (() => {
      try {
        return JSON.parse(rawBody.toString());
      } catch {
        return null;
      }
    })(),
  );
  if (!parsed.success) throw Errors.badRequest('Invalid event payload');
  const event = parsed.data;

  const confirmed = await db.transaction(async (tx) => {
    // Dedup in the SAME transaction: "marked processed" and "applied" happen together or not at all.
    const [fresh] = await tx
      .insert(processedWebhookEvents)
      .values({ id: event.id })
      .onConflictDoNothing()
      .returning();
    if (!fresh) return null;

    // The row lock serializes us against the expiry job: whoever locks first wins.
    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, event.data.bookingId))
      .for('update');
    const payment = await tx.query.payments.findFirst({
      where: eq(payments.providerIntentId, event.data.intentId),
    });
    // Not found: throw so the provider retries (the payment insert may still be in flight).
    if (!booking || !payment || payment.bookingId !== booking.id) {
      throw Errors.notFound('Payment not found');
    }
    if (payment.status !== 'processing') return null;

    if (event.type === 'payment.failed') {
      paymentMachine.assert(payment.status, 'failed');
      await tx.update(payments).set({ status: 'failed' }).where(eq(payments.id, payment.id));
      return null;
    }

    if (booking.status !== 'pending') {
      // Paid after expiry: the seats may already be resold. Never resurrect the booking.
      logger.warn({ bookingId: booking.id, paymentId: payment.id }, 'Payment after expiry: refund');
      paymentMachine.assert(payment.status, 'refund_pending');
      await tx
        .update(payments)
        .set({ status: 'refund_pending' })
        .where(eq(payments.id, payment.id));
      return null;
    }

    paymentMachine.assert(payment.status, 'succeeded');
    bookingMachine.assert(booking.status, 'confirmed');
    await tx.update(payments).set({ status: 'succeeded' }).where(eq(payments.id, payment.id));
    await tx.update(bookings).set({ status: 'confirmed' }).where(eq(bookings.id, booking.id));
    const seatIds = await moveBookingSeats(tx, booking.id, 'reserved', 'booked');
    return { showId: booking.showId, seatIds };
  });

  if (confirmed) await emitSeatChanges(confirmed.showId, confirmed.seatIds, 'booked');
  return { received: true };
};
