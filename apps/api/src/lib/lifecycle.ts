import { logger } from './logger';

type Task = () => unknown;

const tasks: Task[] = [];
let shuttingDown = false;

/** Register cleanup work. Runs in reverse registration order (LIFO), like `defer`. */
export const onShutdown = (task: Task) => void tasks.unshift(task);

export const runShutdownTasks = async () => {
  for (const task of tasks.splice(0)) {
    await Promise.resolve()
      .then(task)
      .catch((err) => logger.error({ err }, 'Shutdown task failed'));
  }
};

export const gracefulShutdown = async (reason: string, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ reason }, 'Shutting down gracefully');
  setTimeout(() => process.exit(1), 10_000).unref(); // hard deadline
  await runShutdownTasks();
  process.exit(exitCode);
};

export const handleProcessSignals = () => {
  const crash = (err: unknown) => {
    logger.fatal({ err }, 'Fatal error');
    void gracefulShutdown('fatal', 1);
  };
  // Wrap: Node passes (signal, signalNumber) to signal listeners, which would become the exit code.
  const onSignal = (signal: string) => void gracefulShutdown(signal);
  process.once('SIGINT', onSignal).once('SIGTERM', onSignal);
  process.on('unhandledRejection', crash).on('uncaughtException', crash);
};
