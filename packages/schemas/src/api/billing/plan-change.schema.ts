import { z } from 'zod';
import { BillingIntervalEnum } from '../../enums/billing-interval.enum.js';

/**
 * Plan change status enum
 * Defines the result status of a plan change operation
 */
export enum PlanChangeStatusEnum {
    /** Plan change applied immediately (upgrade) */
    ACTIVE = 'active',
    /** Plan change scheduled for end of billing period (downgrade) */
    SCHEDULED = 'scheduled'
}

/**
 * Zod schema for the PlanChangeStatusEnum
 */
export const PlanChangeStatusEnumSchema = z.nativeEnum(PlanChangeStatusEnum, {
    error: () => ({ message: 'zodError.billing.planChange.status.invalid' })
});

/**
 * Schema for plan change request body
 * Validates the input when a user requests to change their subscription plan
 */
export const PlanChangeRequestSchema = z.object({
    /** The ID of the target plan to change to */
    newPlanId: z
        .string({
            message: 'zodError.billing.planChange.newPlanId.invalidType'
        })
        .min(1, { message: 'zodError.billing.planChange.newPlanId.min' })
        .max(100, { message: 'zodError.billing.planChange.newPlanId.max' }),
    /** The billing interval for the new plan */
    billingInterval: z.nativeEnum(BillingIntervalEnum, {
        error: () => ({ message: 'zodError.billing.planChange.billingInterval.invalid' })
    })
});

/** TypeScript type inferred from PlanChangeRequestSchema */
export type PlanChangeRequest = z.infer<typeof PlanChangeRequestSchema>;

/**
 * Schema for plan change response body
 * Represents the result of a plan change operation
 */
export const PlanChangeResponseSchema = z.object({
    /** The subscription ID that was modified */
    subscriptionId: z
        .string({
            message: 'zodError.billing.planChange.subscriptionId.invalidType'
        })
        .min(1, { message: 'zodError.billing.planChange.subscriptionId.min' }),
    /** The plan ID before the change */
    previousPlanId: z
        .string({
            message: 'zodError.billing.planChange.previousPlanId.invalidType'
        })
        .min(1, { message: 'zodError.billing.planChange.previousPlanId.min' }),
    /** The new plan ID after the change */
    newPlanId: z
        .string({
            message: 'zodError.billing.planChange.newPlanId.invalidType'
        })
        .min(1, { message: 'zodError.billing.planChange.newPlanId.min' }),
    /** When the plan change takes effect (ISO 8601 datetime string) */
    effectiveAt: z
        .string({
            message: 'zodError.billing.planChange.effectiveAt.invalidType'
        })
        .datetime({ message: 'zodError.billing.planChange.effectiveAt.invalid' }),
    /** Prorated amount in ARS cents (only for upgrades) */
    proratedAmount: z
        .number({
            message: 'zodError.billing.planChange.proratedAmount.invalidType'
        })
        .min(0, { message: 'zodError.billing.planChange.proratedAmount.min' })
        .optional(),
    /** The result status of the plan change */
    status: PlanChangeStatusEnumSchema
});

/** TypeScript type inferred from PlanChangeResponseSchema */
export type PlanChangeResponse = z.infer<typeof PlanChangeResponseSchema>;
