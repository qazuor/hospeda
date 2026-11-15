import { z } from 'zod';

/** Confirmed administrative courtesy revocation request. */
export const AdminSubscriptionCourtesyRevokeRequestSchema = z.strictObject({
    expectedStatus: z.literal('PAUSED'),
    confirmed: z.literal(true),
    note: z.string().trim().min(1).max(2000).optional()
});

/** Successful administrative courtesy revocation response. */
export const AdminSubscriptionCourtesyRevokeResponseSchema = z.strictObject({
    outcome: z.literal('RESUMED'),
    nextCharge: z
        .strictObject({
            at: z.string().datetime(),
            amountMinor: z.number().int().nonnegative(),
            currency: z.string()
        })
        .nullable()
});
