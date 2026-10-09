'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { Legend, SeatMap } from '@/components/seat-map';
import { SelectionPanel } from '@/components/selection-panel';
import { Eyebrow, Notice, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { useRemaining, useSeatMap } from '@/lib/hooks';
import type { Hold, Seat, ShowDetail } from '@/lib/types';

const MAX_SEATS = 6;

export default function ShowPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: show, error: showError } = useSWR<ShowDetail>(`/shows/${id}`);
  const { data: seats, mutate: refreshSeats } = useSeatMap(id);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hold, setHold] = useState<Hold | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bookingKey = useRef<{ holdId: string; key: string } | null>(null);

  // A hold survives a refresh: keep it in localStorage, per user and show.
  const storageKey = user ? `hold:${user.id}:${id}` : null;
  useEffect(() => {
    if (!storageKey) return;
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Hold | null;
    if (saved && new Date(saved.expiresAt) > new Date()) {
      setHold(saved);
      setSelected(new Set(saved.showSeatIds));
    }
  }, [storageKey]);

  const remaining = useRemaining(hold?.expiresAt);
  const clearHold = () => {
    if (storageKey) localStorage.removeItem(storageKey);
    setHold(null);
    setSelected(new Set());
    void refreshSeats();
  };
  useEffect(() => {
    if (hold && remaining === 0) {
      clearHold();
      setError('Your hold expired. Pick your seats again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'SEATS_UNAVAILABLE') {
        const gone = new Set((err.details as { showSeatIds?: string[] })?.showSeatIds);
        setSelected((prev) => new Set([...prev].filter((s) => !gone.has(s))));
        void refreshSeats();
        setError('Someone just took some of those seats. We removed them from your selection.');
      } else if (err.code === 'HOLD_EXPIRED') {
        clearHold();
        setError('Your hold expired. Pick your seats again.');
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const toggle = (seat: Seat) => {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else if (next.size < MAX_SEATS) next.add(seat.id);
      else setError(`You can choose up to ${MAX_SEATS} seats.`);
      return next;
    });
  };

  const reserve = () =>
    run(async () => {
      const created = await api<Hold>(`/shows/${id}/holds`, {
        method: 'POST',
        body: { showSeatIds: [...selected] },
      });
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(created));
      setHold(created);
    });

  const release = () =>
    run(async () => {
      await api(`/shows/${id}/holds/${hold!.holdId}`, { method: 'DELETE' });
      clearHold();
    });

  const proceed = () =>
    run(async () => {
      // One key per hold, so a double click or retry can only ever create one booking.
      if (bookingKey.current?.holdId !== hold!.holdId) {
        bookingKey.current = { holdId: hold!.holdId, key: crypto.randomUUID() };
      }
      const booking = await api<{ id: string }>('/bookings', {
        method: 'POST',
        body: { showId: id, holdId: hold!.holdId },
        idempotencyKey: bookingKey.current.key,
      });
      if (storageKey) localStorage.removeItem(storageKey);
      router.push(`/bookings/${booking.id}`);
    });

  if (showError) return <Notice>We could not find that show.</Notice>;
  if (!show || !seats) return <Skeleton className="h-96" />;

  const chosen = seats.filter((s) => selected.has(s.id));

  return (
    <>
      <header className="mb-10 border-b border-line pb-8">
        <Eyebrow>
          {formatDate(show.startsAt, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Eyebrow>
        <h1 className="font-display text-5xl leading-tight tracking-tight">{show.event.title}</h1>
        <p className="mt-2 text-muted">
          {show.venue.name} · {show.venue.city} ·{' '}
          {Math.round((show.event.durationMinutes / 60) * 10) / 10} h
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <Legend pricing={show.pricing} />
          <SeatMap
            seats={seats}
            selected={selected}
            locked={!!hold || !show.onSale || !user}
            onToggle={toggle}
          />
        </div>
        <SelectionPanel
          seats={chosen}
          signedIn={!!user}
          onSale={show.onSale}
          holdRemainingMs={hold ? remaining : null}
          busy={busy}
          error={error}
          maxSeats={MAX_SEATS}
          onReserve={reserve}
          onRelease={release}
          onContinue={proceed}
        />
      </div>
    </>
  );
}
