import '@/jobs/bookings.worker';
import { bookingQueue } from '@/jobs/queues';
import { handleProcessSignals } from '@/lib/lifecycle';
import { logger } from '@/lib/logger';

handleProcessSignals();

// Idempotent across restarts and multiple workers: exactly one schedule exists.
await bookingQueue.upsertJobScheduler(
  'reconcile-expired',
  { every: 60_000 },
  { name: 'reconcile' },
);

logger.info('Worker started');
