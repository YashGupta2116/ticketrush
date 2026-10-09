# 0007. Live seat map uses Server-Sent Events over Redis pub/sub

- Status: accepted
- Date: 2026-10-10

## Context

Everyone viewing a show should see seats change instantly, across several API instances.

## Decision

- Every state change calls one function, `emitSeatChanges`, **after** the transaction commits. It
  publishes one pre-serialized frame to the Redis channel `show:<id>:seats`; each API instance
  forwards the bytes to its connected clients.
- Clients use `EventSource` (SSE): updates flow one way, it is plain HTTP, reconnects natively and
  passes through proxies. WebSockets would add a protocol and sticky-session concerns for nothing.
- Holds that expire by Redis TTL emit **nothing**. Chosen: eventual consistency. The client
  refetches the seat map on reconnect and every 15 s, so a freed seat shows up within seconds.
  Keyspace notifications were rejected as lossy and operationally fragile.

## Consequences

- Events are hints; Postgres and the seat-map endpoint stay the truth. A missed event heals itself
  on the next refetch.
- Heartbeats every 25 s keep idle connections alive.
