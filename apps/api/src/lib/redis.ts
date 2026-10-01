import { Redis, type RedisOptions } from 'ioredis';
import { env } from '@/config/env';
import { onShutdown } from './lifecycle';
import { logger } from './logger';

export const createRedis = (name: string, options: RedisOptions = {}) => {
  const client = new Redis(env.REDIS_URL, { connectionName: name, ...options });
  client.on('error', (err) => logger.error({ err, name }, 'Redis error'));
  onShutdown(() => client.quit());
  return client;
};

export const redis = createRedis('main');
