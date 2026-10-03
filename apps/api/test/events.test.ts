import { describe, expect, it } from 'vitest';
import { db } from '@/db';
import { events } from '@/db/schema';
import { api, createUser } from './helpers';

const validEvent = {
  title: 'Still Alive',
  description:
    'A standup special of samay raina happening in 10+ cities, fun to watch, you are not ready for this!',
  durationMinutes: 180,
};

describe('POST /api/v1/events', () => {
  it('creates the event', async () => {
    const { auth } = await createUser({ role: 'admin' });
    const res = await api.post('/api/v1/events').set(auth).send(validEvent);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: 'Still Alive',
      description: validEvent.description,
      durationMinutes: 180,
    });
  });

  it('accepts a short but realistic duration', async () => {
    const { auth } = await createUser({ role: 'admin' });
    const res = await api
      .post('/api/v1/events')
      .set(auth)
      .send({ ...validEvent, durationMinutes: 60 });

    expect(res.status).toBe(201);
  });

  it.each([
    ['an empty title', { title: '' }],
    ['a too-long title', { title: 'x'.repeat(101) }],
    ['a too-short description', { description: 'too short' }],
    ['a zero duration', { durationMinutes: 0 }],
    ['a negative duration', { durationMinutes: -5 }],
    ['a fractional duration', { durationMinutes: 90.5 }],
    ['a duration over the maximum', { durationMinutes: 601 }],
  ])('rejects %s with 422', async (_label, override) => {
    const { auth } = await createUser({ role: 'admin' });
    const res = await api
      .post('/api/v1/events')
      .set(auth)
      .send({ ...validEvent, ...override });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await db.select().from(events)).toHaveLength(0);
  });

  it('rejects a missing field with 422', async () => {
    const { auth } = await createUser({ role: 'admin' });
    const { title: _title, ...withoutTitle } = validEvent;
    const res = await api.post('/api/v1/events').set(auth).send(withoutTitle);

    expect(res.status).toBe(422);
  });

  it('rejects unauthenticated requests with 401 and non-admins with 403', async () => {
    const { auth } = await createUser();

    expect((await api.post('/api/v1/events').send(validEvent)).status).toBe(401);
    expect((await api.post('/api/v1/events').set(auth).send(validEvent)).status).toBe(403);
    expect(await db.select().from(events)).toHaveLength(0);
  });
});

describe('GET /api/v1/events/:id', () => {
  const createEvent = async () => {
    const { auth } = await createUser({ role: 'admin' });
    return (await api.post('/api/v1/events').set(auth).send(validEvent)).body.data;
  };

  it('returns the event', async () => {
    const event = await createEvent();
    const res = await api.get(`/api/v1/events/${event.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: event.id,
      title: 'Still Alive',
      description: validEvent.description,
      durationMinutes: 180,
    });
  });

  it('returns 404 for a event that does not exist', async () => {
    const res = await api.get(`/api/v1/events/${crypto.randomUUID()}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects a non-uuid id with 422', async () => {
    const res = await api.get('/api/v1/events/not-a-uuid');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('has no route for a missing id', async () => {
    expect((await api.get('/api/v1/events/')).status).toBe(404);
  });
});
