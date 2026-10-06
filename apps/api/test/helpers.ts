import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { createApp } from '@/app';
import { db } from '@/db';
import { shows, users } from '@/db/schema';
import { hashPassword } from '@/lib/crypto';
import { signAccessToken } from '@/lib/jwt';

export const api = request(createApp());

export const TEST_PASSWORD = 'Password123!';
const passwordHash = hashPassword(TEST_PASSWORD); // hash once, reuse (argon2 is slow on purpose)

export const createUser = async (overrides: Partial<typeof users.$inferInsert> = {}) => {
  const [user] = await db
    .insert(users)
    .values({
      email: `${randomUUID()}@test.dev`,
      name: 'Test User',
      passwordHash: await passwordHash,
      ...overrides,
    })
    .returning();
  const token = await signAccessToken({ id: user!.id, role: user!.role });
  return { user: user!, auth: { authorization: `Bearer ${token}` } };
};

const DAY = 86_400_000;

/**
 * Creates a venue (2 rows × 10 seats = 20 seats), an event and a show through the API, then opens
 * sales. The API only accepts a future `salesOpenAt`, so sales are opened directly in the database.
 */
export const createOnSaleShow = async (
  admin: Record<string, string>,
  overrides: Record<string, unknown> = {},
) => {
  const venue = (
    await api
      .post('/api/v1/venues')
      .set(admin)
      .send({
        name: 'JLN Arena',
        city: 'Delhi',
        sections: [{ name: 'Floor', rows: 2, seatsPerRow: 10, tier: 'standard' }],
      })
  ).body.data;
  const event = (
    await api
      .post('/api/v1/events')
      .set(admin)
      .send({ title: 'Still Alive', description: 'x'.repeat(60), durationMinutes: 150 })
  ).body.data;
  const show = (
    await api
      .post('/api/v1/shows')
      .set(admin)
      .send({
        eventId: event.id,
        venueId: venue.id,
        startsAt: new Date(Date.now() + 10 * DAY).toISOString(),
        salesOpenAt: new Date(Date.now() + DAY).toISOString(),
        pricing: { standard: 49900, premium: 99900, vip: 249900 },
        ...overrides,
      })
  ).body.data;
  await db
    .update(shows)
    .set({ salesOpenAt: new Date(Date.now() - 1000) })
    .where(eq(shows.id, show.id));

  const seatMap: { id: string }[] = (await api.get(`/api/v1/shows/${show.id}/seats`)).body.data;
  return { show, seatIds: seatMap.map((s) => s.id) };
};
