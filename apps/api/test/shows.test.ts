import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/db';
import { showSeats, shows, venues } from '@/db/schema';
import { api, createUser } from './helpers';

const DAY = 86_400_000;
const pricing = { standard: 49900, premium: 99900, vip: 249900 };

/** Creates a venue (via the API) with `rows × seatsPerRow` seats per section. */
const createVenue = async (auth: Record<string, string>, sections: object[]) =>
  (await api.post('/api/v1/venues').set(auth).send({ name: 'JLN Arena', city: 'Delhi', sections }))
    .body.data;

const createEvent = async (auth: Record<string, string>) =>
  (
    await api
      .post('/api/v1/events')
      .set(auth)
      .send({ title: 'Still Alive', description: 'x'.repeat(60), durationMinutes: 150 })
  ).body.data;

/** An admin plus a valid show payload for a 100-seat venue (20 vip + 80 standard). */
const setup = async () => {
  const { auth } = await createUser({ role: 'admin' });
  const venue = await createVenue(auth, [
    { name: 'Floor', rows: 2, seatsPerRow: 10, tier: 'vip' },
    { name: 'Back', rows: 4, seatsPerRow: 20, tier: 'standard' },
  ]);
  const event = await createEvent(auth);
  const body = {
    eventId: event.id,
    venueId: venue.id,
    startsAt: new Date(Date.now() + 10 * DAY).toISOString(),
    salesOpenAt: new Date(Date.now() + DAY).toISOString(),
    pricing,
  };
  return { auth, venue, event, body };
};

type Body = Awaited<ReturnType<typeof setup>>['body'];

describe('POST /api/v1/shows', () => {
  it('creates the show and one available, correctly priced show seat per venue seat', async () => {
    const { auth, body } = await setup();
    const res = await api.post('/api/v1/shows').set(auth).send(body);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      eventId: body.eventId,
      isHighDemand: false,
      seatCount: 100,
    });

    const rows = await db.select().from(showSeats).where(eq(showSeats.showId, res.body.data.id));
    expect(rows).toHaveLength(100);
    expect(rows.every((r) => r.status === 'available' && r.bookingId === null)).toBe(true);
    expect(rows.every((r) => r.version === 0)).toBe(true);

    const prices = rows.reduce<Record<number, number>>(
      (acc, r) => ({ ...acc, [r.priceCents]: (acc[r.priceCents] ?? 0) + 1 }),
      {},
    );
    expect(prices).toEqual({ [pricing.vip]: 20, [pricing.standard]: 80 });
  });

  it('keeps two shows at the same venue independent', async () => {
    const { auth, body } = await setup();
    await api.post('/api/v1/shows').set(auth).send(body);
    const second = await api
      .post('/api/v1/shows')
      .set(auth)
      .send({ ...body, isHighDemand: true });

    expect(second.status).toBe(201);
    expect(second.body.data.isHighDemand).toBe(true);
    expect(await db.select().from(showSeats)).toHaveLength(200);
  });

  it('rejects unauthenticated requests with 401 and non-admins with 403', async () => {
    const { body } = await setup();
    const { auth: userAuth } = await createUser();

    expect((await api.post('/api/v1/shows').send(body)).status).toBe(401);
    expect((await api.post('/api/v1/shows').set(userAuth).send(body)).status).toBe(403);
    expect(await db.select().from(shows)).toHaveLength(0);
  });

  it.each([
    [
      'salesOpenAt after startsAt',
      (b: Body) => ({ ...b, salesOpenAt: new Date(Date.now() + 20 * DAY).toISOString() }),
    ],
    ['salesOpenAt equal to startsAt', (b: Body) => ({ ...b, salesOpenAt: b.startsAt })],
    [
      'startsAt in the past',
      (b: Body) => ({
        ...b,
        startsAt: new Date(Date.now() - DAY).toISOString(),
        salesOpenAt: new Date(Date.now() - 2 * DAY).toISOString(),
      }),
    ],
    ['a negative price', (b: Body) => ({ ...b, pricing: { ...b.pricing, vip: -1 } })],
    ['a fractional price', (b: Body) => ({ ...b, pricing: { ...b.pricing, vip: 99.5 } })],
    ['a missing tier price', (b: Body) => ({ ...b, pricing: { standard: 1, vip: 2 } })],
    ['a non-uuid venueId', (b: Body) => ({ ...b, venueId: 'nope' })],
    ['an invalid date', (b: Body) => ({ ...b, startsAt: 'not-a-date' })],
  ])('rejects %s with 422', async (_label, mutate) => {
    const { auth, body } = await setup();
    const res = await api.post('/api/v1/shows').set(auth).send(mutate(body));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await db.select().from(shows)).toHaveLength(0);
  });

  it('returns 404 for an unknown venue or event and leaves nothing behind', async () => {
    const { auth, body } = await setup();

    const badVenue = await api
      .post('/api/v1/shows')
      .set(auth)
      .send({ ...body, venueId: crypto.randomUUID() });
    const badEvent = await api
      .post('/api/v1/shows')
      .set(auth)
      .send({ ...body, eventId: crypto.randomUUID() });

    expect(badVenue.status).toBe(404);
    expect(badEvent.status).toBe(404);
    expect(await db.select().from(shows)).toHaveLength(0);
    expect(await db.select().from(showSeats)).toHaveLength(0);
  });

  it('rejects a show on a venue without seats and rolls the show back', async () => {
    const { auth, body } = await setup();
    const [empty] = await db.insert(venues).values({ name: 'Empty', city: 'Nowhere' }).returning();

    const res = await api
      .post('/api/v1/shows')
      .set(auth)
      .send({ ...body, venueId: empty!.id });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('The venue has no seats');
    expect(await db.select().from(shows)).toHaveLength(0);
  });
});
