import express from 'express';
import { httpLogger } from '@/middlewares/http-logger';

export const createApp = () => {
  const app = express();

  app.use(httpLogger);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
};
