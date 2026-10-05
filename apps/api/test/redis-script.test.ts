import { describe, expect, it } from 'vitest';
import { redis } from '@/lib/redis';
import { defineScript } from '@/lib/redis-script';

// Sets KEYS[1] to ARGV[1] only if it does not exist yet; returns 1 when it set the key.
const setIfAbsent = defineScript<number>(`
  if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
  redis.call('SET', KEYS[1], ARGV[1])
  return 1
`);

describe('defineScript', () => {
  it('runs the script atomically with keys and args', async () => {
    expect(await setIfAbsent(['k'], ['first'])).toBe(1);
    expect(await setIfAbsent(['k'], ['second'])).toBe(0);
    expect(await redis.get('k')).toBe('first');
  });

  it('falls back to EVAL when Redis has no cached copy (NOSCRIPT)', async () => {
    await setIfAbsent(['warm'], ['x']); // loads the script into Redis' cache
    await redis.script('FLUSH'); // evict it: the next EVALSHA fails with NOSCRIPT

    expect(await setIfAbsent(['after-flush'], ['y'])).toBe(1);
    expect(await redis.get('after-flush')).toBe('y');
  });

  it('rethrows errors that are not NOSCRIPT', async () => {
    const broken = defineScript('return redis.call("NOT_A_COMMAND")');

    await expect(broken([])).rejects.toThrow();
  });
});
