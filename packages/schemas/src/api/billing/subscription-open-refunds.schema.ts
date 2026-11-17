import { z } from 'zod';
import { SubscriptionRevocationPaymentSourceSchema } from './subscription-revocation.schema.js';

/** One requested or provider-rejected refund requiring operator action (AC:B5:41). */
export const SubscriptionOpenRefundSchema = z
    .object({
        refundId: z.string().uuid(),
        refundAmount: z.number().int().positive(),
        reason: z.string().min(1).max(64),
        status: z.enum(['REQUESTED', 'FAILED']),
        providerRejection: z
            .object({
                code: z.string().max(64).nullable(),
                message: z.string().min(1).max(500),
                detail: z.string().max(600).nullable(),
                rejectedAt: z.string().datetime()
            })
            .nullable(),
        requestedAt: z.string().datetime(),
        payment: z.object({
            source: SubscriptionRevocationPaymentSourceSchema,
            id: z.string().uuid()
        }),
        /** Provider deadline for card payments; null for a manual payment. */
        providerRefundWindow: z
            .object({ open: z.boolean(), closesAt: z.string().datetime() })
            .nullable()
    })
    .refine((item) => (item.status === 'FAILED') === (item.providerRejection !== null));

/** An open request or unsettled provider-rejected refund for one subscription payment; excludes complement and one-time add-on payments (I-7). */
export type SubscriptionOpenRefund = z.infer<typeof SubscriptionOpenRefundSchema>;

/** Refund requests and provider rejections of a subscription, limited to its ledgers (I-7). */
export const SubscriptionOpenRefundsResponseSchema = z.object({
    items: z.array(SubscriptionOpenRefundSchema)
});

/** Response of the subscription open-refunds inspection. */
export type SubscriptionOpenRefundsResponse = z.infer<typeof SubscriptionOpenRefundsResponseSchema>;
