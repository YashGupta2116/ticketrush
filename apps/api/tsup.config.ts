import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/worker.ts', 'src/scripts/migrate.ts', 'src/scripts/seed.ts'],
  format: ['esm'],
  target: 'node24',
  sourcemap: true,
  clean: true,
});
