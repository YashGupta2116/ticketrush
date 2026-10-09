import { describe, expect, it } from 'vitest';
import { hmacSign } from '@/lib/crypto';
import { env } from '@/config/env';
import { bookingMachine } from '@/modules/bookings/bookings.service';
import { paymentMachine } from '@/modules/payments/payments.service';
import { signWebhook } from '@/modules/payments/payments.provider';
import { api } from './helpers';

describe('state machines', () => {
  it('booking: pending may move to confirmed, expired or cancelled; nothing leaves those', () => {
    for (const to of ['confirmed', 'expired', 'cancelled'] as const) {
      expect(bookingMachine.can('pending', to)).toBe(true);
      for (const other of ['pending', 'confirmed', 'expired', 'cancelled'] as const) {
        expect(bookingMachine.can(to, other)).toBe(false);
      }
    }
  });

  it('booking: assert throws 409 on an invalid transition', () => {
    expect(() => bookingMachine.assert('expired', 'confirmed')).toThrowError(
      /Invalid booking transition: expired → confirmed/,
    );
    expect(() => bookingMachine.assert('pending', 'confirmed')).not.toThrow();
  });

  it('payment: processing may settle, fail or await refund; terminal states stay put', () => {
    for (const to of ['succeeded', 'failed', 'refund_pending'] as const) {
      expect(paymentMachine.can('processing', to)).toBe(true);
      expect(paymentMachine.can(to, 'processing')).toBe(false);
    }
    expect(paymentMachine.can('failed', 'succeeded')).toBe(false);
  });
});

describe('signWebhook', () => {
  it('produces t=<ts>,v1=<hmac(ts.body)>', () => {
    const body = '{"a":1}';
    const header = signWebhook(body, 1_700_000_000);
    expect(header).toBe(
      `t=1700000000,v1=${hmacSign(`1700000000.${body}`, env.PAYMENT_WEBHOOK_SECRET)}`,
    );
  });
});

describe('POST /api/v1/webhooks/payments', () => {
  it('is mounted ahead of express.json (reaches the handler without auth)', async () => {
    const res = await api
      .post('/api/v1/webhooks/payments')
      .set('content-type', 'application/json')
      .send('{"raw":true}');
    expect(res.status).toBe(501); // replaced by real handling in 8.3
  });
});
