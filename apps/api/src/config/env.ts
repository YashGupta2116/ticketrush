import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  HOLD_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  MAX_SEATS_PER_HOLD: z.coerce.number().int().positive().default(6),
  PAYMENT_WINDOW_MINUTES: z.coerce.number().int().positive().default(10),
  BOOKING_LOCK_STRATEGY: z.enum(['conditional', 'pessimistic']).default('conditional'),
  API_URL: z.url().default('http://localhost:4000'),
  PAYMENT_WEBHOOK_SECRET: z.string().min(32),
  MOCK_PAYMENT_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.2),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
  console.error(`Invalid environment variables:\n${issues.join('\n')}`);
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
export const isProd = env.NODE_ENV === 'production';
