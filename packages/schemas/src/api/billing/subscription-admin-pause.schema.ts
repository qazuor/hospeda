import { z } from 'zod';

/** Params for administrative pause and resume actions. */
export const AdminSubscriptionPauseParamsSchema = z.strictObject({
    subscriptionId: z.string().uuid()
});

/** Confirmed customer-request pause with the state seen by the administrator. */
export const AdminSubscriptionPauseRequestSchema = z.strictObject({
    months: z.number().int().min(1).max(4),
    expectedStatus: z.literal('ACTIVE'),
    confirmed: z.literal(true),
    note: z.string().trim().min(1).max(2000).optional()
});

/** Confirmed early return from a customer-request pause. */
export const AdminSubscriptionResumeRequestSchema = z.strictObject({
    expectedStatus: z.literal('PAUSED'),
    confirmed: z.literal(true),
    note: z.string().trim().min(1).max(2000).optional()
});

/** Read-only eligibility and current pause details for administrative confirmation. */
export const AdminSubscriptionPausePreviewResponseSchema = z.strictObject({
    subscriptionId: z.string().uuid(),
    status: z.string(),
    offered: z.boolean(),
    reason: z.string().optional(),
    courtesyEndsAt: z.string().datetime().optional(),
    quota: z.strictObject({
        pausesLeft: z.number().int().nonnegative(),
        monthsLeft: z.number().int().nonnegative()
    }),
    openPause: z
        .strictObject({
            reason: z.enum(['CUSTOMER_REQUEST', 'COURTESY']),
            expectedEndAt: z.string().datetime().nullable()
        })
        .nullable()
});

const ComplementResultSchema = z.strictObject({
    complementSubscriptionId: z.string().uuid(),
    instanceId: z.string().uuid(),
    outcome: z.string(),
    markOutcome: z.enum(['OPENED', 'ACCUMULATED']).optional()
});

/** Successful S8 administrative pause. */
export const AdminSubscriptionPauseResponseSchema = z.strictObject({
    subscriptionId: z.string().uuid(),
    outcome: z.literal('PAUSED'),
    pauseId: z.string().uuid(),
    expectedEndAt: z.string().datetime(),
    complements: z.strictObject({ results: z.array(ComplementResultSchema) })
});

/** Successful S10 administrative early return. */
export const AdminSubscriptionResumeResponseSchema = z.strictObject({
    subscriptionId: z.string().uuid(),
    outcome: z.literal('RESUMED'),
    nextCharge: z
        .strictObject({
            at: z.string().datetime(),
            amountMinor: z.number().int().nonnegative(),
            currency: z.string()
        })
        .nullable()
});
