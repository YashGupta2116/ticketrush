import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '@/middlewares/error-handler';
import { authenticate } from '@/middlewares/auth';
import { idempotent } from '@/middlewares/idempotency';
import { redis } from '@/lib/redis';
import { createUser } from './helpers';

/**
 * A throwaway app with one idempotent route. `POST /orders` stands in for POST /bookings (7.2).
 * `calls` counts how many times the handler REALLY ran: that is what idempotency must keep at 1.
 */
const buildApp = () => {
  const state = { calls: 0, delayMs: 0, failWith: 0 };
  const app = express();
  app.use(express.json());
  app.post('/orders', authenticate, idempotent(), async (req, res) => {
    state.calls += 1;
    if (state.delayMs) await new Promise((resolve) => setTimeout(resolve, state.delayMs));
    if (state.failWith) return res.status(state.failWith).json({ error: { code: 'BOOM' } });
    res.status(201).json({ data: { orderNumber: state.calls, item: req.body.item } });
  });
  app.use(errorHandler);
  return { state, http: request(app) };
};

const KEY = 'a-valid-idempotency-key-1';

const redisKeyOf = (userId: string, key = KEY) => `idem:${userId}:${key}`;

/** The middleware stores the response in a 'finish' handler, i.e. just AFTER the reply is sent. */
const waitForCompleted = (userId: string, key = KEY) =>
  vi.waitFor(async () => {
    const raw = await redis.get(redisKeyOf(userId, key));
    expect(raw && JSON.parse(raw).state).toBe('completed');
  });

const send = (
  http: ReturnType<typeof buildApp>['http'],
  auth: Record<string, string>,
  body: object = { item: 'seat-1' },
  key: string | null = KEY, // null = send no Idempotency-Key header at all
) => {
  const req = http.post('/orders').set(auth);
  return (key ? req.set('Idempotency-Key', key) : req).send(body);
};

describe('idempotent()', () => {
  it('processes the same key twice once, replaying an identical response', async () => {
    const { state, http } = buildApp();
    const { user, auth } = await createUser();
    const send = () =>
      http.post('/orders').set(auth).set('Idempotency-Key', KEY).send({ item: 'seat-1' });

    const first = await send();

    await vi.waitFor(async () => {
      const stored = JSON.parse((await redis.get(`idem:${user.id}:${KEY}`))!); // which user id?
      expect(stored.state).toBe('completed');
    });
    const second = await send();

    expect(first.status).toBe(201);
    expect(second.status).toBe(201); // the replay returns the SAME status
    expect(second.body).toEqual(first.body);
    expect(state.calls).toBe(1); // the handler really ran how many times?
  });

  it('marks only the replay with the Idempotent-Replayed header', async () => {
    const { http } = buildApp();
    const { user, auth } = await createUser();

    const first = await send(http, auth);
    await waitForCompleted(user.id);
    const second = await send(http, auth);

    expect(first.headers['idempotent-replayed']).toBeUndefined();
    expect(second.headers['idempotent-replayed']).toBe('true');
  });

  it.each([
    ['is missing', null],
    ['is shorter than 8 characters', 'short'],
    ['is longer than 255 characters', 'k'.repeat(256)],
  ])('rejects an Idempotency-Key that %s with 400', async (_label, key) => {
    const { state, http } = buildApp();
    const { auth } = await createUser();

    const res = await send(http, auth, { item: 'seat-1' }, key);

    expect(res.status).toBe(400);
    expect(state.calls).toBe(0);
  });

  it('rejects the same key with a different body with 422 IDEMPOTENCY_KEY_REUSED', async () => {
    const { state, http } = buildApp();
    const { user, auth } = await createUser();
    await send(http, auth, { item: 'seat-1' });
    await waitForCompleted(user.id);

    const res = await send(http, auth, { item: 'seat-2' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(state.calls).toBe(1);
  });

  it('answers 422 (not 409) when a different body arrives while the first is in progress', async () => {
    const { state, http } = buildApp();
    state.delayMs = 300;
    const { auth } = await createUser();

    const [first, other] = await Promise.all([
      send(http, auth, { item: 'seat-1' }),
      new Promise<Awaited<ReturnType<typeof send>>>((resolve) =>
        setTimeout(() => resolve(send(http, auth, { item: 'seat-2' })), 100),
      ),
    ]);

    expect(first.status).toBe(201);
    expect(other.status).toBe(422);
    expect(other.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('returns 409 REQUEST_IN_PROGRESS while the first request is still running', async () => {
    const { state, http } = buildApp();
    state.delayMs = 300;
    const { auth } = await createUser();

    const [a, b] = await Promise.all([send(http, auth), send(http, auth)]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.error.code).toBe('REQUEST_IN_PROGRESS');
    expect(state.calls).toBe(1);
  });

  it('lets exactly one of 20 simultaneous requests with one key do the work', async () => {
    const { state, http } = buildApp();
    state.delayMs = 300; // keeps the winner busy so every other request overlaps with it
    const { user, auth } = await createUser();

    const results = await Promise.all(Array.from({ length: 20 }, () => send(http, auth)));

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(19);
    expect(state.calls).toBe(1);

    // once it is done, a late retry gets the winner's response
    await waitForCompleted(user.id);
    const late = await send(http, auth);
    expect(late.status).toBe(201);
    expect(late.headers['idempotent-replayed']).toBe('true');
    expect(state.calls).toBe(1);
  });

  it('scopes keys per user: two users can use the same key independently', async () => {
    const { state, http } = buildApp();
    const alice = await createUser();
    const bob = await createUser();

    const [a, b] = await Promise.all([send(http, alice.auth), send(http, bob.auth)]);

    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.headers['idempotent-replayed']).toBeUndefined();
    expect(b.headers['idempotent-replayed']).toBeUndefined();
    expect(state.calls).toBe(2);
    expect(await redis.exists(redisKeyOf(alice.user.id), redisKeyOf(bob.user.id))).toBe(2);
  });

  it('stores a 4xx response and replays it', async () => {
    const { state, http } = buildApp();
    state.failWith = 409;
    const { user, auth } = await createUser();

    const first = await send(http, auth);
    await waitForCompleted(user.id);
    state.failWith = 0; // even if the handler would now succeed, the stored answer wins
    const second = await send(http, auth);

    expect(first.status).toBe(409);
    expect(second.status).toBe(409);
    expect(second.body).toEqual(first.body);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(state.calls).toBe(1);
  });

  it('deletes the key after a 5xx so the client can retry', async () => {
    const { state, http } = buildApp();
    state.failWith = 500;
    const { user, auth } = await createUser();

    const first = await send(http, auth);
    expect(first.status).toBe(500);
    await vi.waitFor(async () => expect(await redis.exists(redisKeyOf(user.id))).toBe(0));

    state.failWith = 0; // the server recovered
    const retry = await send(http, auth);

    expect(retry.status).toBe(201);
    expect(retry.headers['idempotent-replayed']).toBeUndefined(); // processed, not replayed
    expect(state.calls).toBe(2);
  });

  it('expires the stored key after 24 hours, both while processing and once completed', async () => {
    const { state, http } = buildApp();
    state.delayMs = 300;
    const { user, auth } = await createUser();

    const pending = send(http, auth).then((res) => res); // supertest only sends once awaited/then'd
    await vi.waitFor(async () => expect(await redis.exists(redisKeyOf(user.id))).toBe(1));
    expect(await redis.ttl(redisKeyOf(user.id))).toBeGreaterThan(86_000);
    expect(await redis.ttl(redisKeyOf(user.id))).toBeLessThanOrEqual(86_400);

    await pending;
    await waitForCompleted(user.id);
    expect(await redis.ttl(redisKeyOf(user.id))).toBeGreaterThan(86_000);
    expect(await redis.ttl(redisKeyOf(user.id))).toBeLessThanOrEqual(86_400);
  });
});
