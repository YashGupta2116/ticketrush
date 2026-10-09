# 0004. Seat reservation uses a conditional UPDATE (pessimistic locking available)

- Status: accepted
- Date: 2026-10-09

## Context

Converting a hold into a booking must never reserve a seat that someone else already reserved or
bought, even when many transactions race for the same `show_seats` rows. Redis holds
([ADR 0002](0002-seat-holds-in-redis.md)) absorb most of the stampede, but Redis can lose data or
expire a hold early, so **Postgres must be able to refuse a double booking on its own**.

## Decision

- Default (`BOOKING_LOCK_STRATEGY=conditional`): one statement,
  `UPDATE show_seats SET status = 'reserved', … WHERE show_id = $1 AND id IN (…) AND status = 'available' RETURNING …`.
  If fewer rows come back than seats requested, the transaction throws `409 SEATS_UNAVAILABLE` and
  rolls back, so nothing is persisted (no booking row, no partially reserved seats).
- Alternative (`BOOKING_LOCK_STRATEGY=pessimistic`): `SELECT … WHERE id IN (…) ORDER BY id FOR UPDATE`,
  check every row is `available` in TypeScript, then a plain `UPDATE`. Both strategies live behind
  one function signature (`reserve`) in `bookings.service.ts` and run the same test suite
  (`BOOKING_LOCK_STRATEGY=pessimistic pnpm --filter api test`).
- `ORDER BY id` gives every transaction the same lock order. Without it, T1 locking A then B while
  T2 locks B then A deadlocks, and Postgres aborts one of them.
- The booking request body is `{ showId, holdId }`, not the roadmap's `{ holdId }`: the hold's Redis
  keys contain the show id (the cluster hash tag), so a `holdId` alone cannot locate its metadata.

## Alternatives considered

- **`SELECT … FOR UPDATE` (pessimistic):** correct, and makes the check explicit in application
  code. Costs an extra round trip, and holds row locks while the application runs, so concurrent
  requests for the same seats queue up behind each other instead of failing fast.
- **`NOWAIT` / `SKIP LOCKED`:** `NOWAIT` turns contention into errors we would have to retry;
  `SKIP LOCKED` silently drops contended seats, which would return a smaller booking than the user
  asked for. We need "all requested seats or nothing", which neither gives.
- **Optimistic locking with the `version` column:** read the rows, then
  `UPDATE … WHERE version = $read`. Correct, but needs a retry loop under contention, and for
  one-shot "available → reserved" the `status = 'available'` condition already carries the same
  information. `version` is still incremented for future use (audit, cache validation).
- **Redis-only locking:** fastest, but not durable. A Redis failover or flush would allow double
  sales, and the whole point is zero double bookings.

## Consequences

- The conditional UPDATE is the default: a single statement, no application-level lock window, and
  contention fails fast with a clear 409. Row locks are held only until commit.
- The pessimistic variant is kept for comparison; Phase 13 benchmarks both under a stampede.
- Known gap: `createBooking` does not re-check that the show is still `scheduled` and on sale at
  booking time, so a show cancelled after the hold was taken can still be booked. To be addressed
  with the show-cancellation flow.
- Redis hold release happens after commit and is best effort; a failed release only leaves a hold
  that expires by TTL, and seats are protected by Postgres either way.
