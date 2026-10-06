import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/db';
import { showSeats, shows } from '@/db/schema';
import { redis } from '@/lib/redis';
import { metaKey, seatKey, userKey } from '@/modules/holds/holds.keys';
import { api, createOnSaleShow as createShow, createUser } from './helpers';

const DAY = 86_400_000;

type Auth = Record<string, string>;

const hold = (auth: Auth, showId: string, showSeatIds: string[]) =>
  api.post(`/api/v1/shows/${showId}/holds`).set(auth).send({ showSeatIds });

const setup = async () => {
  const { auth: admin } = await createUser({ role: 'admin' });
  const { show, seatIds } = await createShow(admin);
  return { admin, show, seatIds };
};

describe('POST /api/v1/shows/:id/holds', () => {
  it('holds a single seat and stores it in Redis with a TTL', async () => {
    const { show, seatIds } = await setup();
    const { user, auth } = await createUser();

    const res = await hold(auth, show.id, [seatIds[0]!]);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ showSeatIds: [seatIds[0]] });
    const { holdId, expiresAt } = res.body.data;
    expect(Date.parse(expiresAt) - Date.now()).toBeGreaterThan(290_000);

    expect(await redis.get(seatKey(show.id, seatIds[0]!))).toBe(holdId);
    expect(await redis.get(userKey(show.id, user.id))).toBe(holdId);
    expect(JSON.parse((await redis.get(metaKey(show.id, holdId)))!)).toEqual({
      userId: user.id,
      showSeatIds: [seatIds[0]],
    });
    for (const key of [seatKey(show.id, seatIds[0]!), userKey(show.id, user.id)]) {
      const ttl = await redis.ttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300);
    }
  });

  it('holds several seats at once', async () => {
    const { show, seatIds } = await setup();
    const { auth } = await createUser();
    const wanted = seatIds.slice(0, 3);

    const res = await hold(auth, show.id, wanted);

    expect(res.status).toBe(201);
    for (const id of wanted) expect(await redis.exists(seatKey(show.id, id))).toBe(1);
  });

  it('returns 409 SEATS_UNAVAILABLE naming the seats that were taken', async () => {
    const { show, seatIds } = await setup();
    const alice = await createUser();
    const bob = await createUser();
    await hold(alice.auth, show.id, [seatIds[1]!]);

    const res = await hold(bob.auth, show.id, [seatIds[0]!, seatIds[1]!]);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SEATS_UNAVAILABLE');
    expect(res.body.error.details).toEqual({ showSeatIds: [seatIds[1]] });
  });

  it('is all-or-nothing: a failed multi-seat hold leaves the free seats untouched', async () => {
    const { show, seatIds } = await setup();
    const alice = await createUser();
    const bob = await createUser();
    await hold(alice.auth, show.id, [seatIds[2]!]);

    const res = await hold(bob.auth, show.id, [seatIds[0]!, seatIds[1]!, seatIds[2]!]);

    expect(res.status).toBe(409);
    expect(await redis.exists(seatKey(show.id, seatIds[0]!))).toBe(0);
    expect(await redis.exists(seatKey(show.id, seatIds[1]!))).toBe(0);
    expect(await redis.exists(userKey(show.id, bob.user.id))).toBe(0);
    expect(await redis.get(userKey(show.id, alice.user.id))).not.toBeNull(); // Alice unaffected
    // and the free seats are still holdable by someone else
    expect(
      (await hold((await createUser()).auth, show.id, [seatIds[0]!, seatIds[1]!])).status,
    ).toBe(201);
  });

  it('lets exactly one of many concurrent users win the same seat', async () => {
    const { show, seatIds } = await setup();
    const users = await Promise.all(Array.from({ length: 20 }, () => createUser()));

    const results = await Promise.all(users.map((u) => hold(u.auth, show.id, [seatIds[0]!])));
    const statuses = results.map((r) => r.status);

    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(19);
  });

  it('never hands out the same seat twice under overlapping multi-seat races', async () => {
    const { show, seatIds } = await setup();
    const users = await Promise.all(Array.from({ length: 10 }, () => createUser()));

    // Each user wants 3 consecutive seats, so neighbours overlap.
    const results = await Promise.all(
      users.map((u, i) => hold(u.auth, show.id, seatIds.slice(i, i + 3))),
    );

    const winners = results.filter((r) => r.status === 201);
    const held = winners.flatMap((r) => r.body.data.showSeatIds as string[]);
    expect(new Set(held).size).toBe(held.length); // no seat appears in two holds
    expect(winners.length).toBeGreaterThan(0);
  });

  it('allows only one active hold per user per show', async () => {
    const { show, seatIds } = await setup();
    const { auth } = await createUser();
    await hold(auth, show.id, [seatIds[0]!]);

    const res = await hold(auth, show.id, [seatIds[1]!]);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HOLD_EXISTS');
    expect(await redis.exists(seatKey(show.id, seatIds[1]!))).toBe(0);
  });

  it.each([
    ['7 seats (over the maximum of 6)', (ids: string[]) => ids.slice(0, 7)],
    ['no seats', () => []],
    ['duplicate seats', (ids: string[]) => [ids[0]!, ids[0]!]],
    ['a non-uuid seat id', () => ['not-a-uuid']],
  ])('rejects %s with 422', async (_label, pick) => {
    const { show, seatIds } = await setup();
    const { auth } = await createUser();

    const res = await hold(auth, show.id, pick(seatIds));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unauthenticated request with 401', async () => {
    const { show, seatIds } = await setup();

    const res = await api
      .post(`/api/v1/shows/${show.id}/holds`)
      .send({ showSeatIds: [seatIds[0]] });

    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown show', async () => {
    const { seatIds } = await setup();
    const { auth } = await createUser();

    expect((await hold(auth, crypto.randomUUID(), [seatIds[0]!])).status).toBe(404);
  });

  it('rejects a show that is not on sale yet', async () => {
    const { admin, show } = await setup();
    const later = await createShow(admin);
    await db
      .update(shows)
      .set({ salesOpenAt: new Date(Date.now() + DAY) })
      .where(eq(shows.id, later.show.id));
    const { auth } = await createUser();

    const res = await hold(auth, later.show.id, [later.seatIds[0]!]);

    expect(res.status).toBe(409);
    expect(show.id).not.toBe(later.show.id);
  });

  it('rejects a cancelled show', async () => {
    const { show, seatIds } = await setup();
    await db.update(shows).set({ status: 'cancelled' }).where(eq(shows.id, show.id));
    const { auth } = await createUser();

    expect((await hold(auth, show.id, [seatIds[0]!])).status).toBe(409);
  });

  it('rejects seats that belong to another show', async () => {
    const { admin, show } = await setup();
    const other = await createShow(admin);
    const { auth } = await createUser();

    const res = await hold(auth, show.id, [other.seatIds[0]!]);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SEATS_UNAVAILABLE');
    expect(res.body.error.details.showSeatIds).toEqual([other.seatIds[0]]);
  });

  it('rejects seats that are not available in Postgres', async () => {
    const { show, seatIds } = await setup();
    await db.update(showSeats).set({ status: 'booked' }).where(eq(showSeats.id, seatIds[0]!));
    const { auth } = await createUser();

    const res = await hold(auth, show.id, [seatIds[0]!, seatIds[1]!]);

    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ showSeatIds: [seatIds[0]] });
    expect(await redis.exists(seatKey(show.id, seatIds[1]!))).toBe(0);
  });
});

const release = (auth: Auth, showId: string, holdId: string) =>
  api.delete(`/api/v1/shows/${showId}/holds/${holdId}`).set(auth);

type SeatMapItem = { id: string; status: string };
const seatMap = async (showId: string) =>
  (await api.get(`/api/v1/shows/${showId}/seats`)).body.data as SeatMapItem[];

describe('DELETE /api/v1/shows/:showId/holds/:id', () => {
  it('frees the seats and every Redis key of the hold', async () => {
    const { show, seatIds } = await setup();
    const { user, auth } = await createUser();
    const wanted = seatIds.slice(0, 3);
    const { holdId } = (await hold(auth, show.id, wanted)).body.data;

    const res = await release(auth, show.id, holdId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: null });
    for (const id of wanted) expect(await redis.exists(seatKey(show.id, id))).toBe(0);
    expect(await redis.exists(metaKey(show.id, holdId))).toBe(0);
    expect(await redis.exists(userKey(show.id, user.id))).toBe(0);
  });

  it('lets another user hold the released seats straight away', async () => {
    const { show, seatIds } = await setup();
    const alice = await createUser();
    const bob = await createUser();
    const { holdId } = (await hold(alice.auth, show.id, [seatIds[0]!])).body.data;

    expect((await hold(bob.auth, show.id, [seatIds[0]!])).status).toBe(409);
    await release(alice.auth, show.id, holdId);

    expect((await hold(bob.auth, show.id, [seatIds[0]!])).status).toBe(201);
  });

  it('lets the same user hold again after releasing (the user key is cleared)', async () => {
    const { show, seatIds } = await setup();
    const { auth } = await createUser();
    const { holdId } = (await hold(auth, show.id, [seatIds[0]!])).body.data;

    await release(auth, show.id, holdId);

    expect((await hold(auth, show.id, [seatIds[1]!])).status).toBe(201);
  });

  it("returns 404 for someone else's hold and leaves it untouched", async () => {
    const { show, seatIds } = await setup();
    const alice = await createUser();
    const mallory = await createUser();
    const { holdId } = (await hold(alice.auth, show.id, [seatIds[0]!])).body.data;

    const res = await release(mallory.auth, show.id, holdId);

    expect(res.status).toBe(404);
    expect(await redis.get(seatKey(show.id, seatIds[0]!))).toBe(holdId);
    expect(await redis.exists(userKey(show.id, alice.user.id))).toBe(1);
  });

  it("gives the same 404 for an unknown hold as for someone else's hold", async () => {
    const { show, seatIds } = await setup();
    const alice = await createUser();
    const mallory = await createUser();
    const { holdId } = (await hold(alice.auth, show.id, [seatIds[0]!])).body.data;

    const notYours = await release(mallory.auth, show.id, holdId);
    const unknown = await release(mallory.auth, show.id, crypto.randomUUID());

    expect(unknown.status).toBe(404);
    expect(unknown.body.error.message).toBe(notYours.body.error.message);
  });

  it('returns 404 when the hold was already released', async () => {
    const { show, seatIds } = await setup();
    const { auth } = await createUser();
    const { holdId } = (await hold(auth, show.id, [seatIds[0]!])).body.data;

    expect((await release(auth, show.id, holdId)).status).toBe(200);
    expect((await release(auth, show.id, holdId)).status).toBe(404);
  });

  it('returns 404 when the hold has already expired', async () => {
    const { show, seatIds } = await setup();
    const { auth } = await createUser();
    const { holdId } = (await hold(auth, show.id, [seatIds[0]!])).body.data;
    await redis.del(metaKey(show.id, holdId)); // what Redis does when the TTL runs out

    expect((await release(auth, show.id, holdId)).status).toBe(404);
  });

  it('never frees a seat that another user has since taken (compare-and-delete)', async () => {
    const { show, seatIds } = await setup();
    const alice = await createUser();
    const { holdId: aliceHold } = (await hold(alice.auth, show.id, [seatIds[0]!, seatIds[1]!])).body
      .data;

    // Simulate: Alice's hold on seat 0 expired and Bob took that seat with his own hold.
    const bobHold = crypto.randomUUID();
    await redis.set(seatKey(show.id, seatIds[0]!), bobHold);

    const res = await release(alice.auth, show.id, aliceHold);

    expect(res.status).toBe(200);
    expect(await redis.get(seatKey(show.id, seatIds[0]!))).toBe(bobHold); // Bob's hold survives
    expect(await redis.exists(seatKey(show.id, seatIds[1]!))).toBe(0); // Alice's own seat is freed
  });

  it('rejects an unauthenticated request with 401 and a non-uuid id with 422', async () => {
    const { show } = await setup();
    const { auth } = await createUser();

    expect((await api.delete(`/api/v1/shows/${show.id}/holds/${crypto.randomUUID()}`)).status).toBe(
      401,
    );
    expect((await release(auth, show.id, 'not-a-uuid')).status).toBe(422);
  });
});

describe('GET /api/v1/shows/:id/seats (held overlay)', () => {
  it('shows held seats as held and the rest as available', async () => {
    const { show, seatIds } = await setup();
    const { auth } = await createUser();
    const held = seatIds.slice(0, 2);
    await hold(auth, show.id, held);

    const map = await seatMap(show.id);

    expect(
      map
        .filter((s) => s.status === 'held')
        .map((s) => s.id)
        .sort(),
    ).toEqual([...held].sort());
    expect(map.filter((s) => s.status === 'available')).toHaveLength(seatIds.length - 2);
  });

  it('never reveals who holds a seat', async () => {
    const { show, seatIds } = await setup();
    const { user, auth } = await createUser();
    const { holdId } = (await hold(auth, show.id, [seatIds[0]!])).body.data;

    const res = await api.get(`/api/v1/shows/${show.id}/seats`);
    const body = JSON.stringify(res.body);

    expect(body).not.toContain(user.id);
    expect(body).not.toContain(holdId);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(
      ['id', 'number', 'priceCents', 'row', 'section', 'status', 'tier'].sort(),
    );
  });

  it('shows the seats as available again after release', async () => {
    const { show, seatIds } = await setup();
    const { auth } = await createUser();
    const { holdId } = (await hold(auth, show.id, [seatIds[0]!])).body.data;
    expect((await seatMap(show.id)).filter((s) => s.status === 'held')).toHaveLength(1);

    await release(auth, show.id, holdId);

    expect((await seatMap(show.id)).filter((s) => s.status === 'held')).toHaveLength(0);
  });

  it('does not show a booked seat as held even if a stale hold key exists', async () => {
    const { show, seatIds } = await setup();
    await db.update(showSeats).set({ status: 'booked' }).where(eq(showSeats.id, seatIds[0]!));
    await redis.set(seatKey(show.id, seatIds[0]!), crypto.randomUUID());

    const map = await seatMap(show.id);

    expect(map.find((s) => s.id === seatIds[0])?.status).toBe('booked');
  });

  it('keeps holds on different shows separate', async () => {
    const { admin, show, seatIds } = await setup();
    const other = await createShow(admin);
    const { auth } = await createUser();
    await hold(auth, show.id, [seatIds[0]!]);

    expect((await seatMap(other.show.id)).filter((s) => s.status === 'held')).toHaveLength(0);
  });
});
