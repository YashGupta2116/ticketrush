import Link from 'next/link';
import { formatDate } from '@/lib/format';
import type { ShowSummary } from '@/lib/types';

export const ShowCard = ({ show }: { show: ShowSummary }) => {
  const onSale = new Date(show.salesOpenAt) <= new Date();

  return (
    <Link
      href={`/shows/${show.id}`}
      className="group flex rounded-md border border-line bg-card transition hover:-translate-y-0.5 hover:border-ink/40"
    >
      <div className="flex w-28 shrink-0 flex-col items-center justify-center px-4 py-6 text-center">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          {formatDate(show.startsAt, { month: 'short' })}
        </span>
        <span className="font-display text-5xl leading-none">
          {formatDate(show.startsAt, { day: 'numeric' })}
        </span>
        <span className="mt-2 text-xs text-muted">
          {formatDate(show.startsAt, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
      <div className="tear flex flex-1 flex-col justify-between gap-4 px-6 py-6">
        <div>
          <h2 className="font-display text-2xl leading-tight">{show.eventTitle}</h2>
          <p className="mt-1 text-sm text-muted">
            {show.venueName} · {show.venueCity}
          </p>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex gap-2 text-xs">
            {show.isHighDemand && (
              <span className="rounded-full border border-accent/40 px-2.5 py-0.5 text-accent">
                High demand
              </span>
            )}
            <span className="rounded-full border border-line px-2.5 py-0.5 text-muted">
              {onSale
                ? 'On sale'
                : `Sales open ${formatDate(show.salesOpenAt, { day: 'numeric', month: 'short' })}`}
            </span>
          </span>
          <span className="font-medium transition group-hover:translate-x-1">Select seats →</span>
        </div>
      </div>
    </Link>
  );
};
