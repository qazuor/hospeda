import { z } from 'zod';

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
            paidAfterCancellation: z.object({ recurringAddonsCut: z.boolean() }).nullable()
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
