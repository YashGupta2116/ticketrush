import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/db';
import { events } from '@/db/schema';
import { cached } from '@/lib/cache';
import { api, createOnSaleShow, createUser } from './helpers';

describe('cached()', () => {
  it('loads once for concurrent misses (single-flight) and once more only after expiry', async () => {
    let loads = 0;
    const load = async () => {
      loads++;
      await new Promise((r) => setTimeout(r, 30));
      return { n: 1 };
    };
    const results = await Promise.all(Array.from({ length: 20 }, () => cached('k', 60, load)));
    expect(results.every((r) => r.n === 1)).toBe(true);
    expect(loads).toBe(1);
    await cached('k', 60, load);
    expect(loads).toBe(1); // served from Redis
  });
});

describe('GET /api/v1/shows/:id caching', () => {
  it('serves the static part from cache but derives onSale fresh', async () => {
    const { auth: admin } = await createUser({ role: 'admin' });
    const { show } = await createOnSaleShow(admin);

    const first = await api.get(`/api/v1/shows/${show.id}`);
    await db.update(events).set({ title: 'Changed in DB' }).where(eq(events.id, show.eventId));
    const second = await api.get(`/api/v1/shows/${show.id}`);

    expect(first.body.data.onSale).toBe(true);
    expect(second.body.data.event.title).toBe(first.body.data.event.title); // not re-read from Postgres
    expect(second.body.data.onSale).toBe(true);
  });
});
