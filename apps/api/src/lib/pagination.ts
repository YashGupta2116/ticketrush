import { z } from 'zod';
import { Errors } from './errors';

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

const encodeCursor = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

export const decodeCursor = <T>(cursor?: string): T | undefined => {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString()) as T;
  } catch {
    throw Errors.badRequest('Invalid cursor');
  }
};

/** Decode a cursor and validate its shape; a tampered or foreign cursor is a 400. */
export const parseCursor = <S extends z.ZodType>(schema: S, cursor: string): z.output<S> => {
  const parsed = schema.safeParse(decodeCursor(cursor));
  if (!parsed.success) throw Errors.badRequest('Invalid cursor');
  return parsed.data;
};

/** Query `limit + 1` rows, then pass them here: the extra row tells us if there's a next page. */
export const paginate = <T>(rows: T[], limit: number, toCursor: (last: T) => unknown) => {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? encodeCursor(toCursor(items.at(-1)!)) : null };
};
