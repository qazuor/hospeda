import { z } from 'zod';
import { BillingCycleSchema } from '../../catalog/plan-publication.schema.js';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';

/**
 * The trial half shown before signup: a running trial exposes its end date and
 * remaining days; `daysLeft` is the ceiling of the days remaining until
 * `endsAt` so the displayed count never understates the calendar interval.
 */
export const SignupNoticeResponseSchema = z.object({
    /** The plan, amount in minor units and cycle of the selected billing option, shown before the redirect. */
    plan: z.object({
        /** Stable plan slug, used by clients to localize the plan name. */
        slug: z.string().min(1).optional(),
        name: z.string().min(1),
        amount: z.number().int().nonnegative(),
        currency: z.literal('ARS'),
        cycle: BillingCycleSchema
    }),
    /** A live pending attempt on another billing option in the selected vertical. */
    pendingAttempt: z.union([
        z.null(),
        z.object({
            subscriptionId: z.uuid(),
            plan: z.object({
                /** Stable plan slug, used by clients to localize the plan name. */
                slug: z.string().min(1).optional(),
                name: z.string().min(1),
                amount: z.number().int().nonnegative(),
                currency: z.literal('ARS'),
                cycle: BillingCycleSchema
            }),
            checkoutUrl: z.url().nullable(),
            authorizationWindowEndsAt: z.iso.datetime()
        })
    ]),
    /** Vertical selected by the billing option. */
    vertical: VerticalEnumSchema,
    /** Tourist VIP status after a suspended plan holder returns to service. */
    touristVip: z.discriminatedUnion('status', [
        z.object({ status: z.literal('CANCELLED_ON_RETURN') }),
        z.object({ status: z.literal('NOT_AFFECTED') })
    ]),
    /** Trial state for this user in the selected vertical. */
    trial: z.discriminatedUnion('status', [
        z.object({
            status: z.literal('RUNNING'),
            endsAt: z.string().datetime({ offset: true }),
            daysLeft: z.number().int().positive()
        }),
        z.object({ status: z.literal('NOT_RUNNING') })
    ])
});

/** Response used to explain the trial consequences before signup confirmation. */
export type SignupNoticeResponse = z.infer<typeof SignupNoticeResponseSchema>;
