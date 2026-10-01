import { describe, expect, it } from 'vitest';
import { api } from './helpers';

describe('health', () => {
  it('reports liveness', async () => {
    const res = await api.get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
  });

  it('reports readiness of dependencies', async () => {
    const res = await api.get('/health/ready');
    expect(res.body.data).toEqual({ database: 'up', redis: 'up' });
  });

  it('returns the error envelope for unknown routes', async () => {
    const res = await api.get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', requestId: expect.any(String) });
  });
});
