import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from '@/config/env';
import { httpLogger } from '@/middlewares/http-logger';

export const createApp = () => {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);
  app.use(
    httpLogger,
    helmet(),
    cors({ origin: env.CORS_ORIGINS, credentials: true }),
    express.json({ limit: '100kb' }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
};
