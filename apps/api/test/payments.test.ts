import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/db';
import { bookings, payments, showSeats } from '@/db/schema';
import { expireBooking } from '@/modules/bookings/bookings.service';
import { signWebhook, type PaymentEvent } from '@/modules/payments/payments.provider';
import { api, createPendingBooking, createUser } from './helpers';

const pay = (auth: Record<string, string>, bookingId: string, key = randomUUID()) =>
  api.post(`/api/v1/bookings/${bookingId}/pay`).set(auth).set('Idempotency-Key', key).send();

const webhook = (event: object | string, signature?: string, ts?: number) => {
  const body = typeof event === 'string' ? event : JSON.stringify(event);
  return api
    .post('/api/v1/webhooks/payments')
    .set('content-type', 'application/json')
    .set('x-signature', signature ?? signWebhook(body, ts))
    .send(body);
};

const eventFor = (
  intentId: string,
  bookingId: string,
  type: PaymentEvent['type'] = 'payment.succeeded',
  id = `evt_${randomUUID()}`,
): PaymentEvent => ({ id, type, data: { intentId, bookingId, amountCents: 0 } });

const setup = async () => {
  const ctx = await createPendingBooking(2);
  const res = await pay(ctx.auth, ctx.booking.id);
  const [payment] = await db.select().from(payments);
  return { ...ctx, res, payment: payment! };
};

describe('POST /api/v1/bookings/:id/pay', () => {
  it('returns 202 and creates a processing payment', async () => {
    const { res, payment, booking } = await setup();
    expect(res.status).toBe(202);
    expect(res.body.data).toEqual({ paymentId: payment.id, status: 'processing' });
    expect(payment).toMatchObject({ bookingId: booking.id, amountCents: booking.totalCents });
  });

  it('returns the same payment for a repeat and for concurrent requests', async () => {
    const { auth, booking, payment } = await setup();
    const results = await Promise.all(Array.from({ length: 5 }, () => pay(auth, booking.id)));
    expect(results.every((r) => r.status === 202 && r.body.data.paymentId === payment.id)).toBe(
      true,
    );
    expect(await db.select().from(payments)).toHaveLength(1);
  });

  it("returns 404 for someone else's booking", async () => {
    const { booking } = await createPendingBooking();
    const other = await createUser();
    expect((await pay(other.auth, booking.id)).status).toBe(404);
    expect(await db.select().from(payments)).toHaveLength(0);
  });

  it('returns 410 for an expired booking', async () => {
    const { auth, booking } = await createPendingBooking();
    await expireBooking(booking.id);
    expect((await pay(auth, booking.id)).status).toBe(410);
  });
});

describe('POST /api/v1/webhooks/payments', () => {
  it('confirms the booking and books the seats on success', async () => {
    const { booking, payment, seatIds } = await setup();

    const res = await webhook(eventFor(payment.providerIntentId, booking.id));

    expect(res.status).toBe(200);
    expect(
      (await db.query.bookings.findFirst({ where: eq(bookings.id, booking.id) }))!.status,
    ).toBe('confirmed');
    expect((await db.query.payments.findFirst())!.status).toBe('succeeded');
    const seats = await db.select().from(showSeats).where(eq(showSeats.bookingId, booking.id));
    expect(seats.map((s) => s.id).sort()).toEqual([...seatIds].sort());
    expect(seats.every((s) => s.status === 'booked')).toBe(true);
  });

  it('processes the same event twice only once', async () => {
    const { booking, payment } = await setup();
    const event = eventFor(payment.providerIntentId, booking.id);

    const [a, b] = await Promise.all([webhook(event), webhook(event)]);

    expect([a.status, b.status]).toEqual([200, 200]);
    const seats = await db.select().from(showSeats).where(eq(showSeats.bookingId, booking.id));
    expect(seats.every((s) => s.version === 2)).toBe(true); // reserve (+1) and confirm (+1) once
  });

  it('marks the payment failed and keeps the booking pending so the user can retry', async () => {
    const { auth, booking, payment } = await setup();

    await webhook(eventFor(payment.providerIntentId, booking.id, 'payment.failed'));

    expect((await db.query.payments.findFirst())!.status).toBe('failed');
    expect((await db.query.bookings.findFirst())!.status).toBe('pending');
    const retry = await pay(auth, booking.id);
    expect(retry.status).toBe(202);
    expect(retry.body.data.paymentId).not.toBe(payment.id);
  });

  it('rejects a bad signature and a stale timestamp with 400', async () => {
    const { booking, payment } = await setup();
    const event = eventFor(payment.providerIntentId, booking.id);
    expect((await webhook(event, 't=1,v1=deadbeef')).status).toBe(400);
    expect((await webhook(event, undefined, Math.floor(Date.now() / 1000) - 3600)).status).toBe(
      400,
    );
    expect((await webhook('not json')).status).toBe(400);
    expect((await db.query.bookings.findFirst())!.status).toBe('pending');
  });

  it('turns a payment that succeeds after expiry into refund_pending without touching seats', async () => {
    const { booking, payment, seatIds } = await setup();
    await expireBooking(booking.id);

    const res = await webhook(eventFor(payment.providerIntentId, booking.id));

    expect(res.status).toBe(200);
    expect((await db.query.payments.findFirst())!.status).toBe('refund_pending');
    expect((await db.query.bookings.findFirst())!.status).toBe('expired');
    const seats = await db.select().from(showSeats).where(eq(showSeats.id, seatIds[0]!));
    expect(seats[0]).toMatchObject({ status: 'available', bookingId: null });
  });

  it('never ends in a mixed state when success and expiry race', async () => {
    const { booking, payment } = await setup();

    await Promise.all([
      webhook(eventFor(payment.providerIntentId, booking.id)),
      expireBooking(booking.id),
    ]);

    const b = (await db.query.bookings.findFirst())!;
    const p = (await db.query.payments.findFirst())!;
    const seats = await db.select().from(showSeats).where(eq(showSeats.version, 2));
    if (b.status === 'confirmed') {
      expect(p.status).toBe('succeeded');
      expect(seats.every((s) => s.status === 'booked')).toBe(true);
    } else {
      expect(b.status).toBe('expired');
      expect(p.status).toBe('refund_pending');
    }
  });
});
