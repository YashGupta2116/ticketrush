import { Router } from 'express';
import { route } from '@/lib/route';
import { authenticate, currentUser } from '@/middlewares/auth';
import { rateLimit } from '@/middlewares/rate-limit';
import { holdSeatsSchema, releaseHoldSchema } from './holds.schema';
import { holdSeats, cancelHold } from './holds.service';

export const holdsRouter = Router();

holdsRouter.post(
  '/shows/:id/holds',
  authenticate,
  rateLimit({ name: 'holds', limit: 10, windowSec: 60, key: (req) => currentUser(req).id }),
  route(
    holdSeatsSchema,
    ({ params, body }, { req }) => holdSeats(currentUser(req).id, params.id, body.showSeatIds),
    { status: 201 },
  ),
);

holdsRouter.delete(
  '/shows/:showId/holds/:id',
  authenticate,
  route(releaseHoldSchema, async ({ params }, { req }) => {
    await cancelHold(currentUser(req).id, params.showId, params.id);
    return null;
  }),
);
