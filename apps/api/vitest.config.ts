import { defineConfig } from 'vitest/config';

process.loadEnvFile('.env.test');

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false, // files share one database
    hookTimeout: 30_000,
  },
});
