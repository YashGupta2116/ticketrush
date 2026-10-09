import { redis } from './redis';

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Cache-aside: return cached JSON, or load, store with TTL, and return.
 * Concurrent misses on one key share a single load (single-flight), so a hot key expiring
 * does not send every waiting request to the database at once. Note that cached values come
 * back as JSON: dates are strings.
 */
export const cached = async <T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> => {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit) as T;

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = load()
    .then(async (value) => {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
};
