'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import useSWRInfinite from 'swr/infinite';
import { buttonClass, Eyebrow, Notice, Skeleton, StatusChip } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/format';
import type { BookingSummary, Page } from '@/lib/types';

export default function BookingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/bookings');
  }, [loading, user, router]);

  const { data, error, size, setSize, isLoading, isValidating } = useSWRInfinite<
    Page<BookingSummary>
  >((index, previous: Page<BookingSummary> | null) =>
    !user || (previous && !previous.nextCursor)
      ? null
      : `/bookings?limit=10${previous ? `&cursor=${previous.nextCursor}` : ''}`,
  );
  const bookings = data?.flatMap((page) => page.items) ?? [];

  return (
    <>
      <Eyebrow>Your account</Eyebrow>
      <h1 className="mb-10 font-display text-5xl tracking-tight">My bookings</h1>

      {error && <Notice>Could not load your bookings.</Notice>}
      {(loading || isLoading) && <Skeleton className="h-24" />}
      {!loading && !isLoading && bookings.length === 0 && (
        <p className="text-muted">
          Nothing here yet.{' '}
          <Link href="/" className="text-ink underline underline-offset-4">
            Find a show
          </Link>
        </p>
      )}
      <ul className="divide-y divide-line border-y border-line">
        {bookings.map((b) => (
          <li key={b.id}>
            <Link
              href={`/bookings/${b.id}`}
              className="flex items-center justify-between gap-4 py-5 transition hover:bg-card/60"
            >
              <div>
                <p className="font-display text-xl">{b.eventTitle}</p>
                <p className="text-sm text-muted">
                  {b.venueName} ·{' '}
                  {formatDate(b.startsAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-5">
                <span className="font-mono text-sm">{formatMoney(b.totalCents)}</span>
                <StatusChip status={b.status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {data?.at(-1)?.nextCursor && (
        <div className="mt-8 text-center">
          <button
            className={buttonClass('ghost')}
            disabled={isValidating}
            onClick={() => setSize(size + 1)}
          >
            Load more
          </button>
        </div>
      )}
    </>
  );
}
