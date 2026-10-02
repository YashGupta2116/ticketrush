import { runMigrations } from '../src/db/migrate';

export default () => {
  const url = process.env.DATABASE_URL!;
  // The suite truncates every table, so refuse to run against anything but a *_test database.
  if (!new URL(url).pathname.endsWith('_test')) {
    throw new Error('Refusing to run tests: DATABASE_URL must point to a database ending in _test');
  }
  return runMigrations(url);
};
