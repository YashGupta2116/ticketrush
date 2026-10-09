import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '@/middlewares/error-handler';
import { byIp, rateLimit } from '@/middlewares/rate-limit';

const appWith = (limit: number, windowSec = 60) =>
  request(
    express()
      .use(rateLimit({ name: 'test', limit, windowSec, key: byIp, enabled: true }))
      .get('/', (_req, res) => void res.json({ ok: true }))
      .use(errorHandler),
  );

describe('rateLimit()', () => {
  it('allows `limit` requests then answers 429 with Retry-After', async () => {
    const http = appWith(5);
    for (let i = 0; i < 5; i++) {
      const ok = await http.get('/');
      expect(ok.status).toBe(200);
      expect(ok.headers['ratelimit-remaining']).toBe(String(4 - i));
    }
    const blocked = await http.get('/');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('never lets concurrent requests exceed the limit', async () => {
    const http = appWith(10);
    const results = await Promise.all(Array.from({ length: 40 }, () => http.get('/')));
    expect(results.filter((r) => r.status === 200)).toHaveLength(10);
  });

  it('does nothing when disabled', async () => {
    const http = request(
      express()
        .use(rateLimit({ name: 'off', limit: 1, windowSec: 60, key: byIp, enabled: false }))
        .get('/', (_req, res) => void res.json({ ok: true })),
    );
    for (let i = 0; i < 3; i++) expect((await http.get('/')).status).toBe(200);
  });
});
