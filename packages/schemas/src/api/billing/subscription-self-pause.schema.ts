import { z } from 'zod';

/** Params for the owner's pause routes. */
export const SelfSubscriptionPauseParamsSchema = z.strictObject({ subscriptionId: z.uuid() });

/** Customer-request pause duration. */
export const SelfSubscriptionPauseRequestSchema = z.strictObject({
    months: z.number().int().min(1).max(4)
});

/** Empty body for an early resume. */
export const SelfSubscriptionResumeRequestSchema = z.strictObject({});

/** Read-only pause explanation, including the refusal reason. */
export const SelfSubscriptionPausePreviewResponseSchema = z.discriminatedUnion('offered', [
    z.strictObject({
        offered: z.literal(false),
        reason: z.string(),
        courtesyEndsAt: z.string().datetime().optional()
    }),
    z.strictObject({
        offered: z.literal(true),
        months: z.strictObject({ min: z.literal(1), max: z.number().int().min(1).max(4) }),
        expectedEndAtByMonths: z.record(z.string(), z.string().datetime()),
        quota: z.strictObject({
            pausesLeft: z.number().int().nonnegative(),
            monthsLeft: z.number().int().nonnegative()
        }),
        addons: z.strictObject({
            vertical: z.array(z.string()),
            account: z.array(z.strictObject({ name: z.string(), pauses: z.boolean() }))
        })
    })
]);

const ComplementResultSchema = z.strictObject({
    complementSubscriptionId: z.uuid(),
    instanceId: z.uuid(),
    outcome: z.string(),
    markOutcome: z.enum(['OPENED', 'ACCUMULATED']).optional()
});

/** Successful owner pause. */
export const SelfSubscriptionPauseResponseSchema = z.strictObject({
    outcome: z.literal('PAUSED'),
    pauseId: z.uuid(),
    expectedEndAt: z.string().datetime(),
    complements: z.strictObject({ results: z.array(ComplementResultSchema) })
});

/** Successful owner early resume. */
export const SelfSubscriptionResumeResponseSchema = z.strictObject({
    outcome: z.literal('RESUMED'),
    nextCharge: z
        .strictObject({
            at: z.string().datetime(),
            amountMinor: z.number().int().nonnegative(),
            currency: z.string()
        })
        .nullable()
});
