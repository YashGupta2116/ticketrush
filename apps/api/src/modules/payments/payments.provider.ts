import { env } from '@/config/env';
import { hmacSign, randomToken } from '@/lib/crypto';
import { logger } from '@/lib/logger';

export type PaymentEvent = {
  id: string;
  type: 'payment.succeeded' | 'payment.failed';
  data: { intentId: string; bookingId: string; amountCents: number };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Header format: t=<unix seconds>,v1=<hmac(t + "." + body)> (same scheme as Stripe). */
export const signWebhook = (body: string, timestamp = Math.floor(Date.now() / 1000)) =>
  `t=${timestamp},v1=${hmacSign(`${timestamp}.${body}`, env.PAYMENT_WEBHOOK_SECRET)}`;

const deliver = async (event: PaymentEvent) => {
  const body = JSON.stringify(event);
  for (let attempt = 1; attempt <= 5; attempt++) {
    const ok = await fetch(`${env.API_URL}/api/v1/webhooks/payments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature': signWebhook(body) },
      body,
    })
      .then((res) => res.ok)
      .catch(() => false);
    if (ok) return;
    await sleep(2 ** attempt * 500); // exponential backoff, like real PSPs
  }
  logger.error({ eventId: event.id }, 'Mock PSP gave up delivering webhook');
};

/** Simulates a PSP: async settlement, random failures, retries and duplicate deliveries. */
export const paymentProvider = {
  async createIntent({ bookingId, amountCents }: { bookingId: string; amountCents: number }) {
    const intentId = `pi_${randomToken(12)}`;
    const failed = Math.random() < env.MOCK_PAYMENT_FAILURE_RATE;
    const event: PaymentEvent = {
      id: `evt_${randomToken(12)}`,
      type: failed ? 'payment.failed' : 'payment.succeeded',
      data: { intentId, bookingId, amountCents },
    };
    // In tests nothing is delivered automatically: tests post signed webhooks themselves.
    if (env.NODE_ENV !== 'test') {
      setTimeout(
        () => {
          void deliver(event);
          if (Math.random() < 0.1) setTimeout(() => void deliver(event), 1_500); // duplicate
        },
        500 + Math.random() * 2_500,
      );
    }
    return { intentId };
  },
};
