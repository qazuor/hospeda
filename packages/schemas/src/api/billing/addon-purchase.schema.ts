import { z } from 'zod';

/** Protected addon purchase request. */
export const AddonPurchaseRequestSchema = z.strictObject({
    productId: z.uuid(),
    targetId: z.uuid().nullable(),
    orderRequestId: z.string().min(1).max(64),
    addonVersionId: z.uuid(),
    payerEmail: z.email().optional(),
    payment: z
        .strictObject({
            token: z.string().min(1),
            brand: z.string().min(1),
            kind: z.enum(['credit', 'debit'])
        })
        .optional()
});

/** Protected addon purchase response. */
export const AddonPurchaseResponseSchema = z.strictObject({
    outcome: z.enum(['CREATED', 'EXISTING', 'PENDING_ELSEWHERE']),
    instanceId: z.uuid(),
    chargeKind: z.enum(['UNA_VEZ', 'PERIODICO']),
    processing: z.boolean(),
    checkoutUrl: z.url().optional(),
    order: z
        .strictObject({
            outcome: z.enum([
                'ORDER_PLACED',
                'ORDER_ALREADY_PLACED',
                'ORDER_DECLINED',
                'ORDER_REJECTED',
                'PREVIOUS_PAYMENT_PROCESSING',
                'AWAITING_PROVIDER_ANSWER',
                'NOT_APPLICABLE',
                'ACTIVATED',
                'NOT_APPROVED',
                'UNKNOWN'
            ])
        })
        .optional()
});

/** Owner-only read of an addon purchase. */
export const AddonPurchaseReadResponseSchema = z.strictObject({
    instanceId: z.uuid(),
    status: z.enum(['PENDING_AUTHORIZATION', 'ACTIVE', 'ABANDONED', 'EXPIRED', 'CANCELLED']),
    chargeKind: z.enum(['UNA_VEZ', 'PERIODICO']),
    processing: z.boolean()
});
