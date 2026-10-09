import type { Request, Response } from 'express';
import { createRedis, redis } from './redis';

type Listener = (frame: string) => void;

const subscriber = createRedis('subscriber'); // a subscribed connection can't run other commands
const listeners = new Map<string, Set<Listener>>();
subscriber.on('message', (channel: string, frame: string) =>
  listeners.get(channel)?.forEach((listener) => listener(frame)),
);

// Serialize ONCE at publish time; every instance just forwards bytes to N clients.
const frame = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const publish = (channel: string, event: string, data: unknown) =>
  redis.publish(channel, frame(event, data));

const subscribe = async (channel: string, listener: Listener) => {
  let set = listeners.get(channel);
  if (!set) {
    listeners.set(channel, (set = new Set()));
    await subscriber.subscribe(channel);
  }
  set.add(listener);
  return async () => {
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(channel);
      await subscriber.unsubscribe(channel);
    }
  };
};

/** Streams every message on `channel` to this client as Server-Sent Events. */
export const streamChannel = async (
  req: Request,
  res: Response,
  channel: string,
  initial?: { event: string; data: unknown },
) => {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no', // disable proxy buffering (nginx)
  });
  res.flushHeaders(); // open the stream now, not on the first event
  if (initial) res.write(frame(initial.event, initial.data));
  const unsubscribe = await subscribe(channel, (f) => res.write(f));
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000); // keep proxies from timing out
  req.on('close', () => {
    clearInterval(heartbeat);
    void unsubscribe();
  });
};
