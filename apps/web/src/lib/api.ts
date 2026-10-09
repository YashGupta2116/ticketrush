const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => (accessToken = token);

let refreshing: Promise<boolean> | null = null;

/** Rotates the refresh cookie for a new access token. Concurrent callers share one request. */
export const refreshSession = () =>
  (refreshing ??= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) return false;
      accessToken = ((await res.json()).data as { accessToken: string }).accessToken;
      return true;
    })
    .catch(() => false)
    .finally(() => (refreshing = null)));

type Options = { method?: string; body?: unknown; idempotencyKey?: string };

export const api = async <T>(
  path: string,
  { method = 'GET', body, idempotencyKey }: Options = {},
) => {
  const send = () =>
    fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined && { 'content-type': 'application/json' }),
        ...(accessToken && { authorization: `Bearer ${accessToken}` }),
        ...(idempotencyKey && { 'idempotency-key': idempotencyKey }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res = await send();
  if (res.status === 401 && !path.startsWith('/auth/') && (await refreshSession()))
    res = await send();

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = json?.error;
    throw new ApiError(
      res.status,
      e?.code ?? 'ERROR',
      e?.message ?? 'Something went wrong',
      e?.details,
    );
  }
  return json?.data as T;
};

export const streamUrl = (path: string) => `${BASE}${path}`;
