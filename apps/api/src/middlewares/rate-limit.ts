import type { Request, RequestHandler } from 'express';
import { env } from '@/config/env';
import { Errors } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { defineScript } from '@/lib/redis-script';

// Sliding window counter: estimate = previous * (1 - elapsed/window) + current.
// One script so the read and the increment are atomic across API instances.
// KEYS: current window, previous window. ARGV: limit, window ms.
// Returns { allowed, estimatedCount, retryAfterSeconds }.
const script = defineScript<[number, number, number]>(`
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local elapsed = now % window
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local previous = tonumber(redis.call('GET', KEYS[2]) or '0')
local estimate = previous * (1 - elapsed / window) + current
if estimate >= limit then
  return { 0, math.floor(estimate), math.max(1, math.ceil((window - elapsed) / 1000)) }
end
redis.call('INCR', KEYS[1])
redis.call('PEXPIRE', KEYS[1], window * 2)
return { 1, math.floor(estimate) + 1, 0 }
`);

type Options = {
  name: string;
  limit: number;
  windowSec: number;
  key: (req: Request) => string;
  enabled?: boolean;
};

/**
 * Fails OPEN: if Redis is down we let traffic through. Availability of the booking flow matters
 * more than throttling, and Postgres still guarantees correctness without the limiter.
 */
export const rateLimit = ({
  name,
  limit,
  windowSec,
  key,
  enabled = env.RATE_LIMIT_ENABLED,
}: Options): RequestHandler => {
  const windowMs = windowSec * 1000;
  return async (req, res, next) => {
    if (!enabled) return next();

    const bucket = Math.floor(Date.now() / windowMs);
    const base = `ratelimit:${name}:${key(req)}`;
    const result = await script(
      [`${base}:${bucket}`, `${base}:${bucket - 1}`],
      [limit, windowMs],
    ).catch((err) => {
      logger.error({ err, name }, 'Rate limiter unavailable, failing open');
      return null;
    });
    if (!result) return next();

    const [allowed, count, retryAfter] = result;
    res.setHeader('RateLimit-Limit', limit);
    res.setHeader('RateLimit-Remaining', Math.max(0, limit - count));
    if (!allowed) {
      res.setHeader('Retry-After', retryAfter);
      throw Errors.tooManyRequests();
    }
    next();
  };
};

export const byIp = (req: Request) => req.ip ?? 'unknown';
