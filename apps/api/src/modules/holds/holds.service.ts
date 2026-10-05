import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { showSeats, shows } from '@/db/schema';
import { env } from '@/config/env';
import { AppError, Errors } from '@/lib/errors';
import { isOnSale } from '@/modules/shows/shows.service';
import { metaKey, seatKey, userKey } from './holds.keys';
import { holdScript, releaseScript } from './holds.scripts';
import { redis } from '@/lib/redis';

const seatsUnavailable = (showSeatIds: string[]) =>
  new AppError(409, 'Some seats are no longer available', 'SEATS_UNAVAILABLE', { showSeatIds });

export const holdSeats = async (userId: string, showId: string, showSeatIds: string[]) => {
  // 1. The show must exist and be on sale.
  const show = await db.query.shows.findFirst({ where: eq(shows.id, showId) });
  if (!show) throw Errors.notFound('Show not found');
  if (!isOnSale({ show })) throw Errors.conflict('This show is not on sale');

  // 2. Cheap pre-check in Postgres: every seat must belong to this show and be available.
  //    (Postgres re-verifies at booking time; this just rejects obvious losers early.)
  const available = await db
    .select({ id: showSeats.id })
    .from(showSeats)
    .where(
      and(
        eq(showSeats.showId, showId),
        inArray(showSeats.id, showSeatIds),
        eq(showSeats.status, 'available'),
      ),
    );
  const availableIds = new Set(available.map((s) => s.id));
  const unavailable = showSeatIds.filter((id) => !availableIds.has(id));
  if (unavailable.length > 0) throw seatsUnavailable(unavailable);

  // 3. The atomic part: hold every seat or none.
  const holdId = randomUUID();
  const expiresAt = new Date(Date.now() + env.HOLD_TTL_SECONDS * 1000);
  const [status, ...takenPositions] = await holdScript(
    [
      userKey(showId, userId),
      metaKey(showId, holdId),
      ...showSeatIds.map((id) => seatKey(showId, id)),
    ],
    [holdId, env.HOLD_TTL_SECONDS * 1000, JSON.stringify({ userId, showSeatIds })],
  );

  if (status === 'user_has_hold') {
    throw new AppError(409, 'You already have an active hold for this show', 'HOLD_EXISTS');
  }
  if (status === 'taken') {
    // The script returns 1-based positions; map them back to the ids the client sent.
    throw seatsUnavailable(takenPositions.map((position) => showSeatIds[position - 1]!));
  }

  return { holdId, showSeatIds, expiresAt };
};

export const releaseHold = async (userId: string, showId: string, holdId: string) => {
  const raw = await redis.get(metaKey(showId, holdId)); // which key stores a hold's meta?
  if (!raw) throw Errors.notFound('Hold not found');

  const meta = JSON.parse(raw) as { userId: string; showSeatIds: string[] };
  if (meta.userId !== userId) throw Errors.notFound('Hold not found');

  await releaseScript(
    [
      userKey(showId, userId),
      metaKey(showId, holdId),
      ...meta.showSeatIds.map((id) => seatKey(showId, id)),
    ],
    [holdId],
  );
};
