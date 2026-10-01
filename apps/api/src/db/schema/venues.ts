import { index, integer, pgEnum, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns';

export const venues = pgTable(
  'venues',
  {
    id: id(),
    name: text().notNull(),
    city: text().notNull(),
    address: text(),
    ...timestamps,
  },
  (table) => [index('venues_city_idx').on(table.city)],
);

export const seatTier = pgEnum('seat_tier', ['standard', 'premium', 'vip']);
export type SeatTier = (typeof seatTier.enumValues)[number];

export const seats = pgTable(
  'seats',
  {
    id: id(),
    venueId: uuid()
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),
    section: text().notNull(),
    row: text().notNull(),
    number: integer().notNull(),
    tier: seatTier().notNull(),
  },
  (table) => [unique('uq_seat_position').on(table.venueId, table.section, table.row, table.number)],
);
