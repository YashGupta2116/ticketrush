import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id } from '../columns';
import { users } from './users';

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull().unique('refresh_tokens_token_hash_unique'),
    familyId: uuid().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('refresh_tokens_family_id_idx').on(table.familyId)],
);
