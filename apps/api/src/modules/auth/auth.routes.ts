import { Router } from 'express';
import { login, logout, refresh, register } from './auth.service';
import { route } from '@/lib/route';
import { noInput } from '@/lib/schemas';
import { loginSchema, registerSchema } from './auth.schema';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './auth.cookies';

export const authRouter = Router();

authRouter.post(
  '/register',
  route(
    registerSchema,
    async ({ body }, { res }) => {
      const { user, accessToken, refreshToken } = await register(body);
      setRefreshCookie(res, refreshToken);
      return { user, accessToken };
    },
    { status: 201 },
  ),
);

authRouter.post(
  '/login',
  route(
    loginSchema,
    async ({ body }, { res }) => {
      const { user, accessToken, refreshToken } = await login(body);
      setRefreshCookie(res, refreshToken);
      return { user, accessToken };
    },
    { status: 200 },
  ),
);

authRouter.post(
  '/refresh',
  route(noInput, async (_input, { req, res }) => {
    const { accessToken, refreshToken } = await refresh(readRefreshCookie(req));
    setRefreshCookie(res, refreshToken);
    return { accessToken };
  }),
);

authRouter.post(
  '/logout',
  route(noInput, async (_input, { req, res }) => {
    await logout(readRefreshCookie(req));
    clearRefreshCookie(res);
    return null;
  }),
);
