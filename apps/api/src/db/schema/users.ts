import { pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns';

export const userRole = pgEnum('user_role', ['user', 'admin']);
export type Role = (typeof userRole.enumValues)[number];

export const users = pgTable('users', {
  id: id(),
  email: text().notNull().unique(),
  name: text().notNull(),
  passwordHash: text().notNull(),
  role: userRole().notNull().default('user'),
  ...timestamps,
});
