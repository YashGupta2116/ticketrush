import { Queue, Worker, type Processor } from 'bullmq';
import { onShutdown } from './lifecycle';
import { logger } from './logger';
import { createRedis } from './redis';

const connection = createRedis('bullmq', { maxRetriesPerRequest: null }); // required by BullMQ

export const createQueue = <T>(name: string) => {
  const queue = new Queue<T>(name, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  });
  onShutdown(() => queue.close());
  return queue;
};

export const createWorker = <T>(name: string, processor: Processor<T>, concurrency = 5) => {
  const worker = new Worker<T>(name, processor, { connection, concurrency });
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id, name }, 'Job failed'));
  onShutdown(() => worker.close()); // waits for active jobs to finish
  return worker;
};
