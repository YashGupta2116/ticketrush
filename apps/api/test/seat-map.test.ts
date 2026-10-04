import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/db';
import { showSeats } from '@/db/schema';
import { api, createUser } from './helpers';

const DAY = 86_400_000;
const pricing = { standard: 49900, premium: 99900, vip: 249900 };

type Seat = {
  id: string;
  section: string;
  row: string;
  number: number;
  tier: string;
  priceCents: number;
  status: string;
};

/** Creates a venue + show through the API so the seat map comes from the real generation path. */
const createShow = async (
  auth: Record<string, string>,
  sections: object[],
  showPricing = pricing,
) => {
  const venue = (
    await api.post('/api/v1/venues').set(auth).send({ name: 'JLN Arena', city: 'Delhi', sections })
  ).body.data;
  const event = (
    await api
      .post('/api/v1/events')
      .set(auth)
      .send({ title: 'Still Alive', description: 'x'.repeat(60), durationMinutes: 150 })
  ).body.data;
  const show = (
    await api
      .post('/api/v1/shows')
      .set(auth)
      .send({
        eventId: event.id,
        venueId: venue.id,
        startsAt: new Date(Date.now() + 10 * DAY).toISOString(),
        salesOpenAt: new Date(Date.now() + DAY).toISOString(),
        pricing: showPricing,
      })
  ).body.data;
  return { venue, event, show };
};

const defaultSections = [
  { name: 'Floor', rows: 2, seatsPerRow: 3, tier: 'vip' },
  { name: 'Balcony', rows: 3, seatsPerRow: 4, tier: 'standard' },
];

const seatMap = async (showId: string) => {
  const res = await api.get(`/api/v1/shows/${showId}/seats`);
  expect(res.status).toBe(200);
  return res.body.data as Seat[];
};

describe('GET /api/v1/shows/:id/seats', () => {
  it('returns one entry per seat of the venue', async () => {
    const { auth } = await createUser({ role: 'admin' });
    const { show } = await createShow(auth, defaultSections);

    expect(await seatMap(show.id)).toHaveLength(18); // 2×3 + 3×4
  });

  it('returns exactly the fields the seat picker needs, all available', async () => {
    const { auth } = await createUser({ role: 'admin' });
    const { show } = await createShow(auth, defaultSections);

    const [first] = await seatMap(show.id);

    expect(Object.keys(first!).sort()).toEqual(
      ['id', 'number', 'priceCents', 'row', 'section', 'status', 'tier'].sort(),
    );
    expect(first).toMatchObject({ section: 'Balcony', row: 'A', number: 1, status: 'available' });
  });

  it('prices every seat by its tier', async () => {
    const { auth } = await createUser({ role: 'admin' });
    const { show } = await createShow(auth, defaultSections);

    const map = await seatMap(show.id);

    expect(map.filter((s) => s.tier === 'vip').every((s) => s.priceCents === pricing.vip)).toBe(
      true,
    );
    expect(
      map.filter((s) => s.tier === 'standard').every((s) => s.priceCents === pricing.standard),
    ).toBe(true);
    expect(map.filter((s) => s.tier === 'vip')).toHaveLength(6);
  });

  it('sorts by section, then row, then numerically by seat number', async () => {
    const { auth } = await createUser({ role: 'admin' });
    // 12 seats per row, so 10 must come after 9 (a text sort would put it after 1)
    const { show } = await createShow(auth, [
      { name: 'Stalls', rows: 2, seatsPerRow: 12, tier: 'standard' },
      { name: 'Balcony', rows: 2, seatsPerRow: 12, tier: 'vip' },
    ]);

    const map = await seatMap(show.id);
    const positions = map.map((s) => [s.section, s.row, s.number] as const);
    const expected = [...positions].sort(
      (a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[2] - b[2],
    );

    expect(positions).toEqual(expected);
    expect(map.slice(0, 12).map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(map[0]).toMatchObject({ section: 'Balcony', row: 'A', number: 1 });
    expect(map.at(-1)).toMatchObject({ section: 'Stalls', row: 'B', number: 12 });
  });

  it('returns show seat ids, not physical seat ids', async () => {
    const { auth } = await createUser({ role: 'admin' });
    const { show } = await createShow(auth, defaultSections);

    const map = await seatMap(show.id);
    const rows = await db.select().from(showSeats).where(eq(showSeats.showId, show.id));

    expect(map.map((s) => s.id).sort()).toEqual(rows.map((r) => r.id).sort());
  });

  it('keeps shows at the same venue independent, each with its own prices', async () => {
    const { auth } = await createUser({ role: 'admin' });
    const first = await createShow(auth, defaultSections);
    const secondShow = (
      await api
        .post('/api/v1/shows')
        .set(auth)
        .send({
          eventId: first.event.id,
          venueId: first.venue.id,
          startsAt: new Date(Date.now() + 20 * DAY).toISOString(),
          salesOpenAt: new Date(Date.now() + DAY).toISOString(),
          pricing: { standard: 1000, premium: 2000, vip: 3000 },
        })
    ).body.data;

    const [a, b] = [await seatMap(first.show.id), await seatMap(secondShow.id)];

    expect(a).toHaveLength(18);
    expect(b).toHaveLength(18);
    expect(new Set([...a, ...b].map((s) => s.id)).size).toBe(36);
    expect(new Set(b.filter((s) => s.tier === 'vip').map((s) => s.priceCents))).toEqual(
      new Set([3000]),
    );
  });

  it('reflects a seat status change', async () => {
    const { auth } = await createUser({ role: 'admin' });
    const { show } = await createShow(auth, defaultSections);
    const [target] = await seatMap(show.id);

    await db.update(showSeats).set({ status: 'reserved' }).where(eq(showSeats.id, target!.id));

    const map = await seatMap(show.id);
    expect(map.find((s) => s.id === target!.id)?.status).toBe('reserved');
    expect(map.filter((s) => s.status === 'available')).toHaveLength(17);
  });

  it('returns 404 for an unknown show and 422 for a non-uuid', async () => {
    const missing = await api.get(`/api/v1/shows/${crypto.randomUUID()}/seats`);
    const invalid = await api.get('/api/v1/shows/not-a-uuid/seats');

    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
    expect(invalid.status).toBe(422);
  });

  it('is public and needs no token', async () => {
    const { auth } = await createUser({ role: 'admin' });
    const { show } = await createShow(auth, defaultSections);

    expect((await api.get(`/api/v1/shows/${show.id}/seats`)).status).toBe(200);
  });
});
