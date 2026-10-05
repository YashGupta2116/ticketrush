import { defineScript } from '@/lib/redis-script';

/**
 * Holds every seat or none, atomically (Redis runs a script as one uninterruptible unit).
 *
 * KEYS[1] = user key, KEYS[2] = meta key, KEYS[3..n] = seat keys
 * ARGV[1] = holdId, ARGV[2] = ttl in ms, ARGV[3] = meta JSON
 *
 * Returns { 'ok' } | { 'user_has_hold' } | { 'taken', <1-based seat positions>... }
 */
export const holdScript = defineScript<[string, ...number[]]>(`
  -- one active hold per user per show
  if redis.call('EXISTS', KEYS[1]) == 1 then
    return { 'user_has_hold' }
  end

  -- pass 1: only look. If any seat is taken, report which ones and write nothing.
  local taken = {}
  for i = 3, #KEYS do
    if redis.call('EXISTS', KEYS[i]) == 1 then
      table.insert(taken, i - 2)
    end
  end
  if #taken > 0 then
    table.insert(taken, 1, 'taken')
    return taken
  end

  -- pass 2: everything is free, so take it all
  for i = 3, #KEYS do
    redis.call('SET', KEYS[i], ARGV[1], 'PX', ARGV[2])
  end
  redis.call('SET', KEYS[2], ARGV[3], 'PX', ARGV[2])
  redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
  return { 'ok' }
`);

/**
 * KEYS[1] = user key, KEYS[2] = meta key, KEYS[3..n] = seat keys
 * ARGV[1] = holdId
 * Returns how many seat keys were released.
 */
export const releaseScript = defineScript<number>(`
  local released = 0
  for i = 3, #KEYS do
    if redis.call('GET', KEYS[i]) == ARGV[1] then     -- still MY hold?
      redis.call('DEL', KEYS[i])
      released = released + 1
    end
  end
  redis.call('DEL', KEYS[2])                        -- the meta key
  if redis.call('GET', KEYS[1]) == ARGV[1] then     -- the user key, only if it is still mine
    redis.call('DEL', KEYS[1])
  end
  return released
`);
