import { createWorker } from '@/lib/queue';
import { expireBooking, reconcileExpiredBookings } from '@/modules/bookings/bookings.service';
import type { BookingJob } from './queues';

createWorker<BookingJob>('bookings', async (job) => {
  switch (job.name) {
    case 'expire':
      return expireBooking(job.data.bookingId!);
    case 'reconcile':
      return reconcileExpiredBookings();
    default:
      throw new Error(`Unknown job: ${job.name}`);
  }
});
