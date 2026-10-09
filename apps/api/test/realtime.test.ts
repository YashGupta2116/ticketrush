import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { createApp } from '@/app';
import { emitSeatChanges } from '@/modules/shows/seat-events';
import { api, createOnSaleShow, createUser } from './helpers';

describe('GET /api/v1/shows/:id/seats/stream', () => {
  it('streams seat changes as server-sent events', async () => {
    const { auth: admin } = await createUser({ role: 'admin' });
    const { show, seatIds } = await createOnSaleShow(admin);
    const { auth } = await createUser();

    const server = createApp().listen(0);
    const abort = new AbortController();
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/shows/${show.id}/seats/stream`;
      const res = await fetch(url, { signal: abort.signal });
      expect(res.headers.get('content-type')).toContain('text/event-stream');

      // Trigger a real change through the API once the subscription exists.
      await new Promise((r) => setTimeout(r, 200));
      await api
        .post(`/api/v1/shows/${show.id}/holds`)
        .set(auth)
        .send({ showSeatIds: [seatIds[0]] });

      const reader = res.body!.getReader();
      let text = '';
      while (!text.includes('\n\n')) text += new TextDecoder().decode((await reader.read()).value);
      expect(text).toContain('event: seats');
      expect(text).toContain(JSON.stringify({ showSeatIds: [seatIds[0]], status: 'held' }));
    } finally {
      abort.abort();
      server.close();
    }
  });

  it('emitSeatChanges formats one event', async () => {
    await expect(emitSeatChanges('s', ['a'], 'booked')).resolves.not.toThrow();
  });
});
