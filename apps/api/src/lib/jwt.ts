import { jwtVerify, SignJWT } from 'jose';
import { env } from '@/config/env';
import type { Role } from '@/db/schema';

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export type AuthUser = { id: string; role: Role };

export const signAccessToken = ({ id, role }: AuthUser) =>
  new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(secret);

export const verifyAccessToken = async (token: string): Promise<AuthUser> => {
  const { payload } = await jwtVerify<{ role: Role }>(token, secret, { algorithms: ['HS256'] });
  return { id: payload.sub!, role: payload.role };
};
