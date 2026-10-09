import { Router } from 'express';
import { route } from '@/lib/route';
import { noInput } from '@/lib/schemas';
import { handlePaymentWebhook } from './payments.service';

export const webhooksRouter = Router().post(
  '/payments',
  route(noInput, (_input, { req }) =>
    handlePaymentWebhook(req.body as Buffer, req.header('x-signature')),
  ),
);
