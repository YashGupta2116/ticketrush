import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/db';
import { bookingItems, bookings, showSeats } from '@/db/schema';
import { redis } from '@/lib/redis';
import { metaKey, seatKey, userKey } from '@/modules/holds/holds.keys';
import { api, createOnSaleShow, createUser } from './helpers';

type Auth = Record<string, string>;

const hold = async (auth: Auth, showId: string, showSeatIds: string[]) =>
  (await api.post(`/api/v1/shows/${showId}/holds`).set(auth).send({ showSeatIds })).body.data as {
    holdId: string;
  };

const book = (auth: Auth, showId: string, holdId: string, key: string = randomUUID()) =>
  api.post('/api/v1/bookings').set(auth).set('Idempotency-Key', key).send({ showId, holdId });

const setup = async () => {
  const { auth: admin } = await createUser({ role: 'admin' });
  const { show, seatIds } = await createOnSaleShow(admin);
  return { show, seatIds };
};

const countBookings = async () => (await db.select().from(bookings)).length;

describe('POST /api/v1/bookings', () => {
  it('turns a hold into a pending booking with reserved seats and DB-computed total', async () => {
    const { show, seatIds } = await setup();
    const { user, auth } = await createUser();
    const wanted = seatIds.slice(0, 3);
    const { holdId } = await hold(auth, show.id, wanted);

    const res = await book(auth, show.id, holdId);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      userId: user.id,
      showId: show.id,
      status: 'pending',
      totalCents: 3 * 49900,
    });
    // The payment window is PAYMENT_WINDOW_MINUTES ahead (catches `+` vs `*` mistakes).
    const ms = Date.parse(res.body.data.expiresAt) - Date.now();
    expect(ms).toBeGreaterThan(60_000);
    expect(ms).toBeLessThanOrEqual(60 * 60_000);

    const seats = await db
      .select()
      .from(showSeats)
      .where(eq(showSeats.bookingId, res.body.data.id));
    expect(seats.map((s) => s.id).sort()).toEqual([...wanted].sort());
    expect(seats.every((s) => s.status === 'reserved')).toBe(true);

    const items = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, res.body.data.id));
    expect(items).toHaveLength(3);
  });

  it('releases the hold keys in Redis after booking', async () => {
    const { show, seatIds } = await setup();
    const { user, auth } = await createUser();
    const { holdId } = await hold(auth, show.id, [seatIds[0]!]);

    await book(auth, show.id, holdId);

    expect(await redis.exists(seatKey(show.id, seatIds[0]!))).toBe(0);
    expect(await redis.exists(metaKey(show.id, holdId))).toBe(0);
    expect(await redis.exists(userKey(show.id, user.id))).toBe(0);
  });

  it('returns 410 HOLD_EXPIRED when the hold is gone', async () => {
    const { show, seatIds } = await setup();
    const { auth } = await createUser();
    const { holdId } = await hold(auth, show.id, [seatIds[0]!]);
    await redis.del(metaKey(show.id, holdId));

    const res = await book(auth, show.id, holdId);

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('HOLD_EXPIRED');
    expect(await countBookings()).toBe(0);
  });

  it("returns 404 for someone else's hold and leaves it intact", async () => {
    const { show, seatIds } = await setup();
    const alice = await createUser();
    const bob = await createUser();
    const { holdId } = await hold(alice.auth, show.id, [seatIds[0]!]);

    const res = await book(bob.auth, show.id, holdId);

    expect(res.status).toBe(404);
    expect(await redis.exists(metaKey(show.id, holdId))).toBe(1);
    expect(await countBookings()).toBe(0);
  });

  it('requires authentication and a valid body', async () => {
    expect((await api.post('/api/v1/bookings').send({})).status).toBe(401);
    const { auth } = await createUser();
    const noKey = await api.post('/api/v1/bookings').set(auth).send({});
    expect(noKey.status).toBe(400);
    const res = await book(auth, 'x', 'y');
    expect(res.status).toBe(422);
  });

  it('returns 409 and persists NOTHING when a seat is no longer available in Postgres', async () => {
    const { show, seatIds } = await setup();
    const { auth } = await createUser();
    const wanted = seatIds.slice(0, 3);
    const { holdId } = await hold(auth, show.id, wanted);
    // Simulate Redis having lost the truth: Postgres says one seat is already booked.
    await db.update(showSeats).set({ status: 'booked' }).where(eq(showSeats.id, wanted[1]!));

    const res = await book(auth, show.id, holdId);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SEATS_UNAVAILABLE');
    expect(await countBookings()).toBe(0);
    expect(await db.select().from(bookingItems)).toHaveLength(0);
    const rows = await db.select().from(showSeats).where(eq(showSeats.showId, show.id));
    const byId = new Map(rows.map((s) => [s.id, s]));
    expect(byId.get(wanted[0]!)!.status).toBe('available'); // rolled back, not left reserved
    expect(byId.get(wanted[0]!)!.bookingId).toBeNull();
    expect(byId.get(wanted[1]!)!.status).toBe('booked');
    // The hold is kept so the user can retry or let it expire.
    expect(await redis.exists(metaKey(show.id, holdId))).toBe(1);
  });

  it('creates ONE booking for a double click with the same Idempotency-Key', async () => {
    const { show, seatIds } = await setup();
    const { auth } = await createUser();
    const { holdId } = await hold(auth, show.id, [seatIds[0]!]);
    const key = randomUUID();

    const first = await book(auth, show.id, holdId, key);
    const second = await book(auth, show.id, holdId, key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await countBookings()).toBe(1);
  });

  it('lets exactly one of several concurrent requests with DIFFERENT keys win', async () => {
    const { show, seatIds } = await setup();
    const { auth } = await createUser();
    const { holdId } = await hold(auth, show.id, [seatIds[0]!, seatIds[1]!]);

    const results = await Promise.all(Array.from({ length: 8 }, () => book(auth, show.id, holdId)));

    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.every((s) => [201, 404, 409, 410].includes(s))).toBe(true);
    expect(await countBookings()).toBe(1);
    const reserved = await db.select().from(showSeats).where(eq(showSeats.status, 'reserved'));
    expect(reserved).toHaveLength(2);
  });
});

describe('GET /api/v1/bookings', () => {
  const makeBookings = async (n: number) => {
    const { show, seatIds } = await setup();
    const me = await createUser();
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const { holdId } = await hold(me.auth, show.id, [seatIds[i]!]);
      ids.push((await book(me.auth, show.id, holdId)).body.data.id);
    }
    return { me, ids };
  };

  it('lists only my bookings, newest first, with keyset pagination', async () => {
    const { me, ids } = await makeBookings(3);
    const other = await createUser();

    const page1 = await api.get('/api/v1/bookings?limit=2').set(me.auth);
    expect(page1.status).toBe(200);
    expect(page1.body.data.items.map((b: { id: string }) => b.id)).toEqual([ids[2], ids[1]]);
    expect(page1.body.data.nextCursor).toEqual(expect.any(String));

    const page2 = await api
      .get(`/api/v1/bookings?limit=2&cursor=${page1.body.data.nextCursor}`)
      .set(me.auth);
    expect(page2.body.data.items.map((b: { id: string }) => b.id)).toEqual([ids[0]]);
    expect(page2.body.data.nextCursor).toBeNull();

    const theirs = await api.get('/api/v1/bookings').set(other.auth);
    expect(theirs.body.data.items).toEqual([]);
  });

  it('rejects a malformed cursor with 400', async () => {
    const { auth } = await createUser();
    const res = await api.get('/api/v1/bookings?cursor=garbage').set(auth);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/bookings/:id', () => {
  it('returns my booking with its seat items', async () => {
    const { show, seatIds } = await setup();
    const { auth } = await createUser();
    const { holdId } = await hold(auth, show.id, seatIds.slice(0, 2));
    const created = (await book(auth, show.id, holdId)).body.data;

    const res = await api.get(`/api/v1/bookings/${created.id}`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(created.id);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items[0]).toMatchObject({
      section: 'Floor',
      row: expect.anything(),
      number: expect.any(Number),
      tier: 'standard',
      priceCents: 49900,
    });
  });

  it("returns 404 for someone else's or an unknown booking", async () => {
    const { show, seatIds } = await setup();
    const alice = await createUser();
    const bob = await createUser();
    const { holdId } = await hold(alice.auth, show.id, [seatIds[0]!]);
    const created = (await book(alice.auth, show.id, holdId)).body.data;

    expect((await api.get(`/api/v1/bookings/${created.id}`).set(bob.auth)).status).toBe(404);
    expect((await api.get(`/api/v1/bookings/${randomUUID()}`).set(alice.auth)).status).toBe(404);
  });
});
