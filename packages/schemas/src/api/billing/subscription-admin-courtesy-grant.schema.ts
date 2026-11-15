import { z } from 'zod';

const CourtesySchema = z.strictObject({
    courtesyGrantId: z.uuid(),
    endsAt: z.string().datetime(),
    remainingMonths: z.number().int().nonnegative()
});

/** Confirmed temporary courtesy grant request. */
export const AdminSubscriptionCourtesyGrantRequestSchema = z.strictObject({
    expectedStatus: z.enum(['ACTIVE', 'PAUSED']),
    months: z.number().int().min(1),
    reason: z.string().trim().min(1),
    confirmed: z.literal(true)
});

/** Grant preview query, validated before the handler. */
export const AdminSubscriptionCourtesyGrantPreviewQuerySchema = z.strictObject({
    months: z.coerce.number().int().min(1)
});

/** Successful S9 or S34 grant response. */
export const AdminSubscriptionCourtesyGrantResponseSchema = z.strictObject({
    outcome: z.enum(['GRANTED', 'EXTENDED']),
    courtesyGrantId: z.uuid(),
    endsAt: z.string().datetime()
});

/** Read-only S9 or S34 preview for an administrative confirmation. */
export const AdminSubscriptionCourtesyGrantPreviewResponseSchema = z.strictObject({
    subscriptionId: z.uuid(),
    status: z.string().nullable(),
    cycle: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']).nullable(),
    offered: z.boolean(),
    reason: z.string().optional(),
    alternatives: z.tuple([z.literal('PERMANENT_GRANT'), z.literal('RENEWAL_PROMO')]).optional(),
    liveCourtesy: CourtesySchema.nullable(),
    months: z.number().int().min(1),
    endsAt: z.string().datetime()
});

/** Read-only S10 preview for an administrative confirmation. */
export const AdminSubscriptionCourtesyRevokePreviewResponseSchema = z.strictObject({
    subscriptionId: z.uuid(),
    status: z.string().nullable(),
    cycle: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']).nullable(),
    inForce: z.boolean(),
    reason: z.literal('COURTESY_NOT_IN_FORCE').optional(),
    courtesy: CourtesySchema.nullable(),
    predictedNextChargeAt: z.string().datetime().nullable()
});
