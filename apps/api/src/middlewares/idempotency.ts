import type { RequestHandler } from 'express';
import { AppError, Errors } from '@/lib/errors';
import { sha256 } from '@/lib/crypto';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

export const idempotent = (): RequestHandler => async (req, res, next) => {
  const key = req.header('Idempotency-Key');
  if (!key || key.length < 8 || key.length > 255) {
    throw Errors.badRequest('A valid Idempotency-Key header is required');
  }

  const redisKey = `idem:${req.user!.id}:${key}`;

  const fingerprint = sha256(req.method + req.originalUrl + JSON.stringify(req.body));

  const claimed = await redis.set(
    redisKey,
    JSON.stringify({ state: 'processing', fingerprint }),
    'EX',
    86_400,
    'NX',
  );

  if (claimed) {
    let captured: unknown;
    const json = res.json.bind(res);
    res.json = (body) => {
      captured = body;
      return json(body);
    };

    res.on('finish', () => {
      const done =
        res.statusCode >= 500
          ? redis.del(redisKey)
          : redis.set(
              redisKey,
              JSON.stringify({
                state: 'completed',
                fingerprint,
                status: res.statusCode,
                body: captured,
              }),
              'EX',
              86_400,
            );
      done.catch((err) => logger.error({ err }, 'Failed to store idempotent response'));
    });
    return next();
  }

  const raw = await redis.get(redisKey);
  const stored = JSON.parse(raw!) as {
    state: 'processing' | 'completed';
    fingerprint: string;
    status?: number;
    body?: unknown;
  };

  if (stored.fingerprint !== fingerprint) {
    throw new AppError(
      422,
      'Idempotency-Key was already used with a different request',
      'IDEMPOTENCY_KEY_REUSED',
    );
  }

  if (stored.state === 'processing') {
    throw new AppError(
      409,
      'A request with this Idempotency-Key is still in progress',
      'REQUEST_IN_PROGRESS',
    );
  }

  res.set('Idempotent-Replayed', 'true').status(stored.status!).json(stored.body);
  return;
};
