import { Router } from 'express';
import { route } from '@/lib/route';
import { authenticate, currentUser } from '@/middlewares/auth';
import { holdSeatsSchema, releaseHoldSchema } from './holds.schema';
import { holdSeats, releaseHold } from './holds.service';

export const holdsRouter = Router().post(
  '/shows/:id/holds',
  authenticate,
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
    await releaseHold(currentUser(req).id, params.showId, params.id);
    return null;
  }),
);
