import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

createApp().listen(env.PORT, () => logger.info(`API listening on http://localhost:${env.PORT}`));
