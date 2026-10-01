import { createApp } from '@/app';
import { env } from '@/config/env';
import { handleProcessSignals, onShutdown } from '@/lib/lifecycle';
import { logger } from '@/lib/logger';

const server = createApp().listen(env.PORT, (err) => {
  if (err) throw err;
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

// Registered last → runs first: stop accepting traffic before closing DB/Redis.
onShutdown(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
      setTimeout(() => server.closeAllConnections(), 5_000).unref(); // cut long-lived streams (SSE)
    }),
);

handleProcessSignals();
