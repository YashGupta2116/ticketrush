import { Router } from 'express';
import { login, register } from './auth.service';
import { route } from '@/lib/route';
import { loginSchema, registerSchema } from './auth.schema';
import { setRefreshCookie } from './auth.cookies';

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
