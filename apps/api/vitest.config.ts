import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

// Unlike `process.loadEnvFile`, this OVERRIDES variables already set in the shell
// (e.g. a DATABASE_URL exported for another project), so tests never touch the wrong database.
Object.assign(process.env, parseEnv(readFileSync('.env.test', 'utf8')));

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false, // files share one database
    hookTimeout: 30_000,
  },
});
