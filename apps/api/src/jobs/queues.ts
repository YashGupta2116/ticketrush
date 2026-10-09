import { createQueue } from '@/lib/queue';

export type BookingJob = { bookingId?: string };
export const bookingQueue = createQueue<BookingJob>('bookings');
