'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { buttonClass, Eyebrow, Field, Notice } from './ui';

export const AuthForm = ({ mode }: { mode: 'login' | 'register' }) => {
  const { login, register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));
    setBusy(true);
    setError(null);
    try {
      if (isLogin) await login({ email, password });
      else await register({ name: String(form.get('name')), email, password });
      const next = new URLSearchParams(location.search).get('next');
      router.push(next?.startsWith('/') ? next : '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm pt-6">
      <Eyebrow>{isLogin ? 'Welcome back' : 'Create an account'}</Eyebrow>
      <h1 className="mb-8 font-display text-4xl leading-tight">
        {isLogin ? 'Sign in' : 'Get your seats'}
      </h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {!isLogin && <Field label="Name" name="name" autoComplete="name" required minLength={2} />}
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          required
          minLength={isLogin ? 1 : 8}
        />
        {error && <Notice>{error}</Notice>}
        <button className={buttonClass()} disabled={busy}>
          {busy ? 'One moment…' : isLogin ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        {isLogin ? 'New here? ' : 'Already have an account? '}
        <Link
          href={isLogin ? '/register' : '/login'}
          className="text-ink underline underline-offset-4"
        >
          {isLogin ? 'Create an account' : 'Sign in'}
        </Link>
      </p>
    </div>
  );
};
