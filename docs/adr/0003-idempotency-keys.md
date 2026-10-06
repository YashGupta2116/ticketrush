# 0003. Idempotency keys for unsafe requests

- Status: accepted
- Date: 2026-10-06

## Context

Clients retry: a user double-clicks "Pay", a mobile network drops the response, a proxy times out.
For `POST /bookings` and `POST /bookings/:id/pay` a retry must never create a second booking or a
second charge. The same request can also arrive twice at the same instant, on different API
instances.

## Decision

An `idempotent()` middleware (mounted after `authenticate`) implements the `Idempotency-Key`
header pattern used by Stripe:

- The key is required (8 to 255 characters) and is **scoped per user**: `idem:<userId>:<key>`, so
  two users can never collide and one user can never replay another's response.
- The request **fingerprint** is `sha256(method + url + body)`. Reusing a key with a different
  request is a client bug and is rejected (`422 IDEMPOTENCY_KEY_REUSED`), checked before the
  in-progress state so a different payload never gets a misleading "wait" answer.
- The key is **claimed atomically** with `SET key {state:'processing', fingerprint} NX EX 86400`.
  Exactly one of any number of simultaneous requests wins the claim and runs the handler; the
  others see `processing` and get `409 REQUEST_IN_PROGRESS`.
- The first request's response is captured by wrapping `res.json` and stored on `finish` as
  `{state:'completed', status, body}`. Later requests replay the exact status and body with
  `Idempotent-Replayed: true`, and never call the handler.
- A **5xx** deletes the key: the server failed, not the client, so a retry must run again. 4xx
  responses (for example `409 SEATS_UNAVAILABLE`) are stored and replayed: they are valid answers
  to that request.
- Keys live for 24 hours (`EX 86400`).

## Alternatives considered

- **Check then set (`GET`, then `SET`):** two simultaneous requests can both see "no key" and both
  run the handler. `SET NX` makes check and claim one atomic step.
- **A unique constraint in Postgres:** works for one table, but the key must cover any endpoint and
  must also return the original response body, not just prevent the duplicate.
- **Deduplicate on request content only (no client key):** two legitimately identical purchases
  (same user, same seats, minutes apart) would be confused with a retry.

## Consequences

- If the process crashes after claiming but before responding, the key stays `processing` for up
  to 24 hours and retries get `409 REQUEST_IN_PROGRESS`. A shorter TTL for the `processing` state
  (or a heartbeat) would bound this. Not implemented yet.
- The response is stored just after it is sent. A client that retries within that window sees
  `409 REQUEST_IN_PROGRESS` and can simply retry again; it never causes duplicate work.
- Redis is a new dependency of the write path. If Redis is down, idempotent endpoints fail rather
  than risk a duplicate charge.
- Idempotency stops duplicate _requests_. Correctness of the booking itself still rests on
  Postgres' conditional update (step 7.2), which holds even if this layer is bypassed.
