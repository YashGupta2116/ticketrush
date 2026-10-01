import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, Errors } from '@/lib/errors';

export const notFound: RequestHandler = (req) => {
  throw Errors.notFound(`Cannot ${req.method} ${req.path}`);
};

const toAppError = (err: unknown): AppError => {
  if (err instanceof AppError) return err;
  // body-parser & friends attach a 4xx `status` (malformed JSON, payload too large…)
  const status = (err as { status?: number })?.status;
  if (status && status >= 400 && status < 500) {
    return new AppError(status, (err as Error).message, 'BAD_REQUEST');
  }
  return new AppError(500, 'Something went wrong', 'INTERNAL_ERROR');
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const { statusCode, code, message, details } = toAppError(err);
  if (statusCode >= 500) req.log.error({ err }, 'Unhandled error');
  res.status(statusCode).json({ error: { code, message, details, requestId: req.id } });
};
