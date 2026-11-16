import { z } from 'zod';

/** Parameters for the owner plan change route. */
export const SubscriptionPlanChangeParamsSchema = z.strictObject({ subscriptionId: z.uuid() });

/**
 * Destination and optional listing selection; the server chooses direction.
 * `payerEmail` is required, like the signup's (HOS-2218): the payer declares the
 * provider account email that will authorize a succession. It is not a confirmed
 * email and is never stored as one; the form prefills the one already declared.
 */
export const SubscriptionPlanChangeRequestSchema = z.strictObject({
    billingOptionId: z.uuid(),
    payerEmail: z.string().trim().email().max(255),
    keepSelection: z.record(z.string(), z.array(z.string())).optional()
});

/** Every successful plan change outcome. */
export const SubscriptionPlanChangeResponseSchema = z.discriminatedUnion('outcome', [
    z.strictObject({
        outcome: z.literal('SUCCESSION'),
        subscriptionId: z.uuid(),
        checkoutUrl: z.url(),
        firstChargeAt: z.iso.datetime(),
        creditDays: z.number().int().nonnegative()
    }),
    z.strictObject({
        outcome: z.literal('DOWNGRADE'),
        effectiveAt: z.iso.datetime(),
        amountMinor: z.number().int().nonnegative(),
        replaced: z.literal(true).optional(),
        surplus: z.discriminatedUnion('applicable', [
            z.strictObject({ applicable: z.literal(false) }),
            z.strictObject({
                applicable: z.literal(true),
                limitKey: z.string(),
                targetLimit: z.number().int().nullable(),
                publishedCount: z.number().int(),
                surplusCount: z.number().int(),
                willLower: z.array(z.strictObject({ id: z.uuid() })),
                criterion: z.literal('MOST_RECENTLY_PUBLISHED_FIRST'),
                criterionI18nKey: z.literal('listing.notices.surplus.criterion')
            })
        ])
    }),
    z.strictObject({ outcome: z.literal('REGRET'), amountMinor: z.number().int().nonnegative() })
]);
