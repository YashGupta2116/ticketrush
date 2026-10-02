# 0001. Refresh token rotation with reuse detection

- Status: accepted
- Date: 2026-10-02

## Context

Access tokens are short-lived JWTs (15 minutes) and cannot be revoked. Users should stay signed in
for days and be able to log out for real. A stolen long-lived token must not give an attacker a
quiet, lasting session.

## Decision

- Access token: stateless HS256 JWT in the response body. Refresh token: random 256-bit value in an
  `httpOnly`, `sameSite=strict` cookie scoped to `/api/v1/auth`.
- Only `sha256(token)` is stored (`refresh_tokens.token_hash`). The tokens are high-entropy, so a
  fast hash is sufficient and a database leak does not leak live sessions.
- Every login creates a new **family** (`family_id`). Each refresh **rotates**: the presented token
  is revoked and a new one is issued in the same family.
- Presenting an already-revoked token is treated as theft: the **whole family is revoked**, which
  logs out both the attacker and the legitimate user.
- Rotation is claimed atomically with `UPDATE ... WHERE id = $1 AND revoked_at IS NULL RETURNING`.
  Only the request that gets a row back proceeds, so concurrent refreshes cannot both succeed.
  The loser is treated as reuse.
- Logout revokes the family and is idempotent.

## Alternatives considered

- **Stateless long-lived refresh JWT:** cannot be revoked and has no reuse detection.
- **Server-side sessions only:** a database lookup on every request, which defeats the cheap
  access-token path.
- **Grace window for the race loser:** a short window where a just-rotated token is still accepted
  would avoid logging users out when two tabs refresh simultaneously. Not implemented yet.

## Consequences

- Two tabs refreshing at the same instant can log the user out (the race loser triggers reuse
  handling). A grace window is the planned mitigation if this proves annoying.
- Refresh tokens are persisted, so expired and revoked rows need periodic cleanup.
- The `family_id` index keeps family revocation cheap.
