import { createHash } from 'node:crypto';
import { redis } from './redis';

/** Defines a Lua script once; calls use EVALSHA and fall back to EVAL if Redis hasn't cached it. */
export const defineScript = <T = unknown>(lua: string) => {
  const sha = createHash('sha1').update(lua).digest('hex');
  return async (keys: string[], args: (string | number)[] = []): Promise<T> => {
    try {
      return (await redis.evalsha(sha, keys.length, ...keys, ...args)) as T;
    } catch (err) {
      if (!(err instanceof Error) || !err.message.startsWith('NOSCRIPT')) throw err;
      return (await redis.eval(lua, keys.length, ...keys, ...args)) as T;
    }
  };
};
