'use client';

import useSWRInfinite from 'swr/infinite';
import { ShowCard } from '@/components/show-card';
import { buttonClass, Eyebrow, Notice, Skeleton } from '@/components/ui';
import type { Page, ShowSummary } from '@/lib/types';

export default function HomePage() {
  const { data, error, size, setSize, isLoading, isValidating } = useSWRInfinite<Page<ShowSummary>>(
    (index, previous: Page<ShowSummary> | null) =>
      previous && !previous.nextCursor
        ? null
        : `/shows?limit=12${previous ? `&cursor=${previous.nextCursor}` : ''}`,
  );
  const shows = data?.flatMap((page) => page.items) ?? [];
  const hasMore = data?.at(-1)?.nextCursor;

  return (
    <>
      <section className="mb-12 grid gap-6 border-b border-line pb-10 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <Eyebrow>Live events</Eyebrow>
          <h1 className="font-display text-5xl leading-[1.02] tracking-tight md:text-6xl">
            Pick your seats.
            <br />
            <span className="text-accent">We hold them</span> while you pay.
          </h1>
        </div>
        <p className="max-w-xs text-sm leading-relaxed text-muted">
          Every seat is claimed atomically. If two people click the same one, exactly one wins.
        </p>
      </section>

      {error && <Notice>Could not load shows. Is the API running?</Notice>}
      <div className="grid gap-4 md:grid-cols-2">
        {isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        {shows.map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
      </div>
      {!isLoading && !error && shows.length === 0 && (
        <p className="text-muted">No upcoming shows yet.</p>
      )}
      {hasMore && (
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
