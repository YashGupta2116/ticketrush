import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from '@/config/env';
import { errorHandler, notFound } from '@/middlewares/error-handler';
import { byIp, rateLimit } from '@/middlewares/rate-limit';
import { httpLogger } from '@/middlewares/http-logger';
import { healthRouter } from '@/modules/health/health.routes';
import { webhooksRouter } from '@/modules/payments/webhooks.routes';
import { apiRouter } from '@/routes';

export const createApp = () => {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);
  app.use(httpLogger, helmet(), cors({ origin: env.CORS_ORIGINS, credentials: true }));

  // Webhooks need the raw bytes to verify the signature, so they must be mounted BEFORE
  // express.json() (re-serialized JSON would not match byte for byte).
  app.use(
    '/api/v1/webhooks',
    express.raw({ type: 'application/json', limit: '100kb' }),
    webhooksRouter,
  );

  app.use(
    rateLimit({ name: 'global', limit: 300, windowSec: 60, key: byIp }),
    express.json({ limit: '100kb' }),
    cookieParser(),
  );

  app.use('/health', healthRouter);
  app.use('/api/v1', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
