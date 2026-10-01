import { runMigrations } from '../src/db/migrate';

export default () => runMigrations(process.env.DATABASE_URL!);
