import type { z } from 'zod';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { isUniqueViolation } from '@/db/errors';
import { users } from '@/db/schema';
import { hashPassword, randomToken, verifyPassword } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { signAccessToken } from '@/lib/jwt';

import type { loginSchema, registerSchema } from './auth.schema';

type RegisterInput = z.infer<typeof registerSchema>['body'];
type LoginInput = z.infer<typeof loginSchema>['body'];
type User = typeof users.$inferSelect;

const DUMMY_HASH = hashPassword('dummy-password');

const toPublicUser = ({ id, name, email, role }: User) => ({ id, name, email, role });

const issueSession = async (user: User) => ({
  user: toPublicUser(user),
  accessToken: await signAccessToken({ id: user.id, role: user.role }),
  refreshToken: randomToken(),
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
