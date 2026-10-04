import { describe, expect, it } from 'vitest';
import { db } from '@/db';
import { events, shows, venues } from '@/db/schema';
import { isOnSale } from '@/modules/shows/shows.service';
import { api } from './helpers';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const pricing = { standard: 49900, premium: 99900, vip: 249900 };

type ShowInsert = Partial<typeof shows.$inferInsert>;
type ListItem = {
  id: string;
  startsAt: string;
  eventTitle: string;
  venueName: string;
  venueCity: string;
};

/** One event + one venue to hang shows on. Shows are inserted directly so tests can use any dates. */
const setup = async (city = 'Delhi') => {
  const [venue] = await db.insert(venues).values({ name: 'JLN Arena', city }).returning();
  const [event] = await db
    .insert(events)
    .values({
      title: 'Still Alive',
      description: 'A long enough description',
      durationMinutes: 120,
    })
    .returning();
  const insertShows = (overrides: ShowInsert[]) =>
    db
      .insert(shows)
      .values(
        overrides.map((o) => ({
          eventId: event!.id,
          venueId: venue!.id,
          startsAt: new Date(Date.now() + 10 * DAY),
          salesOpenAt: new Date(Date.now() - HOUR),
          pricing,
          ...o,
        })),
      )
      .returning();
  return { venue: venue!, event: event!, insertShows };
};

/** Follows nextCursor until it is null and returns every page. */
const fetchAllPages = async (limit: number, extra: Record<string, string> = {}) => {
  const pages: { items: ListItem[]; nextCursor: string | null }[] = [];
  let cursor: string | undefined;
  do {
    const res = await api
      .get('/api/v1/shows')
      .query({ limit, ...extra, ...(cursor && { cursor }) });
    expect(res.status).toBe(200);
    pages.push(res.body.data);
    cursor = res.body.data.nextCursor ?? undefined;
  } while (cursor);
  return pages;
};

describe('GET /api/v1/shows', () => {
  it('pages through 25 shows as 10, 10, 5 with no duplicates and a null final cursor', async () => {
    const { insertShows } = await setup();
    const base = Date.now() + DAY;
    await insertShows(
      Array.from({ length: 25 }, (_, i) => ({ startsAt: new Date(base + i * HOUR) })),
    );

    const pages = await fetchAllPages(10);
    const ids = pages.flatMap((p) => p.items.map((s) => s.id));

    expect(pages.map((p) => p.items.length)).toEqual([10, 10, 5]);
    expect(pages.map((p) => p.nextCursor === null)).toEqual([false, false, true]);
    expect(new Set(ids).size).toBe(25);

    const times = pages.flatMap((p) => p.items.map((s) => Date.parse(s.startsAt)));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('never skips or repeats shows that start at the same time', async () => {
    const { insertShows } = await setup();
    const startsAt = new Date(Date.now() + 2 * DAY);
    const created = await insertShows(Array.from({ length: 12 }, () => ({ startsAt })));

    const pages = await fetchAllPages(5); // page boundaries fall in the middle of the tie
    const ids = pages.flatMap((p) => p.items.map((s) => s.id));

    expect(pages.map((p) => p.items.length)).toEqual([5, 5, 2]);
    expect(new Set(ids).size).toBe(12);
    expect([...ids].sort()).toEqual(created.map((s) => s.id).sort());
    expect(ids).toEqual([...ids].sort()); // the id tiebreaker gives a stable order
  });

  it('returns the event title and venue name and city', async () => {
    const { insertShows } = await setup('Mumbai');
    await insertShows([{}]);

    const res = await api.get('/api/v1/shows');

    expect(res.body.data.items[0]).toMatchObject({
      eventTitle: 'Still Alive',
      venueName: 'JLN Arena',
      venueCity: 'Mumbai',
    });
  });

  it('returns an empty page when there are no shows', async () => {
    const res = await api.get('/api/v1/shows');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ items: [], nextCursor: null });
  });

  it('excludes cancelled and past shows', async () => {
    const { insertShows } = await setup();
    const [upcoming] = await insertShows([
      { startsAt: new Date(Date.now() + DAY) },
      { startsAt: new Date(Date.now() + DAY), status: 'cancelled' },
      { startsAt: new Date(Date.now() - DAY), salesOpenAt: new Date(Date.now() - 2 * DAY) },
    ]);

    const res = await api.get('/api/v1/shows');

    expect(res.body.data.items.map((s: ListItem) => s.id)).toEqual([upcoming!.id]);
  });

  it('filters by city', async () => {
    const delhi = await setup('Delhi');
    const mumbai = await setup('Mumbai');
    const [inDelhi] = await delhi.insertShows([{}]);
    await mumbai.insertShows([{}, {}]);

    const res = await api.get('/api/v1/shows').query({ city: 'Delhi' });

    expect(res.body.data.items.map((s: ListItem) => s.id)).toEqual([inDelhi!.id]);
  });

  it('filters by from', async () => {
    const { insertShows } = await setup();
    const [, later] = await insertShows([
      { startsAt: new Date(Date.now() + 2 * DAY) },
      { startsAt: new Date(Date.now() + 20 * DAY) },
    ]);

    const from = new Date(Date.now() + 10 * DAY).toISOString();
    const res = await api.get('/api/v1/shows').query({ from });

    expect(res.body.data.items.map((s: ListItem) => s.id)).toEqual([later!.id]);
  });

  it('keeps filters applied on later pages', async () => {
    const delhi = await setup('Delhi');
    const mumbai = await setup('Mumbai');
    await delhi.insertShows(
      Array.from({ length: 7 }, (_, i) => ({ startsAt: new Date(Date.now() + (i + 1) * DAY) })),
    );
    await mumbai.insertShows(
      Array.from({ length: 7 }, (_, i) => ({
        startsAt: new Date(Date.now() + (i + 1) * DAY + HOUR),
      })),
    );

    const pages = await fetchAllPages(3, { city: 'Delhi' });

    expect(pages.map((p) => p.items.length)).toEqual([3, 3, 1]);
    expect(pages.flatMap((p) => p.items).every((s) => s.venueCity === 'Delhi')).toBe(true);
  });

  it('is public and needs no token', async () => {
    expect((await api.get('/api/v1/shows')).status).toBe(200);
  });

  it.each([
    ['limit=0', { limit: '0' }],
    ['limit=1000', { limit: '1000' }],
    ['limit=abc', { limit: 'abc' }],
    ['an invalid from date', { from: 'yesterday-ish' }],
  ])('rejects %s with 422', async (_label, query) => {
    const res = await api.get('/api/v1/shows').query(query);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['not base64 json', 'garbage'],
    ['json with the wrong shape', Buffer.from('{"id":1}').toString('base64url')],
    ['json that is not an object', Buffer.from('"text"').toString('base64url')],
  ])('rejects a cursor that is %s with 400', async (_label, cursor) => {
    const res = await api.get('/api/v1/shows').query({ cursor });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid cursor');
  });
});

describe('GET /api/v1/shows/:id', () => {
  it('returns the show with its event, venue and onSale', async () => {
    const { insertShows, event, venue } = await setup('Delhi');
    const [show] = await insertShows([{ isHighDemand: true }]);

    const res = await api.get(`/api/v1/shows/${show!.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: show!.id,
      isHighDemand: true,
      pricing,
      onSale: true,
      event: { id: event.id, title: 'Still Alive', durationMinutes: 120 },
      venue: { id: venue.id, name: 'JLN Arena', city: 'Delhi' },
    });
    expect(res.body.data).not.toHaveProperty('shows'); // no leaked join shape
  });

  it('reports onSale false before sales open', async () => {
    const { insertShows } = await setup();
    const [show] = await insertShows([{ salesOpenAt: new Date(Date.now() + DAY) }]);

    const res = await api.get(`/api/v1/shows/${show!.id}`);

    expect(res.body.data.onSale).toBe(false);
  });

  it('reports onSale false for a cancelled show', async () => {
    const { insertShows } = await setup();
    const [show] = await insertShows([{ status: 'cancelled' }]);

    const res = await api.get(`/api/v1/shows/${show!.id}`);

    expect(res.body.data.onSale).toBe(false);
  });

  it('returns 404 for an unknown show and 422 for a non-uuid', async () => {
    const missing = await api.get(`/api/v1/shows/${crypto.randomUUID()}`);
    const invalid = await api.get('/api/v1/shows/not-a-uuid');

    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
    expect(invalid.status).toBe(422);
  });

  it('is public and needs no token', async () => {
    const { insertShows } = await setup();
    const [show] = await insertShows([{}]);

    expect((await api.get(`/api/v1/shows/${show!.id}`)).status).toBe(200);
  });
});

describe('isOnSale', () => {
  const salesOpenAt = new Date('2030-01-01T10:00:00Z');
  const startsAt = new Date('2030-01-10T10:00:00Z');
  const show = { salesOpenAt, startsAt, status: 'scheduled' } as typeof shows.$inferSelect;
  const at = (iso: string) => isOnSale({ show, now: new Date(iso) });

  it('is false before sales open, true from the opening instant, false once the show starts', () => {
    expect(at('2030-01-01T09:59:59Z')).toBe(false);
    expect(at('2030-01-01T10:00:00Z')).toBe(true);
    expect(at('2030-01-10T09:59:59Z')).toBe(true);
    expect(at('2030-01-10T10:00:00Z')).toBe(false);
  });

  it('is false for a cancelled show even inside the window', () => {
    expect(
      isOnSale({ show: { ...show, status: 'cancelled' }, now: new Date('2030-01-05T00:00:00Z') }),
    ).toBe(false);
  });
});
