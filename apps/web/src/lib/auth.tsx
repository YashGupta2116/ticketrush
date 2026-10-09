'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, setAccessToken } from './api';
import type { User } from './types';

type Credentials = { email: string; password: string };
type AuthResult = { user: User; accessToken: string };

type Auth = {
  user: User | null;
  loading: boolean;
  login: (body: Credentials) => Promise<void>;
  register: (body: Credentials & { name: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session from the httpOnly refresh cookie.
  useEffect(() => {
    (async () => {
      if (await refreshSession()) setUser(await api<User>('/auth/me').catch(() => null));
      setLoading(false);
    })();
  }, []);

  const start = useCallback(async (path: string, body: unknown) => {
    const result = await api<AuthResult>(path, { method: 'POST', body });
    setAccessToken(result.accessToken);
    setUser(result.user);
  }, []);

  const value = useMemo<Auth>(
    () => ({
      user,
      loading,
      login: (body) => start('/auth/login', body),
      register: (body) => start('/auth/register', body),
      logout: async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => null);
        setAccessToken(null);
        setUser(null);
      },
    }),
    [user, loading, start],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
