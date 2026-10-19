import { z } from 'zod';
import { SubscriptionRevocationPaymentSourceSchema } from './subscription-revocation.schema.js';

/** One RF1 request still open on a payment of the subscription while B6 is unavailable (AC:B5:41). */
export const SubscriptionOpenRefundSchema = z.object({
    refundId: z.string().uuid(),
    refundAmount: z.number().int().positive(),
    reason: z.string().min(1).max(64),
    requestedAt: z.string().datetime(),
    payment: z.object({ source: SubscriptionRevocationPaymentSourceSchema, id: z.string().uuid() })
});

/** An open refund request for one payment of the requested subscription; excludes complement and one-time add-on payments (I-7). */
export type SubscriptionOpenRefund = z.infer<typeof SubscriptionOpenRefundSchema>;

/** The open RF1 requests of a subscription, limited to its payment and manual-payment ledgers (I-7). */
export const SubscriptionOpenRefundsResponseSchema = z.object({
    items: z.array(SubscriptionOpenRefundSchema)
});

/** Response of the subscription open-refunds inspection. */
export type SubscriptionOpenRefundsResponse = z.infer<typeof SubscriptionOpenRefundsResponseSchema>;
