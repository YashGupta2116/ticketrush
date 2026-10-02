import { describe, expect, it } from 'vitest';
import { api, createUser, TEST_PASSWORD } from './helpers';

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
