import { Router } from 'express';
import { route } from '@/lib/route';
import { noInput } from '@/lib/schemas';

export const healthRouter = Router().get(
  '/live',
  route(noInput, () => ({ status: 'ok' })),
);
