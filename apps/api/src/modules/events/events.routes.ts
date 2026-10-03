import { route } from '@/lib/route';
import { authenticate, authorize } from '@/middlewares/auth';
import { Router } from 'express';
import { createEventSchema } from './events.schema';
import { createEvent, getEvent } from './events.service';
import { idParams } from '@/lib/schemas';

export const eventsRouter = Router();

eventsRouter.post(
  '/',
  authenticate,
  authorize('admin'),
  route(createEventSchema, ({ body }) => createEvent(body), { status: 201 }),
);

eventsRouter.get(
  '/:id',
  route(idParams, ({ params }) => getEvent(params.id)),
);
