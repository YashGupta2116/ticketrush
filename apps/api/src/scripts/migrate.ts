import { runMigrations } from '@/db/migrate';

await runMigrations(process.env.DATABASE_URL!);
console.log('Migrations applied');
