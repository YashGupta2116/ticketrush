import { Router } from 'express';
import { route } from '@/lib/route';
import { authenticate, currentUser } from '@/middlewares/auth';
import { holdSeatsSchema } from './holds.schema';
import { holdSeats } from './holds.service';

export const holdsRouter = Router().post(
  '/shows/:id/holds',
  authenticate,
  route(
    holdSeatsSchema,
    ({ params, body }, { req }) => holdSeats(currentUser(req).id, params.id, body.showSeatIds),
    { status: 201 },
  ),
);
