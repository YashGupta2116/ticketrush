import type { CookieOptions, Request, Response } from 'express';
import { env, isProd } from '@/config/env';

const NAME = 'refresh_token';
const options: CookieOptions = {
  httpOnly: true, // unreadable by JS → safe from XSS token theft
  secure: isProd,
  sameSite: 'strict',
  path: '/api/v1/auth', // only sent to auth endpoints
};

export const setRefreshCookie = (res: Response, token: string) =>
  res.cookie(NAME, token, { ...options, maxAge: env.REFRESH_TTL_DAYS * 86_400_000 });
export const clearRefreshCookie = (res: Response) => res.clearCookie(NAME, options);
export const readRefreshCookie = (req: Request): string | undefined => req.cookies?.[NAME];
