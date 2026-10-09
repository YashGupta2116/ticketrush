import { publish } from '@/lib/realtime';

export type SeatStatus = 'available' | 'held' | 'reserved' | 'booked';

export const seatsChannel = (showId: string) => `show:${showId}:seats`;

/** The ONE place that formats seat-change events. Call it after the change is committed. */
export const emitSeatChanges = (showId: string, showSeatIds: string[], status: SeatStatus) =>
  publish(seatsChannel(showId), 'seats', { showSeatIds, status }).catch(() => undefined);
