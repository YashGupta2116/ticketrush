import { Router } from 'express';
import { route } from '@/lib/route';
import { authenticate, currentUser } from '@/middlewares/auth';
import { idempotent } from '@/middlewares/idempotency';
import { createBookingSchema, listBookingsSchema } from './bookings.schema';
import { createBooking, getMyBooking, listMyBookings } from './bookings.service';
import { idParams } from '@/lib/schemas';
import { startPayment } from '../payments/payments.service';

export const bookingsRouter = Router();

bookingsRouter.post(
  '/',
  authenticate,
  idempotent(),
  route(
    createBookingSchema,
    ({ body }, { req }) => createBooking(currentUser(req).id, body.showId, body.holdId),
    { status: 201 },
  ),
);

bookingsRouter.get(
  '/',
  authenticate,
  route(listBookingsSchema, ({ query }, { req }) => listMyBookings(currentUser(req).id, query)),
);

bookingsRouter.get(
  '/:id',
  authenticate,
  route(idParams, ({ params }, { req }) => getMyBooking(currentUser(req).id, params.id)),
);

bookingsRouter.post(
  '/:id/pay',
  authenticate,
  idempotent(),
  route(idParams, ({ params }, { req }) => startPayment(currentUser(req).id, params.id), {
    status: 202,
  }),
);
