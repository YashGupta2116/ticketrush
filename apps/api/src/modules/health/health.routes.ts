import { sql } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@/db';
import { AppError } from '@/lib/errors';
import { redis } from '@/lib/redis';
import { route } from '@/lib/route';
import { noInput } from '@/lib/schemas';

const CHECK_TIMEOUT_MS = 2_000;

const checks = {
  database: () => db.execute(sql`select 1`),
  redis: () => redis.ping(),
};

/** ioredis queues commands while reconnecting, so a dead dependency would hang the probe. */
const withTimeout = (promise: PromiseLike<unknown>) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Health check timed out')), CHECK_TIMEOUT_MS).unref(),
    ),
  ]);

const readiness = async () => {
  const report = Object.fromEntries(
    await Promise.all(
      Object.entries(checks).map(async ([name, check]) => [
        name,
        await withTimeout(check()).then(
          () => 'up',
          () => 'down',
        ),
      ]),
    ),
  );
  if (Object.values(report).includes('down')) {
    throw new AppError(503, 'Service not ready', 'NOT_READY', report);
  }
  return report;
};

export const healthRouter = Router()
  .get(
    '/live',
    route(noInput, () => ({ status: 'ok' })),
  )
  .get('/ready', route(noInput, readiness));
