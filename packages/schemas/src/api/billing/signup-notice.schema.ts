import { z } from 'zod';
import { BillingCycleSchema } from '../../catalog/plan-publication.schema.js';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';
import { CommitmentTakenBySchema } from './subscription-start.schema.js';

/**
 * The promo already applied to the pending subscription this plan belongs to
 * (HOS-2382). `amount` is what the provider will charge next, composed by the
 * same expected-amount policy the sweep compares against, so clients never
 * recompute it. `chargesLeft` is the number of charges the discount still
 * covers (the shortest of the live promos), `null` when it lasts forever.
 */
export const SignupNoticePromoSchema = z.object({
    codes: z.array(z.string().min(1)).min(1),
    amount: z.number().int().nonnegative(),
    chargesLeft: z.number().int().positive().nullable()
});

/** Plan, list amount in minor units and cycle of a billing option, plus its applied promo when one exists. */
export const SignupNoticePlanSchema = z.object({
    /** Stable plan slug, used by clients to localize the plan name. */
    slug: z.string().min(1).optional(),
    name: z.string().min(1),
    /** List price of the option. With `promo`, the amount charged is `promo.amount`. */
    amount: z.number().int().nonnegative(),
    currency: z.literal('ARS'),
    cycle: BillingCycleSchema,
    /** Present only when a live promo is applied to the pending subscription of this option. */
    promo: SignupNoticePromoSchema.optional()
});

/**
 * The trial half shown before signup: a running trial exposes its end date and
 * remaining days; `daysLeft` is the ceiling of the days remaining until
 * `endsAt` so the displayed count never understates the calendar interval.
 */
export const SignupNoticeResponseSchema = z.object({
    /** The plan, amount in minor units and cycle of the selected billing option, shown before the redirect. */
    plan: SignupNoticePlanSchema,
    /** A live pending attempt on another billing option in the selected vertical. */
    pendingAttempt: z.union([
        z.null(),
        z.object({
            subscriptionId: z.uuid(),
            plan: SignupNoticePlanSchema,
            checkoutUrl: z.url().nullable(),
            takenBy: CommitmentTakenBySchema.optional(),
            authorizationWindowEndsAt: z.iso.datetime()
        })
    ]),
    /** Optional detail of the live row blocking a fresh signup. */
    blockingCommitment: z
        .object({
            takenBy: CommitmentTakenBySchema,
            checkoutDeadline: z.iso.datetime().nullable()
        })
        .optional(),
    /** Vertical selected by the billing option. */
    vertical: VerticalEnumSchema,
    /** Tourist VIP status after a suspended plan holder returns to service. */
    touristVip: z.discriminatedUnion('status', [
        z.object({ status: z.literal('CANCELLED_ON_RETURN') }),
        /** The selected owner plan inherits Tourist VIP and cancels the paid VIP on activation. */
        z.object({
            status: z.literal('CANCELLED_ON_ACTIVATION'),
            paidUntil: z.iso.datetime().nullable()
        }),
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
