# 0006. Unpaid bookings expire via delayed jobs plus a reconciliation sweeper

- Status: accepted
- Date: 2026-10-10

## Context

A pending booking reserves seats for `PAYMENT_WINDOW_MINUTES`. Abandoned checkouts must give the
seats back at the right time, even if processes crash.

## Decision

- After a booking commits, a BullMQ job `expire-<bookingId>` is enqueued with a delay equal to the
  time left (`jobId` makes enqueueing idempotent). A separate **worker process** runs it.
- `expireBooking` locks the booking, no-ops unless it is `pending`, then sets `expired` and moves
  seats `reserved → available`. Jobs are delivered at least once, so it must be idempotent.
- A payment still `processing` at expiry does not delay expiry: a late success becomes
  `refund_pending` (ADR 0005). Simple and safe beats a grace-period state.
- **Dual-write problem:** a crash between "commit booking" and "enqueue job" would lock seats
  forever. A repeatable job (`upsertJobScheduler`, every 60 s) runs `reconcileExpiredBookings`,
  which expires up to 100 pending bookings more than 30 s past their deadline.

## Alternatives considered

- **Transactional outbox:** the textbook fix for dual writes; more moving parts. The sweeper gives
  the same guarantee with a single query on the `(status, expires_at)` index.
- **Redis key expiry events:** best effort and lost on restart.
- **Cron in the API process:** couples scaling of API and background work.

## Consequences

- Worst-case seat release delay is about 90 s after the deadline if the delayed job was lost.
- API and workers scale independently.
