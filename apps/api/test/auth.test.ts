import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { api, createUser, TEST_PASSWORD } from './helpers';
import { refreshTokens, users } from '@/db/schema';
import { db } from '@/db';

const valid = { name: 'Asha Rao', email: 'asha@example.com', password: 'Password123!' };

describe('POST /api/v1/auth/register', () => {
  it('creates the user, returns an access token and sets the refresh cookie', async () => {
    const res = await api.post('/api/v1/auth/register').send(valid);

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      email: valid.email,
      name: valid.name,
      role: 'user',
    });
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data).not.toHaveProperty('refreshToken');
    expect(res.headers['set-cookie']?.[0]).toMatch(/^refresh_token=.+HttpOnly/);
  });

  it('normalizes the email', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .send({ ...valid, email: '  Asha@Example.COM ' });
    expect(res.body.data.user.email).toBe('asha@example.com');
  });

  it('rejects a duplicate email with 409', async () => {
    const { user } = await createUser();
    const res = await api.post('/api/v1/auth/register').send({ ...valid, email: user.email });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects invalid input with 422', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toHaveLength(3);
  });

  it('stores a hashed refresh token', async () => {
    await api.post('/api/v1/auth/register').send(valid);
    const rows = await db.select().from(refreshTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toHaveLength(64); // sha256 hex, not the raw token
  });
});

describe('POST /api/v1/auth/login', () => {
  it('logs the user in, returns an access token and sets the refresh cookie', async () => {
    const { user } = await createUser({ name: valid.name });
    const res = await api
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: user.id, email: user.email, role: 'user' });
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data).not.toHaveProperty('refreshToken');
    expect(res.headers['set-cookie']?.[0]).toMatch(/^refresh_token=.+HttpOnly/);
  });

  it('normalizes the email', async () => {
    const { user } = await createUser({ email: 'asha@example.com' });
    const res = await api
      .post('/api/v1/auth/login')
      .send({ email: '  Asha@Example.COM ', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
  });

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    const { user } = await createUser();
    const wrongPassword = await api
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'wrong-password' });
    const unknownEmail = await api
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: TEST_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('UNAUTHORIZED');
    expect(unknownEmail.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it('rejects invalid input with 422', async () => {
    const res = await api.post('/api/v1/auth/login').send({ email: 'not-an-email', password: '' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toHaveLength(2);
  });
});

/** Registers a user and returns the raw `refresh_token=...` cookie pair from the response. */
const registerAndGetCookie = async () => {
  const res = await api.post('/api/v1/auth/register').send(valid);
  return res.headers['set-cookie']![0]!.split(';')[0]!;
};
const refreshWith = (cookie: string) => api.post('/api/v1/auth/refresh').set('Cookie', cookie);

describe('POST /api/v1/auth/refresh', () => {
  it('rotates: returns a new access token and a different refresh cookie', async () => {
    const oldCookie = await registerAndGetCookie();
    const res = await refreshWith(oldCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    const newCookie = res.headers['set-cookie']![0]!.split(';')[0]!;
    expect(newCookie).not.toBe(oldCookie);
    expect((await refreshWith(newCookie)).status).toBe(200);
  });

  it('rejects reuse of an old token', async () => {
    const oldCookie = await registerAndGetCookie();
    await refreshWith(oldCookie);

    expect((await refreshWith(oldCookie)).status).toBe(401);
  });

  it('revokes the whole family when an old token is reused', async () => {
    const oldCookie = await registerAndGetCookie();
    const rotated = await refreshWith(oldCookie);
    const newCookie = rotated.headers['set-cookie']![0]!.split(';')[0]!;

    await refreshWith(oldCookie); // replay: should burn the family
    expect((await refreshWith(newCookie)).status).toBe(401);
  });

  it('rejects a missing cookie, an unknown token and an expired token', async () => {
    expect((await api.post('/api/v1/auth/refresh')).status).toBe(401);
    expect((await refreshWith('refresh_token=not-a-real-token')).status).toBe(401);

    const cookie = await registerAndGetCookie();
    await db.update(refreshTokens).set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await refreshWith(cookie)).status).toBe(401);
  });

  it('lets only one of two concurrent refreshes with the same token succeed', async () => {
    const cookie = await registerAndGetCookie();
    const [a, b] = await Promise.all([refreshWith(cookie), refreshWith(cookie)]);

    expect([a.status, b.status].sort()).toEqual([200, 401]);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the session and clears the cookie', async () => {
    const cookie = await registerAndGetCookie();
    const res = await api.post('/api/v1/auth/logout').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: null });
    expect(res.headers['set-cookie']![0]).toMatch(/^refresh_token=;/);
    expect((await refreshWith(cookie)).status).toBe(401);
  });

  it('is idempotent without a cookie', async () => {
    expect((await api.post('/api/v1/auth/logout')).status).toBe(200);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('reject a request without token', async () => {
    const res = await api.get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('reject a request with wrong token', async () => {
    const token = `ascjkabcobaobcsanbcoasasa`;
    const res = await api.get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('returns the current user', async () => {
    const { user, auth } = await createUser();
    const res = await api.get('/api/v1/auth/me').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  });

  it('rejects a valid token whose user no longer exists', async () => {
    const { user, auth } = await createUser();
    await db.delete(users).where(eq(users.id, user.id));

    const res = await api.get('/api/v1/auth/me').set(auth);
    expect(res.status).toBe(401);
  });
});
