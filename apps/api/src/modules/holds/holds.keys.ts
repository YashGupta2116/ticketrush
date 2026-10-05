// The `{showId}` braces are a Redis Cluster hash tag: every key of one show hashes to the same
// slot, so multi-key scripts stay legal if Redis is ever sharded.
export const seatKey = (showId: string, showSeatId: string) =>
  `hold:{${showId}}:seat:${showSeatId}`;
export const metaKey = (showId: string, holdId: string) => `hold:{${showId}}:meta:${holdId}`;
export const userKey = (showId: string, userId: string) => `hold:{${showId}}:user:${userId}`;
