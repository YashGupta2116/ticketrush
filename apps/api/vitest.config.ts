import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

// Unlike `process.loadEnvFile`, this OVERRIDES variables already set in the shell
// (e.g. a DATABASE_URL exported for another project), so tests never touch the wrong database.
// BOOKING_LOCK_STRATEGY is the one exception, so both locking strategies can be run against the
// same suite: `BOOKING_LOCK_STRATEGY=pessimistic pnpm --filter api test`.
const strategy = process.env.BOOKING_LOCK_STRATEGY;
Object.assign(process.env, parseEnv(readFileSync('.env.test', 'utf8')));
if (strategy) process.env.BOOKING_LOCK_STRATEGY = strategy;

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false, // files share one database
    hookTimeout: 30_000,
  },
});
