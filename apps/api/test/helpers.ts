import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '@/app';
import { db } from '@/db';
import { users } from '@/db/schema';
import { hashPassword } from '@/lib/crypto';
import { signAccessToken } from '@/lib/jwt';

export const api = request(createApp());

export const TEST_PASSWORD = 'Password123!';
const passwordHash = hashPassword(TEST_PASSWORD); // hash once, reuse (argon2 is slow on purpose)

export const createUser = async (overrides: Partial<typeof users.$inferInsert> = {}) => {
  const [user] = await db
    .insert(users)
    .values({
      email: `${randomUUID()}@test.dev`,
      name: 'Test User',
      passwordHash: await passwordHash,
      ...overrides,
    })
    .returning();
  const token = await signAccessToken({ id: user!.id, role: user!.role });
  return { user: user!, auth: { authorization: `Bearer ${token}` } };
};
