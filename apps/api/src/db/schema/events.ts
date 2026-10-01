import { check, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns';
import { sql } from 'drizzle-orm';

export const events = pgTable(
  'events',
  {
    id: id(),
    title: text().notNull(),
    description: text().notNull(),
    durationMinutes: integer().notNull(),
    ...timestamps,
  },
  (table) => [check('ck_events_duration', sql`${table.durationMinutes} > 0`)],
);
