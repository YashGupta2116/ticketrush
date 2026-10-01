import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { id, timestamps } from '../columns';
import { events } from './events';
import { seats, venues, type SeatTier } from './venues';

export const showStatus = pgEnum('show_status', ['scheduled', 'cancelled']);

export const shows = pgTable(
  'shows',
  {
    id: id(),
    eventId: uuid()
      .notNull()
      .references(() => events.id),
    venueId: uuid()
      .notNull()
      .references(() => venues.id),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    salesOpenAt: timestamp({ withTimezone: true }).notNull(),
    status: showStatus().notNull().default('scheduled'),
    isHighDemand: boolean().notNull().default(false),
    pricing: jsonb().$type<Record<SeatTier, number>>().notNull(),
    ...timestamps,
  },
  (table) => [index('shows_starts_at_id_idx').on(table.startsAt, table.id)],
);

export const showSeatStatus = pgEnum('show_seat_status', ['available', 'reserved', 'booked']);

export const showSeats = pgTable(
  'show_seats',
  {
    id: id(),
    showId: uuid()
      .notNull()
      .references(() => shows.id, { onDelete: 'cascade' }),
    seatId: uuid()
      .notNull()
      .references(() => seats.id),
    priceCents: integer().notNull(),
    status: showSeatStatus().notNull().default('available'),
    bookingId: uuid(), //TODO: FK to bookings added in step 3.2
    version: integer().notNull().default(0),
  },
  (table) => [
    unique('uq_show_seat').on(table.showId, table.seatId),
    index('show_seats_show_id_status_idx').on(table.showId, table.status),
    check('ck_show_seats_price', sql`${table.priceCents} >= 0`),
  ],
);
