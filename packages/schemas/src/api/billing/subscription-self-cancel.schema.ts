import { z } from 'zod';
import { BillingCycleSchema } from '../../catalog/plan-publication.schema.js';
import { CancellationReasonSchema } from '../../enums/cancellation-reason.schema.js';

/** Optional closed-list reason given by the owner when cancelling. */
export const SubscriptionCancellationRequestSchema = z.strictObject({
    reason: CancellationReasonSchema.optional()
});
export type SubscriptionCancellationRequest = z.infer<typeof SubscriptionCancellationRequestSchema>;

/** The plan and billing option this subscription is ANCHORED to (never the current catalog version); amount in minor units, list price without promotions. */
export const OwnSubscriptionPlanSchema = z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    amount: z.number().int().nonnegative(),
    currency: z.literal('ARS'),
    cycle: BillingCycleSchema
});

/** The next charge the provider will make, only for an ACTIVE card subscription whose provider date is known and in the future; amount composes live promotions and a scheduled change effective on that date. Null otherwise. */
export const OwnSubscriptionNextChargeSchema = z
    .object({
        at: z.string().datetime(),
        amount: z.number().int().nonnegative(),
        currency: z.literal('ARS')
    })
    .nullable();

/** A principal subscription shown on the owner's billing page. */
export const OwnSubscriptionsResponseSchema = z.object({
    subscriptions: z.array(
        z.object({
            id: z.string().uuid(),
            vertical: z.string(),
            status: z.enum(['ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCEL_SCHEDULED']),
            paymentMethod: z.enum(['CARD', 'MANUAL']),
            serviceEndsAt: z.string().datetime().nullable(),
            graceEndsAt: z.string().datetime().nullable(),
            createdAt: z.string().datetime(),
            /** A payment arrived after cancellation was already requested; addon billing outcome. */
            paidAfterCancellation: z.object({ recurringAddonsCut: z.boolean() }).nullable(),
            plan: OwnSubscriptionPlanSchema,
            nextCharge: OwnSubscriptionNextChargeSchema
        })
    ),
    /** Deferred courtesy terms from glossary §2.6, for display only. */
    deferredCourtesies: z.array(
        z.object({
            courtesyGrantId: z.string().uuid(),
            vertical: z.string(),
            balanceMonths: z.number().int().nonnegative()
        })
    )
});

/** Recurrent addon effects disclosed before confirming cancellation. */
export const CancellationPreviewAddonSchema = z.object({
    addonInstanceId: z.string().uuid(),
    name: z.string(),
    price: z.number().int(),
    currency: z.literal('ARS'),
    cycle: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']),
    whenOff: z.enum(['CHARGE_CUT_TODAY', 'AT_SERVICE_END', 'TODAY'])
});

/** A cancellation preview, discriminated by the subscription's current origin. */
export const SubscriptionCancellationPreviewResponseSchema = z.discriminatedUnion('origin', [
    z.object({
        subscriptionId: z.string().uuid(),
        vertical: z.string(),
        paymentMethod: z.enum(['CARD', 'MANUAL']),
        origin: z.literal('ACTIVE'),
        serviceEndsAt: z.string().datetime(),
        addons: z.array(CancellationPreviewAddonSchema)
    }),
    z.object({
        subscriptionId: z.string().uuid(),
        vertical: z.string(),
        paymentMethod: z.enum(['CARD', 'MANUAL']),
        origin: z.literal('GRACE_PERIOD'),
        graceEndsAt: z.string().datetime(),
        addons: z.array(CancellationPreviewAddonSchema)
    }),
    z.object({
        subscriptionId: z.string().uuid(),
        vertical: z.string(),
        paymentMethod: z.enum(['CARD', 'MANUAL']),
        origin: z.literal('SUSPENDED'),
        addons: z.array(CancellationPreviewAddonSchema)
    }),
    z.object({
        subscriptionId: z.string().uuid(),
        vertical: z.string(),
        paymentMethod: z.enum(['CARD', 'MANUAL']),
        origin: z.literal('CANCEL_SCHEDULED'),
        serviceEndsAt: z.string().datetime(),
        addons: z.array(CancellationPreviewAddonSchema)
    })
]);

/** Minimal result of a self-service cancellation act. */
export const SubscriptionCancellationResponseSchema = z.object({
    subscriptionId: z.string().uuid(),
    outcome: z.enum(['SCHEDULED', 'ALREADY_SCHEDULED', 'CANCELLED', 'ALREADY_CANCELLED']),
    serviceEndsAt: z.string().datetime().nullable()
});

/** Path parameters for a self-service cancellation route. */
export const SubscriptionCancellationParamsSchema = z.object({ subscriptionId: z.string().uuid() });
