import type { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';

import { db, type Executor } from '@/db';
import { isUniqueViolation } from '@/db/errors';
import { refreshTokens, users } from '@/db/schema';
import { hashPassword, randomToken, sha256, verifyPassword } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { signAccessToken } from '@/lib/jwt';

import type { loginSchema, registerSchema } from './auth.schema';
import { env } from '@/config/env';
import { randomUUID } from 'node:crypto';

type RegisterInput = z.infer<typeof registerSchema>['body'];
type LoginInput = z.infer<typeof loginSchema>['body'];
type User = typeof users.$inferSelect;
const DUMMY_HASH = hashPassword('dummy-password');

const createRefreshToken = async (userId: string, familyId: string, executor: Executor = db) => {
  const token = randomToken();
  await executor.insert(refreshTokens).values({
    userId,
    familyId,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + env.REFRESH_TTL_DAYS * 86_400_000),
  });
  return token;
};

const toPublicUser = ({ id, name, email, role }: User) => ({ id, name, email, role });

const issueSession = async (user: User, familyId = randomUUID()) => ({
  user: toPublicUser(user),
  accessToken: await signAccessToken({ id: user.id, role: user.role }),
  refreshToken: await createRefreshToken(user.id, familyId),
});

export const register = async ({ name, email, password }: RegisterInput) => {
  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash })
    .returning()
    .catch((err) => {
      if (isUniqueViolation(err)) throw Errors.conflict('Email already registered');
      throw err;
    });

  return issueSession(user!);
};

export const login = async ({ email, password }: LoginInput) => {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });

  const passwordOk = await verifyPassword(user?.passwordHash ?? (await DUMMY_HASH), password);
  if (!user || !passwordOk) throw Errors.unauthorized('Invalid credentials');

  return issueSession(user);
};

const invalidRefresh = () => Errors.unauthorized('Invalid refresh token');

const revokeFamily = (familyId: string) =>
  db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));

export const refresh = async (token: string | undefined) => {
  if (!token) throw invalidRefresh();

  const stored = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.tokenHash, sha256(token)),
  });

  if (!stored) throw invalidRefresh();

  if (stored.revokedAt) {
    await revokeFamily(stored.familyId);
    throw invalidRefresh();
  }

  if (stored.expiresAt < new Date()) throw invalidRefresh();

  const session = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.id, stored.id), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });

    if (!claimed) return null;

    const user = await tx.query.users.findFirst({ where: eq(users.id, stored.userId) });

    if (!user) throw invalidRefresh();

    return {
      accessToken: await signAccessToken({ id: user.id, role: user.role }),
      refreshToken: await createRefreshToken(user.id, stored.familyId, tx),
    };
  });

  if (!session) {
    await revokeFamily(stored.familyId);
    throw invalidRefresh();
  }

  return session;
};

export const logout = async (token: string | undefined) => {
  if (!token) return;

  const stored = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.tokenHash, sha256(token)),
  });

  if (stored) await revokeFamily(stored.familyId);
};

export const getMe = async (userId: string) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });

  if (!user) throw Errors.unauthorized();

  return toPublicUser(user);
};
