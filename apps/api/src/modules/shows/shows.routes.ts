import { route } from '@/lib/route';
import { authenticate, authorize } from '@/middlewares/auth';
import { Router } from 'express';
import { createShowSchema, listShowsSchema } from './shows.schema';
import { createShow, getShow, listShows } from './shows.service';
import { idParams } from '@/lib/schemas';

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
