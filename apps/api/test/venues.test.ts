import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/db';
import { seats, venues } from '@/db/schema';
import { api, createUser } from './helpers';

const layout = {
  name: 'JLN Arena',
  city: 'Delhi',
  sections: [
    { name: 'Floor', rows: 2, seatsPerRow: 3, tier: 'vip' },
    { name: 'Balcony', rows: 3, seatsPerRow: 4, tier: 'standard' },
  ],
};

describe('POST /api/v1/venues', () => {
  it('creates the venue and generates every seat', async () => {
    const { auth } = await createUser({ role: 'admin' });
    const res = await api.post('/api/v1/venues').set(auth).send(layout);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'JLN Arena', city: 'Delhi', seatCount: 18 });

    const rows = await db.select().from(seats).where(eq(seats.venueId, res.body.data.id));
    expect(rows).toHaveLength(18);
    expect(rows.filter((s) => s.section === 'Floor' && s.tier === 'vip')).toHaveLength(6);
    expect(rows.some((s) => s.section === 'Balcony' && s.row === 'C' && s.number === 4)).toBe(true);
  });

  it('rejects unauthenticated requests with 401 and non-admins with 403', async () => {
    const { auth } = await createUser(); // role: user

    expect((await api.post('/api/v1/venues').send(layout)).status).toBe(401);
    expect((await api.post('/api/v1/venues').set(auth).send(layout)).status).toBe(403);
    expect(await db.select().from(venues)).toHaveLength(0);
  });

  it.each([
    ['no sections', { ...layout, sections: [] }],
    ['zero rows', { ...layout, sections: [{ name: 'A', rows: 0, seatsPerRow: 5, tier: 'vip' }] }],
    [
      'unknown tier',
      { ...layout, sections: [{ name: 'A', rows: 1, seatsPerRow: 5, tier: 'gold' }] },
    ],
    [
      'too many rows',
      { ...layout, sections: [{ name: 'A', rows: 27, seatsPerRow: 5, tier: 'vip' }] },
    ],
    [
      'too many seats in total',
      {
        ...layout,
        sections: [
          { name: 'A', rows: 26, seatsPerRow: 100, tier: 'vip' },
          { name: 'B', rows: 26, seatsPerRow: 100, tier: 'standard' },
        ],
      },
    ],
  ])('rejects an invalid layout with 422: %s', async (_label, body) => {
    const { auth } = await createUser({ role: 'admin' });
    const res = await api.post('/api/v1/venues').set(auth).send(body);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await db.select().from(venues)).toHaveLength(0);
  });
});

describe('GET /api/v1/venues/:id', () => {
  const createdVenue = async () => {
    const { auth } = await createUser({ role: 'admin' });
    return (await api.post('/api/v1/venues').set(auth).send(layout)).body.data;
  };

  it('returns the venue with a per-section summary', async () => {
    const venue = await createdVenue();
    const res = await api.get(`/api/v1/venues/${venue.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: venue.id, name: 'JLN Arena', city: 'Delhi' });
    expect(res.body.data.sections).toEqual([
      { section: 'Balcony', tier: 'standard', seatCount: 12 },
      { section: 'Floor', tier: 'vip', seatCount: 6 },
    ]);
  });

  it('returns 404 for a venue that does not exist', async () => {
    const res = await api.get(`/api/v1/venues/${crypto.randomUUID()}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects a non-uuid id with 422', async () => {
    const res = await api.get('/api/v1/venues/not-a-uuid');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('has no route for a missing id', async () => {
    expect((await api.get('/api/v1/venues/')).status).toBe(404);
  });
});
