'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { streamUrl } from './api';
import type { Seat, SeatStatus } from './types';

/** Seconds-accurate countdown to an ISO timestamp; `null` when there is no deadline. */
export const useRemaining = (iso: string | null | undefined) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [iso]);
  return iso ? Math.max(0, new Date(iso).getTime() - now) : null;
};

/**
 * The seat map, kept live: Server-Sent Events patch single seats the moment they change. Events
 * are only hints, so we also refetch on every (re)connect and every 15 s. That is what frees seats
 * whose hold simply expired, which emits no event.
 */
export const useSeatMap = (showId: string) => {
  const key = `/shows/${showId}/seats`;
  const swr = useSWR<Seat[]>(key, { refreshInterval: 15_000 });
  const { mutate } = swr;

  useEffect(() => {
    const source = new EventSource(streamUrl(`${key}/stream`));
    source.onopen = () => void mutate();
    source.addEventListener('seats', (e) => {
      const { showSeatIds, status } = JSON.parse((e as MessageEvent<string>).data) as {
        showSeatIds: string[];
        status: SeatStatus;
      };
      void mutate(
        (seats) => seats?.map((s) => (showSeatIds.includes(s.id) ? { ...s, status } : s)),
        {
          revalidate: false,
        },
      );
    });
    return () => source.close();
  }, [key, mutate]);

  return swr;
};
