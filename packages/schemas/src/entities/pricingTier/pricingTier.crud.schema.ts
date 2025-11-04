import { z } from 'zod';
import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { PricingTierIdSchema, PricingTierRangeValidationSchema } from './pricingTier.schema.js';

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new pricing tier
 * Includes validation for quantity ranges and unit pricing
 */
export const PricingTierCreateInputSchema = z
    .object({
        pricingPlanId: z.string().uuid('pricingPlanId must be a valid UUID'),
        minQuantity: z.number().int().min(1, 'minQuantity must be at least 1'),
        maxQuantity: z.number().int().positive('maxQuantity must be positive').nullable(),
        unitPriceMinor: z.number().int().positive('unitPriceMinor must be positive')
    })
    .refine((data) => data.maxQuantity === null || data.maxQuantity > data.minQuantity, {
        message: 'maxQuantity must be greater than minQuantity when specified',
        path: ['maxQuantity']
    });

export type PricingTierCreateInput = z.infer<typeof PricingTierCreateInputSchema>;

/**
 * Schema for creating multiple pricing tiers with range validation
 * Ensures no overlapping quantity ranges within the same pricing plan
 */
export const PricingTierBulkCreateInputSchema = z
    .object({
        pricingPlanId: z.string().uuid(),
        tiers: z
            .array(
                z.object({
                    minQuantity: z.number().int().min(1),
                    maxQuantity: z.number().int().positive().nullable(),
                    unitPriceMinor: z.number().int().positive()
                })
            )
            .min(1, 'At least one tier is required')
    })
    .refine(
        (data) => {
            // Validate individual tier constraints first
            for (const tier of data.tiers) {
                if (tier.maxQuantity !== null && tier.maxQuantity <= tier.minQuantity) {
                    return false;
                }
            }

            // Then validate no overlapping ranges
            const validationResult = PricingTierRangeValidationSchema.safeParse(data);
            return validationResult.success;
        },
        {
            message: 'All tiers must have valid ranges and no overlapping quantity ranges',
            path: ['tiers']
        }
    );

export type PricingTierBulkCreateInput = z.infer<typeof PricingTierBulkCreateInputSchema>;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating pricing tier fields
 * All fields are optional for partial updates
 */
export const PricingTierUpdateInputSchema = z
    .object({
        minQuantity: z.number().int().min(1, 'minQuantity must be at least 1').optional(),
        maxQuantity: z
            .number()
            .int()
            .positive('maxQuantity must be positive')
            .nullable()
            .optional(),
        unitPriceMinor: z.number().int().positive('unitPriceMinor must be positive').optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()
    })
    .refine(
        (data) => {
            // If both quantities are provided, validate the constraint
            if (data.minQuantity !== undefined && data.maxQuantity !== undefined) {
                return data.maxQuantity === null || data.maxQuantity > data.minQuantity;
            }
            return true;
        },
        {
            message: 'maxQuantity must be greater than minQuantity when both are specified',
            path: ['maxQuantity']
        }
    );

export type PricingTierUpdateInput = z.infer<typeof PricingTierUpdateInputSchema>;

/**
 * Schema for updating pricing tier with context validation
 * Used when updating requires checking against existing tiers
 */
export const PricingTierUpdateWithContextSchema = z.object({
    id: PricingTierIdSchema,
    updates: PricingTierUpdateInputSchema,
    existingTiers: z
        .array(
            z.object({
                id: PricingTierIdSchema,
                minQuantity: z.number().int().min(1),
                maxQuantity: z.number().int().positive().nullable()
            })
        )
        .optional()
});

export type PricingTierUpdateWithContext = z.infer<typeof PricingTierUpdateWithContextSchema>;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for deleting a pricing tier
 */
export const PricingTierDeleteInputSchema = z.object({
    id: PricingTierIdSchema,
    force: z.boolean().default(false).describe('Whether to force delete (hard delete)')
});

export type PricingTierDeleteInput = z.infer<typeof PricingTierDeleteInputSchema>;

/**
 * Schema for bulk delete of pricing tiers
 */
export const PricingTierBulkDeleteInputSchema = z.object({
    ids: z.array(PricingTierIdSchema).min(1, 'At least one ID is required'),
    force: z.boolean().default(false).describe('Whether to force delete (hard delete)')
});

export type PricingTierBulkDeleteInput = z.infer<typeof PricingTierBulkDeleteInputSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Schema for validating pricing tier range updates
 * Used to ensure no range conflicts when updating existing tiers
 */
export const PricingTierRangeUpdateValidationSchema = z
    .object({
        pricingPlanId: z.string().uuid(),
        tierId: PricingTierIdSchema,
        newMinQuantity: z.number().int().min(1).optional(),
        newMaxQuantity: z.number().int().positive().nullable().optional(),
        existingTiers: z.array(
            z.object({
                id: PricingTierIdSchema,
                minQuantity: z.number().int().min(1),
                maxQuantity: z.number().int().positive().nullable()
            })
        )
    })
    .refine(
        (data) => {
            // Create a simulation of the updated tiers
            const updatedTiers = data.existingTiers.map((tier) => {
                if (tier.id === data.tierId) {
                    return {
                        ...tier,
                        minQuantity: data.newMinQuantity ?? tier.minQuantity,
                        maxQuantity:
                            data.newMaxQuantity !== undefined
                                ? data.newMaxQuantity
                                : tier.maxQuantity
                    };
                }
                return tier;
            });

            // Validate the simulated state
            const validationResult = PricingTierRangeValidationSchema.safeParse({
                pricingPlanId: data.pricingPlanId,
                tiers: updatedTiers
            });

            return validationResult.success;
        },
        {
            message: 'Updated pricing tier ranges must not overlap with existing tiers',
            path: ['newMinQuantity', 'newMaxQuantity']
        }
    );

export type PricingTierRangeUpdateValidation = z.infer<
    typeof PricingTierRangeUpdateValidationSchema
>;
