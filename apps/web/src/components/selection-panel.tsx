'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatClock, formatMoney } from '@/lib/format';
import type { Seat } from '@/lib/types';
import { buttonClass, Notice } from './ui';

type Props = {
  seats: Seat[];
  signedIn: boolean;
  onSale: boolean;
  holdRemainingMs: number | null; // null = no active hold
  busy: boolean;
  error: string | null;
  maxSeats: number;
  onReserve: () => void;
  onRelease: () => void;
  onContinue: () => void;
};

export const SelectionPanel = ({
  seats,
  signedIn,
  onSale,
  holdRemainingMs,
  busy,
  error,
  maxSeats,
  onReserve,
  onRelease,
  onContinue,
}: Props) => {
  const pathname = usePathname();
  const total = seats.reduce((sum, s) => sum + s.priceCents, 0);
  const holding = holdRemainingMs !== null;

  return (
    <aside className="sticky top-6 flex flex-col gap-5 rounded-md border border-line bg-card p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl">Your seats</h2>
        {holding && (
          <span className="font-mono text-sm text-accent" aria-label="Time left on your hold">
            {formatClock(holdRemainingMs)}
          </span>
        )}
      </div>

      {seats.length === 0 ? (
        <p className="text-sm text-muted">Choose up to {maxSeats} seats on the map.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {seats.map((s) => (
            <li key={s.id} className="flex justify-between py-2">
              <span>
                {s.section} · {s.row}
                {s.number}
              </span>
              <span className="font-mono">{formatMoney(s.priceCents)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-baseline justify-between border-t border-ink pt-4">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">Total</span>
        <span className="font-display text-3xl">{formatMoney(total)}</span>
      </div>

      {error && <Notice>{error}</Notice>}

      {!onSale ? (
        <Notice tone="info">Sales for this show are not open.</Notice>
      ) : !signedIn ? (
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClass()}>
          Sign in to choose seats
        </Link>
      ) : holding ? (
        <div className="flex flex-col gap-2">
          <button className={buttonClass()} disabled={busy} onClick={onContinue}>
            Continue to payment
          </button>
          <button className={buttonClass('ghost')} disabled={busy} onClick={onRelease}>
            Release seats
          </button>
        </div>
      ) : (
        <button className={buttonClass()} disabled={busy || seats.length === 0} onClick={onReserve}>
          {busy ? 'Holding…' : 'Hold these seats'}
        </button>
      )}
      {holding && (
        <p className="text-xs text-muted">
          Held for you. Nobody else can take these seats until the timer ends.
        </p>
      )}
    </aside>
  );
};
