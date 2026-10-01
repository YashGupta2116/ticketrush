import { sql } from 'drizzle-orm';
import { afterAll, beforeEach } from 'vitest';
import { db } from '@/db';
import { runShutdownTasks } from '@/lib/lifecycle';
import { redis } from '@/lib/redis';

beforeEach(async () => {
  await db.execute(sql`
    DO $$ BEGIN
      EXECUTE (
        SELECT 'TRUNCATE ' || string_agg(format('%I', tablename), ', ') || ' RESTART IDENTITY CASCADE'
        FROM pg_tables WHERE schemaname = 'public'
      );
    END $$;
  `);
  await redis.flushdb();
});

afterAll(runShutdownTasks);
