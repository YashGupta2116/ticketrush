import type { Request, RequestHandler } from 'express';
import type { Role } from '@/db/schema';
import { Errors } from '@/lib/errors';
import { verifyAccessToken } from '@/lib/jwt';

export const authenticate: RequestHandler = async (req, _res, next) => {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) throw Errors.unauthorized('Missing access token');
  req.user = await verifyAccessToken(token).catch(() => {
    throw Errors.unauthorized('Invalid or expired access token');
  });
  next();
};

export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw Errors.forbidden();
    next();
  };

/** Typed accessor for handlers behind `authenticate`. */
export const currentUser = (req: Request) => {
  if (!req.user) throw Errors.unauthorized();
  return req.user;
};
