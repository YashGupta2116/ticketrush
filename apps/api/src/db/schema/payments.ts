import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns';
import { bookings } from './bookings';
import { sql } from 'drizzle-orm';

export const paymentStatus = pgEnum('payment_status', [
  'processing',
  'succeeded',
  'failed',
  'refund_pending',
]);

export const payments = pgTable(
  'payments',
  {
    id: id(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id),
    providerIntentId: text().notNull().unique('payments_provider_intent_id_unique'),
    amountCents: integer().notNull(),
    status: paymentStatus().notNull().default('processing'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('bookings_id_status_not_failed_idx')
      .on(table.bookingId)
      .where(sql`${table.status} <> 'failed'`),
  ],
);

export const processedWebhookEvents = pgTable('processed_webhook_events', {
  id: text().primaryKey(),
  receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
