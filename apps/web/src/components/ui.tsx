import type { InputHTMLAttributes } from 'react';
import type { BookingStatus } from '@/lib/types';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-40';
const variants = {
  primary: 'bg-ink text-paper hover:bg-accent',
  ghost: 'border border-line hover:border-ink',
};
export const buttonClass = (variant: keyof typeof variants = 'primary') =>
  `${base} ${variants[variant]}`;

export const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">{children}</p>
);

export const Field = ({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
      {label}
    </span>
    <input
      {...props}
      className="w-full rounded-md border border-line bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-ink"
    />
  </label>
);

export const Notice = ({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'info';
  children: React.ReactNode;
}) => (
  <p
    role={tone === 'error' ? 'alert' : 'status'}
    className={`rounded-md border px-3.5 py-2.5 text-sm ${
      tone === 'error'
        ? 'border-accent/40 bg-accent/5 text-accent'
        : 'border-line bg-card text-muted'
    }`}
  >
    {children}
  </p>
);

const chips: Record<BookingStatus, string> = {
  pending: 'border-accent/40 text-accent',
  confirmed: 'border-ok/40 text-ok',
  expired: 'border-line text-muted',
  cancelled: 'border-line text-muted',
};
export const StatusChip = ({ status }: { status: BookingStatus }) => (
  <span
    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${chips[status]}`}
  >
    {status}
  </span>
);

export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-line/50 ${className}`} />
);
