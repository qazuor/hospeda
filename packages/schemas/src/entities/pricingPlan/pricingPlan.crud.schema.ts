import { z } from 'zod';
import { ProductIdSchema } from '../../common/id.schema.js';
import { BillingIntervalEnumSchema } from '../../enums/billing-interval.schema.js';
import { BillingSchemeEnum } from '../../enums/billing-scheme.enum.js';
import { BillingSchemeEnumSchema } from '../../enums/billing-scheme.schema.js';
import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { PricingPlanIdSchema } from './pricingPlan.schema.js';

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new pricing plan
 * Includes conditional validation for billing scheme and interval
 */
export const PricingPlanCreateInputSchema = z
    .object({
        productId: ProductIdSchema,
        billingScheme: BillingSchemeEnumSchema,
        interval: BillingIntervalEnumSchema.optional(),
        amountMinor: z
            .number()
            .int({ message: 'zodError.pricingPlan.amountMinor.integer' })
            .min(0, { message: 'zodError.pricingPlan.amountMinor.positive' }),
        currency: z
            .string()
            .length(3, { message: 'zodError.pricingPlan.currency.length' })
            .regex(/^[A-Z]{3}$/, { message: 'zodError.pricingPlan.currency.format' }),
        metadata: z.record(z.string(), z.any()).default({}),

        // Lifecycle field with default
        lifecycleState: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default(LifecycleStatusEnum.ACTIVE)
    })
    .refine(
        (data) => {
            // Conditional validation: interval required for RECURRING, forbidden for ONE_TIME
            if (data.billingScheme === BillingSchemeEnum.RECURRING) {
                return data.interval !== undefined;
            }
            if (data.billingScheme === BillingSchemeEnum.ONE_TIME) {
                return data.interval === undefined;
            }
            return true;
        },
        {
            message: 'Interval is required for RECURRING billing scheme and forbidden for ONE_TIME',
            path: ['interval']
        }
    );

export type PricingPlanCreateInput = z.infer<typeof PricingPlanCreateInputSchema>;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating pricing plan
 * Partial version of create schema with same conditional validation
 */
export const PricingPlanUpdateInputSchema = PricingPlanCreateInputSchema.partial().refine(
    (data) => {
        // Only validate if billingScheme is provided in update
        if (data.billingScheme !== undefined) {
            if (data.billingScheme === BillingSchemeEnum.RECURRING) {
                return data.interval !== undefined;
            }
            if (data.billingScheme === BillingSchemeEnum.ONE_TIME) {
                return data.interval === undefined;
            }
        }
        return true;
    },
    {
        message: 'Interval is required for RECURRING billing scheme and forbidden for ONE_TIME',
        path: ['interval']
    }
);

export type PricingPlanUpdateInput = z.infer<typeof PricingPlanUpdateInputSchema>;

// ============================================================================
// DELETE & RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for deleting pricing plan with soft/hard delete option
 */
export const PricingPlanDeleteSchema = z.object({
    id: PricingPlanIdSchema,
    permanent: z.boolean().default(false)
});

export type PricingPlanDelete = z.infer<typeof PricingPlanDeleteSchema>;

/**
 * Schema for restoring soft-deleted pricing plan
 */
export const PricingPlanRestoreSchema = z.object({
    id: PricingPlanIdSchema
});

export type PricingPlanRestore = z.infer<typeof PricingPlanRestoreSchema>;

// ============================================================================
// BULK OPERATION SCHEMAS
// ============================================================================

/**
 * Schema for bulk creating pricing plans
 */
export const PricingPlanBulkCreateInputSchema = z.object({
    items: z.array(PricingPlanCreateInputSchema).min(1).max(100)
});

export type PricingPlanBulkCreateInput = z.infer<typeof PricingPlanBulkCreateInputSchema>;

/**
 * Schema for bulk updating pricing plans
 */
export const PricingPlanBulkUpdateInputSchema = z.object({
    items: z
        .array(
            z.object({
                id: PricingPlanIdSchema,
                ...PricingPlanUpdateInputSchema.shape
            })
        )
        .min(1)
        .max(100)
});

export type PricingPlanBulkUpdateInput = z.infer<typeof PricingPlanBulkUpdateInputSchema>;

/**
 * Schema for bulk deleting pricing plans
 */
export const PricingPlanBulkDeleteInputSchema = z.object({
    ids: z.array(PricingPlanIdSchema).min(1).max(100),
    permanent: z.boolean().default(false)
});

export type PricingPlanBulkDeleteInput = z.infer<typeof PricingPlanBulkDeleteInputSchema>;
