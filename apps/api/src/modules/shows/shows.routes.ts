import { route } from '@/lib/route';
import { authenticate, authorize } from '@/middlewares/auth';
import { Router } from 'express';
import { createShowSchema, listShowsSchema } from './shows.schema';
import { createShow, getSeatMap, getShow, listShows } from './shows.service';
import { idParams } from '@/lib/schemas';
import { streamChannel } from '@/lib/realtime';
import { seatsChannel } from './seat-events';

export const showsRouter = Router();

showsRouter.post(
  '/',
  authenticate,
  authorize('admin'),
  route(createShowSchema, ({ body }) => createShow(body), { status: 201 }),
);

showsRouter.get(
  '/',
  route(listShowsSchema, ({ query }) => listShows(query)),
);

showsRouter.get(
  '/:id',
  route(idParams, ({ params }) => getShow(params.id)),
);

showsRouter.get(
  '/:id/seats',
  route(idParams, ({ params }) => getSeatMap(params.id)),
);

showsRouter.get(
  '/:id/seats/stream',
  route(idParams, ({ params }, { req, res }) => streamChannel(req, res, seatsChannel(params.id))),
);
