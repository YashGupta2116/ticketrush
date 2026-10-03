import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { decodeCursor, paginate, paginationQuery } from '@/lib/pagination';
import { idParams } from '@/lib/schemas';

describe('paginate', () => {
  const rows = [1, 2, 3, 4, 5].map((n) => ({ n }));

  it('returns a cursor for the last item when there is another page', () => {
    const { items, nextCursor } = paginate(rows.slice(0, 3), 2, (last) => ({ n: last.n }));

    expect(items).toEqual([{ n: 1 }, { n: 2 }]);
    expect(decodeCursor(nextCursor!)).toEqual({ n: 2 });
  });

  it('returns no cursor on the last page', () => {
    const { items, nextCursor } = paginate(rows.slice(0, 2), 2, (last) => ({ n: last.n }));

    expect(items).toHaveLength(2);
    expect(nextCursor).toBeNull();
  });

  it('handles an empty result', () => {
    expect(paginate([], 20, () => null)).toEqual({ items: [], nextCursor: null });
  });
});

describe('decodeCursor', () => {
  it('returns undefined when there is no cursor', () => {
    expect(decodeCursor(undefined)).toBeUndefined();
  });

  it('rejects a malformed cursor with a 400', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrow(AppError);
  });
});

describe('paginationQuery', () => {
  it('applies defaults, coerces strings and caps the limit', () => {
    expect(paginationQuery.parse({})).toEqual({ limit: 20 });
    expect(paginationQuery.parse({ limit: '5' }).limit).toBe(5);
    expect(paginationQuery.safeParse({ limit: '1000' }).success).toBe(false);
  });
});

describe('idParams', () => {
  it('accepts only uuids', () => {
    expect(idParams.safeParse({ params: { id: 'nope' } }).success).toBe(false);
    expect(idParams.safeParse({ params: { id: crypto.randomUUID() } }).success).toBe(true);
  });
});
