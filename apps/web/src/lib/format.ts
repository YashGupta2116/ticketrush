const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Prices are integer paise on the wire. */
export const formatMoney = (cents: number) => money.format(cents / 100);

export const formatDate = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-IN', options).format(new Date(iso));

export const formatClock = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
