# 0005. Payments are confirmed by signed, deduplicated webhooks

- Status: accepted
- Date: 2026-10-10

## Context

A payment provider settles asynchronously and delivers its result by webhook. Webhooks can be
forged, replayed, duplicated, reordered and late, and a success can arrive after the booking
already expired and its seats were resold.

## Decision

- `POST /bookings/:id/pay` returns `202 Accepted`: the outcome is decided later by the webhook. At
  most one `processing` payment exists per booking (partial unique index); a repeat or racing
  request returns the existing one. The provider call happens outside any DB transaction.
- The webhook route is mounted before `express.json()` so the **raw bytes** are available.
  Signature scheme `t=<unix>,v1=hmac_sha256(t.body)`, compared in constant time, 300 s tolerance
  against replay.
- Everything happens in **one transaction**: insert the event id into `processed_webhook_events`
  (`ON CONFLICT DO NOTHING`; no row back means already handled), lock the booking row
  (`FOR UPDATE`), then apply the transition. Dedup and effect commit together or not at all.
- Success on a `pending` booking: payment `succeeded`, booking `confirmed`, seats `reserved → booked`.
  Success on an already expired booking: payment `refund_pending`, seats untouched, booking is
  **never** resurrected. Failure: payment `failed`, booking stays `pending` so the user can retry.
- Unknown payment: respond 404 so the provider retries (its payment row may still be in flight).

## Alternatives considered

- **Confirm from the client redirect:** forgeable and lost when the tab closes.
- **Dedup outside the transaction:** a crash between "marked" and "applied" loses the event forever.
- **Polling the provider:** adds latency and load; a reconciliation job could be added on top.

## Consequences

- The booking row lock serializes the webhook against the expiry job, so "success and expiry in the
  same millisecond" ends in exactly one consistent state (covered by a test).
- Refunds are only flagged (`refund_pending`); issuing them is out of scope.
