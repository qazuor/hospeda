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
        .min(1, { message: 'zodError.billing.trial.reactivate.planId.min' })
});

/** TypeScript type inferred from ReactivateTrialRequestSchema */
export type ReactivateTrialRequest = z.infer<typeof ReactivateTrialRequestSchema>;

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
