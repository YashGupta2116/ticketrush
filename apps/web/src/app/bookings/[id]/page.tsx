'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { buttonClass, Eyebrow, Notice, Skeleton, StatusChip } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatClock, formatDate, formatMoney } from '@/lib/format';
import { useRemaining } from '@/lib/hooks';
import type { BookingDetail } from '@/lib/types';

// Defined once: a new function each render would reset SWR's timer on every countdown tick.
// SWR also asks at mount, before any data exists, so "no data yet" must keep polling alive.
const pollWhilePending = (b?: BookingDetail) => (!b || b.status === 'pending' ? 2_000 : 0);

export default function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  // While a payment is in flight the webhook decides the outcome, so poll until it lands.
  const {
    data: booking,
    error,
    mutate,
  } = useSWR<BookingDetail>(user ? `/bookings/${id}` : null, {
    refreshInterval: pollWhilePending,
    refreshWhenHidden: true, // people switch tabs to approve a payment
  });
  const remaining = useRemaining(booking?.status === 'pending' ? booking.expiresAt : null);
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    setPayError(null);
    try {
      await api(`/bookings/${id}/pay`, { method: 'POST', idempotencyKey: crypto.randomUUID() });
      await mutate();
    } catch (e) {
      setPayError((e as ApiError).message);
      await mutate(); // the booking may have changed under us
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Notice>We could not find that booking.</Notice>;
  if (!booking) return <Skeleton className="h-96" />;

  const processing = booking.payment?.status === 'processing';
  const expired = booking.status === 'expired' || (booking.status === 'pending' && remaining === 0);

  return (
    <div className="mx-auto max-w-2xl">
      <Eyebrow>Booking {booking.id.slice(0, 8)}</Eyebrow>
      <div className="mb-8 flex items-start justify-between gap-4">
        <h1 className="font-display text-5xl leading-tight tracking-tight">{booking.eventTitle}</h1>
        <StatusChip status={expired ? 'expired' : booking.status} />
      </div>

      <div className="flex rounded-md border border-line bg-card">
        <div className="flex-1 p-6">
          <p className="text-sm text-muted">
            {booking.venueName} ·{' '}
            {formatDate(booking.startsAt, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
          <ul className="mt-5 divide-y divide-line text-sm">
            {booking.items.map((item) => (
              <li key={item.showSeatId} className="flex justify-between py-2">
                <span>
                  {item.section} · {item.row}
                  {item.number}
                </span>
                <span className="font-mono">{formatMoney(item.priceCents)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="tear flex w-44 shrink-0 flex-col items-center justify-center gap-1 p-6 text-center">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Total</span>
          <span className="font-display text-3xl">{formatMoney(booking.totalCents)}</span>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {booking.status === 'confirmed' && (
          <Notice tone="info">You&apos;re in. Your seats are booked.</Notice>
        )}
        {expired && <Notice>This booking expired and the seats went back on sale.</Notice>}
        {booking.status === 'pending' && !expired && (
          <>
            <p className="text-sm text-muted">
              Pay within{' '}
              <span className="font-mono text-accent">{formatClock(remaining ?? 0)}</span> or the
              seats are released.
            </p>
            {booking.payment?.status === 'failed' && (
              <Notice>Your payment failed. You can try again.</Notice>
            )}
            {processing && (
              <Notice tone="info">Waiting for the bank to confirm your payment…</Notice>
            )}
            {payError && <Notice>{payError}</Notice>}
            <button className={buttonClass()} disabled={busy || processing} onClick={pay}>
              {processing
                ? 'Processing…'
                : booking.payment?.status === 'failed'
                  ? 'Try payment again'
                  : `Pay ${formatMoney(booking.totalCents)}`}
            </button>
          </>
        )}
        {booking.payment?.status === 'refund_pending' && (
          <Notice tone="info">
            Your payment arrived after the booking expired. A refund is on its way.
          </Notice>
        )}
        <Link href="/bookings" className="text-sm text-muted underline underline-offset-4">
          All bookings
        </Link>
      </div>
    </div>
  );
}
