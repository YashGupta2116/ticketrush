import { Router } from 'express';
import { route } from '@/lib/route';
import { authenticate, authorize } from '@/middlewares/auth';
import { createVenueSchema } from './venues.schema';
import { createVenue, getVenue } from './venues.service';
import { idParams } from '@/lib/schemas';

export const venuesRouter = Router();

venuesRouter.post(
  '/',
  authenticate,
  authorize('admin'),
  route(createVenueSchema, ({ body }) => createVenue(body), { status: 201 }),
);

venuesRouter.get(
  '/:id',
  route(idParams, ({ params }) => getVenue(params.id)),
);
