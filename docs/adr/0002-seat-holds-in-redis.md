# 0002. Seat holds live in Redis, claimed by an atomic Lua script

- Status: accepted
- Date: 2026-10-05

## Context

In a flash sale, thousands of users request the same seats within the same second. Exactly one
must win each seat, and a multi-seat selection must be all-or-nothing (never A1 and A2 held while
A3 belongs to someone else). Abandoned selections must free themselves.

## Decision

- A **hold** is a temporary claim stored in Redis with a TTL (`HOLD_TTL_SECONDS`, default 5 min).
  Postgres stays the source of truth; holds are the fast lane that absorbs the stampede.
- Keys (the `{showId}` is a Redis Cluster hash tag, so all keys of one show share a slot and
  multi-key scripts stay legal if Redis is ever sharded):
  - `hold:{show}:seat:<showSeatId>` → `holdId` (one per seat)
  - `hold:{show}:meta:<holdId>` → JSON `{ userId, showSeatIds }`
  - `hold:{show}:user:<userId>` → `holdId`
- A **Lua script** claims the seats: pass 1 checks every seat key, pass 2 sets them all. Redis runs
  a script as one uninterruptible unit, so no other request can interleave between check and set.
- Before the script, the service does a cheap Postgres pre-check (seats belong to this show and are
  `available`) and verifies the show is on sale. Postgres re-verifies when the booking is created.
- **One active hold per user per show; a second request is rejected** (`409 HOLD_EXISTS`) rather
  than replacing the first. Replacing would mean releasing the old seats inside the same script;
  rejecting is simpler and safe, and the user can release explicitly (step 6.3) and hold again.

## Alternatives considered

- **Holds as rows in Postgres:** every click becomes a write plus row locks on the hottest rows in
  the system, which is exactly the contention we want to keep away from the database.
- **Redis `MULTI/EXEC`:** a transaction cannot branch on data it reads ("abort if any key exists"),
  so it needs `WATCH` plus retry loops under contention. Lua reads, decides and writes in one step.
- **One lock per seat acquired in a loop:** not atomic across seats, so a partial failure leaves
  seats held and needs compensating releases.

## Consequences

- Redis is on the critical path for holds. If it loses data, holds are lost, but no booking is
  corrupted, because Postgres' conditional update is the final arbiter.
- Expiry is free (TTL), with no sweeper needed for holds themselves.
- The pre-check and the script are not one transaction: a seat can be sold between them. That is
  acceptable because Postgres re-verifies at booking time.
- A user who wants different seats must release their current hold first.
