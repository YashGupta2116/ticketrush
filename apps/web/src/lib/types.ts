export type User = { id: string; name: string; email: string; role: 'user' | 'admin' };
export type Tier = 'standard' | 'premium' | 'vip';
export type SeatStatus = 'available' | 'held' | 'reserved' | 'booked';
export type BookingStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled';
export type PaymentStatus = 'processing' | 'succeeded' | 'failed' | 'refund_pending';

export type Page<T> = { items: T[]; nextCursor: string | null };

export type ShowSummary = {
  id: string;
  startsAt: string;
  salesOpenAt: string;
  isHighDemand: boolean;
  eventTitle: string;
  venueName: string;
  venueCity: string;
};

export type ShowDetail = {
  id: string;
  startsAt: string;
  salesOpenAt: string;
  onSale: boolean;
  pricing: Record<Tier, number>;
  event: { title: string; description: string; durationMinutes: number };
  venue: { name: string; city: string; address: string };
};

export type Seat = {
  id: string;
  section: string;
  row: string;
  number: number;
  tier: Tier;
  priceCents: number;
  status: SeatStatus;
};

export type Hold = { holdId: string; showSeatIds: string[]; expiresAt: string };

export type BookingSummary = {
  id: string;
  status: BookingStatus;
  totalCents: number;
  expiresAt: string;
  createdAt: string;
  eventTitle: string;
  startsAt: string;
  venueName: string;
};

export type BookingDetail = BookingSummary & {
  showId: string;
  payment: { id: string; status: PaymentStatus } | null;
  items: { showSeatId: string; priceCents: number; section: string; row: string; number: number }[];
};
