import { z } from 'zod';

/**
 * The states S36 revokes from (TRANS:B:S36). Mirrors `REVOCATION_ORIGINS` in
 * `@repo/service-core`, which this package cannot import.
 */
export const SubscriptionRevocationOriginSchema = z.enum([
    'ACTIVE',
    'GRACE_PERIOD',
    'CANCEL_SCHEDULED',
    'PAUSED'
]);

/** One state S36 revokes from. */
export type SubscriptionRevocationOrigin = z.infer<typeof SubscriptionRevocationOriginSchema>;

/** Which ledger the revoked payment lives in: a provider `payment` or a `manual_payment`. */
export const SubscriptionRevocationPaymentSourceSchema = z.enum(['PAYMENT', 'MANUAL_PAYMENT']);

/** The ledger of the revoked payment. */
export type SubscriptionRevocationPaymentSource = z.infer<
    typeof SubscriptionRevocationPaymentSourceSchema
>;

/**
 * What the provider half of S36 ended in (I-6). Mirrors `RevocationCancelCall`
 * in `@repo/service-core`.
 */
export const SubscriptionRevocationCancelCallSchema = z.enum([
    'SENT',
    'NOT_NEEDED',
    'NOTICE_PENDING',
    'FAILED',
    'NOT_APPLICABLE'
]);

/** An outcome of the provider half of S36. */
export type SubscriptionRevocationCancelCall = z.infer<
    typeof SubscriptionRevocationCancelCallSchema
>;

/** Path params of admin action 8 with reason revocation. */
export const SubscriptionRevocationParamsSchema = z.object({
    subscriptionId: z.string().uuid()
});

/** Parsed path params of the revocation routes. */
export type SubscriptionRevocationParams = z.infer<typeof SubscriptionRevocationParamsSchema>;

/**
 * The confirmation of admin action 8 with reason revocation (AC:B5:20, D-3): the
 * payment that is returned, its amount, the end of the 10-day window and the three
 * things the act does: cancel the authorization, end the service now and request
 * an RF1 for the total. `ownerSubscriptionId` differs from `subscriptionId` when
 * the payment belongs to a predecessor found through `sucedida_por` (AC:B5:22).
 */
export const SubscriptionRevocationPreviewResponseSchema = z.object({
    subscriptionId: z.string().uuid(),
    origin: SubscriptionRevocationOriginSchema,
    payment: z.object({
        source: SubscriptionRevocationPaymentSourceSchema,
        id: z.string().uuid(),
        amount: z.number().int().nonnegative(),
        currency: z.string().nullable(),
        chargedAt: z.string().datetime(),
        ownerSubscriptionId: z.string().uuid()
    }),
    windowEndsAt: z.string().datetime(),
    effects: z.object({
        cancelsAuthorization: z.boolean(),
        endsServiceAt: z.literal('NOW'),
        requestsRefund: z.literal(true)
    })
});

/** Response of the revocation preview. */
export type SubscriptionRevocationPreviewResponse = z.infer<
    typeof SubscriptionRevocationPreviewResponseSchema
>;

/**
 * Body of admin action 8 with reason revocation.
 *
 * - `expectedPaymentId`: the payment the preview showed. Mandatory: the person
 *   confirms what they saw, and a different last payment answers 409.
 * - `note`: optional free text kept in the audit record.
 */
export const SubscriptionRevocationRequestSchema = z.strictObject({
    expectedPaymentId: z.string().uuid(),
    note: z.string().trim().min(1).max(2000).optional()
});

/** Parsed body of the revocation. */
export type SubscriptionRevocationRequest = z.infer<typeof SubscriptionRevocationRequestSchema>;

/**
 * Response of admin action 8 with reason revocation: the row is `CANCELLED`, its
 * service ended at `serviceEndedAt`, the RF1 `refundId` was requested for
 * `refundAmount` over `payment`, and `cancelCall` says what the provider half
 * ended in. `escalated` is present when the before-cancel notice was not
 * deliverable and the call went anyway.
 */
export const SubscriptionRevocationResponseSchema = z.object({
    subscriptionId: z.string().uuid(),
    status: z.literal('CANCELLED'),
    origin: SubscriptionRevocationOriginSchema,
    serviceEndedAt: z.string().datetime(),
    refundId: z.string().uuid(),
    refundAmount: z.number().int().nonnegative(),
    payment: z.object({
        source: SubscriptionRevocationPaymentSourceSchema,
        id: z.string().uuid()
    }),
    cancelCall: SubscriptionRevocationCancelCallSchema,
    escalated: z.enum(['NO_RECIPIENT', 'DELIVERY_EXHAUSTED']).optional()
});

/** Response of the revocation. */
export type SubscriptionRevocationResponse = z.infer<typeof SubscriptionRevocationResponseSchema>;
