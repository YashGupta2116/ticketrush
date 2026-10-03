import { route } from '@/lib/route';
import { authenticate, authorize } from '@/middlewares/auth';
import { Router } from 'express';
import { createShowSchema } from './shows.schema';
import { createShow } from './shows.service';

export const showsRouter = Router();

showsRouter.post(
  '/',
  authenticate,
  authorize('admin'),
  route(createShowSchema, ({ body }) => createShow(body), { status: 201 }),
);
