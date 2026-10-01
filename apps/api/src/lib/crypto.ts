import { hash, verify } from '@node-rs/argon2';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const hashPassword = (plain: string) => hash(plain); // argon2id by default
export const verifyPassword = (hashed: string, plain: string) => verify(hashed, plain);

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const hmacSign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('hex');

/** Constant-time comparison: prevents timing attacks on secrets/signatures. */
export const safeEqual = (a: string, b: string) => {
  const [x, y] = [Buffer.from(a), Buffer.from(b)];
  return x.length === y.length && timingSafeEqual(x, y);
};
