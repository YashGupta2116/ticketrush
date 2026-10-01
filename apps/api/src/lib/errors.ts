export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const factory =
  (status: number, code: string, fallback: string) =>
  (message = fallback, details?: unknown) =>
    new AppError(status, message, code, details);

export const Errors = {
  badRequest: factory(400, 'BAD_REQUEST', 'Bad request'),
  unauthorized: factory(401, 'UNAUTHORIZED', 'Unauthorized'),
  forbidden: factory(403, 'FORBIDDEN', 'Forbidden'),
  notFound: factory(404, 'NOT_FOUND', 'Resource not found'),
  conflict: factory(409, 'CONFLICT', 'Conflict'),
  gone: factory(410, 'GONE', 'Resource no longer available'),
  validation: factory(422, 'VALIDATION_ERROR', 'Validation failed'),
  tooManyRequests: factory(429, 'RATE_LIMITED', 'Too many requests'),
  unavailable: factory(503, 'SERVICE_UNAVAILABLE', 'Service unavailable'),
};
