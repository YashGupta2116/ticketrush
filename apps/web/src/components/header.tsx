'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { buttonClass } from './ui';

export const Header = () => {
  const { user, loading, logout } = useAuth();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          TicketRush<span className="text-accent">.</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/" className="text-muted transition hover:text-ink">
            Shows
          </Link>
          {user && (
            <Link href="/bookings" className="text-muted transition hover:text-ink">
              My bookings
            </Link>
          )}
          {loading ? null : user ? (
            <button onClick={logout} className={buttonClass('ghost')}>
              Sign out
            </button>
          ) : (
            <Link href="/login" className={buttonClass()}>
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};
