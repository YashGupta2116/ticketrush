# TicketRush

Flash-sale ticket booking with **zero double bookings under concurrency**.

> **Redis is the fast lane, Postgres is the truth.** A Redis Lua script absorbs the stampede by
> claiming seats atomically; a conditional `UPDATE … WHERE status = 'available'` in Postgres makes
> double booking impossible even if Redis lies.

## How a booking flows

```
select seats ─▶ HOLD (Redis Lua, all-or-nothing, 5 min TTL)
             ─▶ BOOK (Postgres tx: conditional UPDATE reserves seats, Idempotency-Key)
             ─▶ PAY  (202, mock PSP settles asynchronously)
             ─▶ signed webhook ─▶ confirmed (seats booked) | failed (retry) | refund_pending
unpaid ─▶ BullMQ delayed job expires the booking; a sweeper catches lost jobs
```

Seat changes are pushed to every viewer over Server-Sent Events (Redis pub/sub across instances).

## Stack

Express 5 · Zod 4 · Postgres 17 + Drizzle · Redis 7 (ioredis) · BullMQ · JWT + rotating refresh
tokens · pino · Vitest + Supertest (real Postgres/Redis) · Next.js 16 + Tailwind 4 + SWR

## Run it

```bash
pnpm install
pnpm infra:up                         # Postgres + Redis (docker compose)
pnpm --filter api db:migrate && pnpm --filter api db:seed
pnpm dev:api                          # http://localhost:4000
pnpm dev:worker                       # expiry + reconciliation jobs
pnpm dev:web                          # http://localhost:3000
pnpm test                             # 190 integration tests
```

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`
(set `JWT_ACCESS_SECRET` and `PAYMENT_WEBHOOK_SECRET` to random 32+ character strings). The mock
payment provider fails 20% of payments on purpose (`MOCK_PAYMENT_FAILURE_RATE`) to exercise retries.

## Design decisions (see `docs/adr/`)

| ADR  | Decision                                                                                    |
| ---- | ------------------------------------------------------------------------------------------- |
| 0001 | Refresh-token rotation with reuse detection (token families)                                |
| 0002 | Seat holds in Redis, claimed by one atomic Lua script                                       |
| 0003 | Idempotency keys for unsafe requests                                                        |
| 0004 | Conditional UPDATE by default; pessimistic `FOR UPDATE` available (`BOOKING_LOCK_STRATEGY`) |
| 0005 | Webhook-driven payment confirmation: signed, deduplicated in-transaction, row-locked        |
| 0006 | Booking expiry via delayed jobs plus a reconciliation sweeper (the dual-write problem)      |
| 0007 | SSE over WebSockets for the live seat map                                                   |

## What the tests prove

- 50 users racing for one seat: exactly one winner. Overlapping multi-seat holds are all-or-nothing.
- A forced Postgres conflict rolls the whole booking back (no booking row, no half-reserved seats).
- Same event delivered twice is processed once; a bad signature or stale timestamp is rejected.
- Payment success racing booking expiry always ends in one consistent state.
- Payment arriving after expiry becomes `refund_pending`; the booking is never resurrected.
- The rate limiter never lets concurrent requests exceed the limit.

## Not built (deliberate)

Virtual waiting room, Prometheus metrics, k6 load tests with published numbers, Docker images and
CI. Known gaps: refunds are only flagged (`refund_pending`), a show cancelled after a hold can
still be booked, and expired holds free their seats on the next map refresh (≤15 s) rather than
instantly. No admin UI; use the API or the seed script.
