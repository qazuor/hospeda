import { z } from 'zod';

/**
 * Schema for starting a free trial.
 * An optional plan slug can be provided; if omitted the API selects the default trial plan.
 */
export const StartTrialRequestSchema = z.object({
    /** Slug of the plan to trial; uses platform default when omitted */
    planSlug: z
        .string({
            message: 'zodError.billing.trial.start.planSlug.invalidType'
        })
        .min(1, { message: 'zodError.billing.trial.start.planSlug.min' })
        .max(100, { message: 'zodError.billing.trial.start.planSlug.max' })
        .optional()
});

/** TypeScript type inferred from StartTrialRequestSchema */
export type StartTrialRequest = z.infer<typeof StartTrialRequestSchema>;

/**
 * Schema for reactivating a previously expired or cancelled trial.
 * Requires the ID of the plan to reinstate the trial on.
 */
export const ReactivateTrialRequestSchema = z.object({
    /** The ID of the plan to reactivate the trial for */
    planId: z
        .string({
            message: 'zodError.billing.trial.reactivate.planId.invalidType'
        })
        .min(1, { message: 'zodError.billing.trial.reactivate.planId.min' }),
    /**
     * Billing interval for the reactivated subscription (HOS-123).
     * Defaults to `'monthly'` (the pre-existing qzpay preapproval flow);
     * `'annual'` routes through the direct Drizzle-insert annual flow.
     */
    billingInterval: z
        .enum(['monthly', 'annual'], {
            message: 'zodError.billing.trial.reactivate.billingInterval.invalid'
        })
        .optional()
        .default('monthly')
});

/** TypeScript type inferred from ReactivateTrialRequestSchema */
export type ReactivateTrialRequest = z.infer<typeof ReactivateTrialRequestSchema>;

/**
 * Response body for `POST /api/v1/protected/billing/trial/reactivate`
 * (HOS-114, widened HOS-123).
 *
 * For `billingInterval: 'monthly'` (default), reactivation to a paid plan
 * routes through a real card-collecting MercadoPago checkout, mirroring
 * `/start-paid` — the caller MUST redirect the user to `checkoutUrl`. The
 * created subscription is `status: 'incomplete'` (qzpay's raw provider
 * status, NOT the normalized `SubscriptionStatusEnum` used for
 * locally-stored rows) until the `subscription_preapproval.created` webhook
 * confirms it.
 *
 * For `billingInterval: 'annual'`, there is no MercadoPago preapproval —
 * the subscription row is inserted directly via Drizzle for a one-time
 * charge instead. The response STILL carries a non-null `checkoutUrl` (the
 * real MercadoPago hosted-checkout URL) that the caller MUST redirect the
 * user to, exactly like the monthly path — annual reactivation never
 * returns `checkoutUrl: null`; a missing init point is treated as an error
 * (`MISSING_INIT_POINT`), not a valid null response. The only differences
 * from monthly are `status: 'pending_provider'` (the normalized
 * `SubscriptionStatusEnum` value) and the underlying charge mechanism
 * (one-time payment vs. preapproval).
 */
export const ReactivateTrialResponseSchema = z.object({
    success: z.boolean({
        message: 'zodError.billing.trial.reactivate.response.success.invalidType'
    }),
    subscriptionId: z
        .string({
            message: 'zodError.billing.trial.reactivate.response.subscriptionId.invalidType'
        })
        .nullable(),
    /** MercadoPago checkout URL the caller must redirect the user to. */
    checkoutUrl: z
        .string({
            message: 'zodError.billing.trial.reactivate.response.checkoutUrl.invalidType'
        })
        .url({ message: 'zodError.billing.trial.reactivate.response.checkoutUrl.invalid' })
        .nullable(),
    /**
     * Result status at creation time (HOS-123). `'incomplete'` is qzpay's raw
     * preapproval status for the monthly flow — the subscription is not yet
     * confirmed by MercadoPago. `'pending_provider'` is the normalized
     * `SubscriptionStatusEnum` value for the annual flow, which inserts the
     * subscription directly via Drizzle without a qzpay preapproval.
     */
    status: z.enum(['incomplete', 'pending_provider'], {
        message: 'zodError.billing.trial.reactivate.response.status.invalid'
    }),
    message: z.string({
        message: 'zodError.billing.trial.reactivate.response.message.invalidType'
    })
});

/** TypeScript type inferred from ReactivateTrialResponseSchema */
export type ReactivateTrialResponse = z.infer<typeof ReactivateTrialResponseSchema>;

/**
 * Schema for reactivating a canceled subscription (not necessarily a trial
 * conversion — see `ReactivateSubscriptionInput` in `@repo/service-core`).
 * Same shape as {@link ReactivateTrialRequestSchema}; kept as a distinct
 * schema so the two request contracts can evolve independently.
 */
export const ReactivateSubscriptionRequestSchema = z.object({
    /** The ID of the plan to reactivate the subscription for */
    planId: z
        .string({
            message: 'zodError.billing.trial.reactivateSubscription.planId.invalidType'
        })
        .min(1, { message: 'zodError.billing.trial.reactivateSubscription.planId.min' }),
    /**
     * Billing interval for the reactivated subscription (HOS-123).
     * Defaults to `'monthly'` (the pre-existing qzpay preapproval flow);
     * `'annual'` routes through the direct Drizzle-insert annual flow.
     */
    billingInterval: z
        .enum(['monthly', 'annual'], {
            message: 'zodError.billing.trial.reactivateSubscription.billingInterval.invalid'
        })
        .optional()
        .default('monthly')
});

/** TypeScript type inferred from ReactivateSubscriptionRequestSchema */
export type ReactivateSubscriptionRequest = z.infer<typeof ReactivateSubscriptionRequestSchema>;

/**
 * Response body for `POST /api/v1/protected/billing/trial/reactivate-subscription`
 * (HOS-114, widened HOS-123). Mirrors {@link ReactivateTrialResponseSchema}
 * (including the `'annual'` billing-interval / `'pending_provider'` status
 * path — annual reactivation ALWAYS returns a non-null `checkoutUrl`, the
 * real MercadoPago hosted-checkout URL, same as monthly), plus the previous
 * plan id carried over from the canceled subscription being reactivated.
 */
export const ReactivateSubscriptionResponseSchema = z.object({
    success: z.boolean({
        message: 'zodError.billing.trial.reactivateSubscription.response.success.invalidType'
    }),
    subscriptionId: z
        .string({
            message:
                'zodError.billing.trial.reactivateSubscription.response.subscriptionId.invalidType'
        })
        .nullable(),
    /** Previous plan ID (from the canceled subscription), or null. */
    previousPlanId: z
        .string({
            message:
                'zodError.billing.trial.reactivateSubscription.response.previousPlanId.invalidType'
        })
        .nullable()
        .optional(),
    /** MercadoPago checkout URL the caller must redirect the user to. */
    checkoutUrl: z
        .string({
            message:
                'zodError.billing.trial.reactivateSubscription.response.checkoutUrl.invalidType'
        })
        .url({
            message: 'zodError.billing.trial.reactivateSubscription.response.checkoutUrl.invalid'
        })
        .nullable(),
    /**
     * Result status at creation time (HOS-123). `'incomplete'` is qzpay's raw
     * preapproval status for the monthly flow — the subscription is not yet
     * confirmed by MercadoPago. `'pending_provider'` is the normalized
     * `SubscriptionStatusEnum` value for the annual flow, which inserts the
     * subscription directly via Drizzle without a qzpay preapproval.
     */
    status: z.enum(['incomplete', 'pending_provider'], {
        message: 'zodError.billing.trial.reactivateSubscription.response.status.invalid'
    }),
    message: z.string({
        message: 'zodError.billing.trial.reactivateSubscription.response.message.invalidType'
    })
});

/** TypeScript type inferred from ReactivateSubscriptionResponseSchema */
export type ReactivateSubscriptionResponse = z.infer<typeof ReactivateSubscriptionResponseSchema>;

/**
 * Schema for extending an active trial (admin operation).
 * Adds a specified number of extra days to the trial end date.
 */
export const ExtendTrialRequestSchema = z.object({
    /** The ID of the subscription whose trial period will be extended */
    subscriptionId: z
        .string({
            message: 'zodError.billing.trial.extend.subscriptionId.invalidType'
        })
        .min(1, { message: 'zodError.billing.trial.extend.subscriptionId.min' }),
    /** Number of additional days to add to the trial (1-90) */
    additionalDays: z
        .number({
            message: 'zodError.billing.trial.extend.additionalDays.invalidType'
        })
        .int({ message: 'zodError.billing.trial.extend.additionalDays.int' })
        .min(1, { message: 'zodError.billing.trial.extend.additionalDays.min' })
        .max(90, { message: 'zodError.billing.trial.extend.additionalDays.max' })
});

/** TypeScript type inferred from ExtendTrialRequestSchema */
export type ExtendTrialRequest = z.infer<typeof ExtendTrialRequestSchema>;
