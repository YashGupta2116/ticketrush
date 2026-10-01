import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns';
import { users } from './users';
import { shows, showSeats } from './shows';

export const bookingStatus = pgEnum('booking_status', [
  'pending',
  'confirmed',
  'expired',
  'cancelled',
]);

export const bookings = pgTable(
  'bookings',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    showId: uuid()
      .notNull()
      .references(() => shows.id),
    status: bookingStatus().notNull().default('pending'),
    totalCents: integer().notNull(),
    currency: text().notNull().default('INR'),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    index('bookings_status_expires_at_idx').on(table.status, table.expiresAt),
    index('bookings_user_id_idx').on(table.userId),
  ],
);

export const bookingItems = pgTable(
  'booking_items',
  {
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    showSeatId: uuid()
      .notNull()
      .references(() => showSeats.id),
    priceCents: integer().notNull(),
  },
  (table) => [primaryKey({ columns: [table.bookingId, table.showSeatId] })],
);
