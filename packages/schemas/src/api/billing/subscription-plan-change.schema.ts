import { z } from 'zod';

/** Parameters for the owner plan change route. */
export const SubscriptionPlanChangeParamsSchema = z.strictObject({ subscriptionId: z.uuid() });

/** Destination and optional listing selection; the server chooses direction. */
export const SubscriptionPlanChangeRequestSchema = z.strictObject({
    billingOptionId: z.uuid(),
    payerEmail: z.email().optional(),
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
