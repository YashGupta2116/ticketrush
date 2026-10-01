import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from '@/config/env';
import { errorHandler, notFound } from '@/middlewares/error-handler';
import { httpLogger } from '@/middlewares/http-logger';
import { healthRouter } from '@/modules/health/health.routes';
import { apiRouter } from '@/routes';

export const createApp = () => {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);
  app.use(
    httpLogger,
    helmet(),
    cors({ origin: env.CORS_ORIGINS, credentials: true }),
    express.json({ limit: '100kb' }),
  );

  app.use('/health', healthRouter);
  app.use('/api/v1', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
