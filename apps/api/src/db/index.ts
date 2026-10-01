import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '@/config/env';
import { onShutdown } from '@/lib/lifecycle';
import { logger } from '@/lib/logger';
import * as schema from './schema';

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: env.DB_POOL_MAX });
pool.on('error', (err) => logger.error({ err }, 'Postgres pool error'));
onShutdown(() => pool.end());

export const db = drizzle({ client: pool, schema, casing: 'snake_case' });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Accept either so a function works standalone or inside a caller's transaction. */
export type Executor = Db | Tx;
