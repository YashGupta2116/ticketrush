import { AppError } from '@/lib/errors';
import { createStateMachine } from '@/lib/state-machine';

export type PaymentStatus = 'processing' | 'succeeded' | 'failed' | 'refund_pending';

export const paymentMachine = createStateMachine<PaymentStatus>('payment', {
  processing: ['succeeded', 'failed', 'refund_pending'],
  succeeded: [],
  failed: [],
  refund_pending: [],
});

// TODO: (8.3) verify the signature, dedup, lock the booking and apply transitions.
export const handlePaymentWebhook = async (_rawBody: Buffer, _signature: string | undefined) => {
  throw new AppError(501, 'Webhook handling is not implemented yet', 'NOT_IMPLEMENTED');
};
