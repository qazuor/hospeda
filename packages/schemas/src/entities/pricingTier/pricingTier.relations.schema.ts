import { z } from 'zod';
import { AccommodationSchema } from '../accommodation/accommodation.schema.js';
import { PricingPlanSchema } from '../pricingPlan/pricingPlan.schema.js';
import { ProductSchema } from '../product/product.schema.js';
import {
    PricingTierBulkCreateInputSchema,
    PricingTierCreateInputSchema,
    PricingTierUpdateInputSchema
} from './pricingTier.crud.schema.js';
import { PricingTierRangeValidationSchema, PricingTierSchema } from './pricingTier.schema.js';

// ============================================================================
// PRICING TIER WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Pricing tier with pricing plan information
 * Includes the parent pricing plan data for context
 */
export const PricingTierWithPlanSchema = PricingTierSchema.extend({
    pricingPlan: PricingPlanSchema
});

export type PricingTierWithPlan = z.infer<typeof PricingTierWithPlanSchema>;

/**
 * Pricing tier with complete product hierarchy
 * Includes pricing plan, product, and accommodation relations
 */
export const PricingTierWithRelationsSchema = PricingTierSchema.extend({
    pricingPlan: PricingPlanSchema.extend({
        product: ProductSchema.extend({
            accommodation: AccommodationSchema.optional()
        })
    })
});

export type PricingTierWithRelations = z.infer<typeof PricingTierWithRelationsSchema>;

/**
 * Minimal pricing tier schema for lightweight operations
 * Contains only essential fields for basic tier operations
 */
export const PricingTierMinimalSchema = PricingTierSchema.pick({
    id: true,
    pricingPlanId: true,
    minQuantity: true,
    maxQuantity: true,
    unitPriceMinor: true,
    lifecycleState: true
});

export type PricingTierMinimal = z.infer<typeof PricingTierMinimalSchema>;

/**
 * Pricing tier summary schema for listing views
 * Optimized for displaying multiple tiers efficiently
 */
export const PricingTierSummarySchema = PricingTierMinimalSchema.extend({
    quantityRange: z.string(),
    isUnlimited: z.boolean(),
    formattedPrice: z.string().optional()
});

export type PricingTierSummary = z.infer<typeof PricingTierSummarySchema>;

// ============================================================================
// TIER HIERARCHY AND STRUCTURE SCHEMAS
// ============================================================================

/**
 * Schema for pricing tier with position in hierarchy
 * Includes position-based information for tier ordering
 */
export const PricingTierWithPositionSchema = PricingTierSchema.extend({
    position: z.number().int().min(0),
    isFirst: z.boolean(),
    isLast: z.boolean(),
    hasGapBefore: z.boolean(),
    hasGapAfter: z.boolean(),
    nextTierStartsAt: z.number().int().positive().nullable(),
    prevTierEndsAt: z.number().int().positive().nullable()
});

export type PricingTierWithPosition = z.infer<typeof PricingTierWithPositionSchema>;

/**
 * Schema for complete pricing tier structure within a plan
 * Represents all tiers with their relationships and coverage
 */
export const PricingTierStructureSchema = z.object({
    pricingPlanId: z.string().uuid(),
    tiers: z.array(PricingTierWithPositionSchema),
    totalTiers: z.number().int().min(0),
    coverage: z.object({
        minCoveredQuantity: z.number().int().min(1),
        maxCoveredQuantity: z.number().int().positive().nullable(), // null if unlimited
        hasUnlimitedTier: z.boolean(),
        gaps: z.array(
            z.object({
                fromQuantity: z.number().int().positive(),
                toQuantity: z.number().int().positive()
            })
        )
    }),
    statistics: z.object({
        averageUnitPrice: z.bigint(),
        lowestUnitPrice: z.bigint(),
        highestUnitPrice: z.bigint(),
        totalQuantityRange: z.number().int().min(0).nullable()
    })
});

export type PricingTierStructure = z.infer<typeof PricingTierStructureSchema>;

// ============================================================================
// BULK OPERATIONS WITH RELATIONS
// ============================================================================

/**
 * Schema for creating pricing tiers with plan validation
 * Ensures the target pricing plan exists and is valid
 */
export const PricingTierCreateWithPlanValidationSchema = PricingTierCreateInputSchema.extend({
    validatePlanExists: z.boolean().default(true),
    allowInactivePlan: z.boolean().default(false)
});

export type PricingTierCreateWithPlanValidation = z.infer<
    typeof PricingTierCreateWithPlanValidationSchema
>;

/**
 * Schema for bulk tier creation with complete validation
 * Includes plan validation and tier range overlap checking
 */
export const PricingTierBulkCreateWithValidationSchema = PricingTierBulkCreateInputSchema.extend({
    validatePlanExists: z.boolean().default(true),
    allowInactivePlan: z.boolean().default(false),
    replaceExisting: z.boolean().default(false),
    preserveExistingTiers: z.array(z.string().uuid()).optional()
});

export type PricingTierBulkCreateWithValidation = z.infer<
    typeof PricingTierBulkCreateWithValidationSchema
>;

/**
 * Schema for tier updates with plan context
 * Includes current plan state for validation
 */
export const PricingTierUpdateWithPlanContextSchema = PricingTierUpdateInputSchema.extend({
    currentPlanId: z.string().uuid(),
    validatePlanActive: z.boolean().default(true),
    checkRangeConflicts: z.boolean().default(true),
    existingTierIds: z.array(z.string().uuid()).optional()
});

export type PricingTierUpdateWithPlanContext = z.infer<
    typeof PricingTierUpdateWithPlanContextSchema
>;

// ============================================================================
// TIER RELATIONSHIP VALIDATION SCHEMAS
// ============================================================================

/**
 * Schema for validating tier relationships within a plan
 * Ensures tier consistency and proper hierarchy
 */
export const PricingTierRelationshipValidationSchema = z
    .object({
        pricingPlanId: z.string().uuid(),
        tiers: z.array(
            z.object({
                id: z.string().uuid(),
                minQuantity: z.number().int().min(1),
                maxQuantity: z.number().int().positive().nullable(),
                unitPriceMinor: z.bigint().positive(),
                position: z.number().int().min(0).optional()
            })
        ),
        rules: z
            .object({
                allowGaps: z.boolean().default(false),
                requireContinuousRange: z.boolean().default(true),
                allowPriceIncreases: z.boolean().default(false),
                allowPriceDecreases: z.boolean().default(true),
                maxTiersPerPlan: z.number().int().positive().default(10)
            })
            .optional()
    })
    .refine(
        (data) => {
            // Use the existing range validation logic
            const rangeValidation = PricingTierRangeValidationSchema.safeParse({
                pricingPlanId: data.pricingPlanId,
                tiers: data.tiers
            });

            if (!rangeValidation.success) {
                return false;
            }

            // Additional relationship validations
            const rules = data.rules || {
                allowGaps: false,
                requireContinuousRange: true,
                allowPriceIncreases: false,
                allowPriceDecreases: true,
                maxTiersPerPlan: 10
            };
            const sortedTiers = [...data.tiers].sort((a, b) => a.minQuantity - b.minQuantity);

            // Check tier count limit
            if (data.tiers.length > rules.maxTiersPerPlan) {
                return false;
            }

            // Check price progression rules
            if (rules.allowPriceIncreases === false || rules.allowPriceDecreases === false) {
                for (let i = 1; i < sortedTiers.length; i++) {
                    const prevPrice = sortedTiers[i - 1]?.unitPriceMinor;
                    const currPrice = sortedTiers[i]?.unitPriceMinor;

                    if (!prevPrice || !currPrice) continue;

                    if (rules.allowPriceIncreases === false && currPrice > prevPrice) {
                        return false;
                    }
                    if (rules.allowPriceDecreases === false && currPrice < prevPrice) {
                        return false;
                    }
                }
            }

            return true;
        },
        {
            message: 'Pricing tier relationships violate the specified rules',
            path: ['tiers']
        }
    );

export type PricingTierRelationshipValidation = z.infer<
    typeof PricingTierRelationshipValidationSchema
>;

// ============================================================================
// NESTED CRUD OPERATIONS
// ============================================================================

/**
 * Schema for creating pricing plan with initial tiers
 * Allows atomic creation of plan and its tier structure
 */
export const PricingPlanWithTiersCreateSchema = z.object({
    plan: z.object({
        productId: z.string().uuid(),
        billingScheme: z.string(),
        interval: z.string().optional(),
        amountMinor: z.number().int().min(0),
        currency: z.string().length(3),
        metadata: z.record(z.string(), z.any()).default({})
    }),
    tiers: z
        .array(
            z.object({
                minQuantity: z.number().int().min(1),
                maxQuantity: z.number().int().positive().nullable(),
                unitPriceMinor: z.bigint().positive()
            })
        )
        .min(1, 'At least one tier is required'),
    validateTierRanges: z.boolean().default(true)
});

export type PricingPlanWithTiersCreate = z.infer<typeof PricingPlanWithTiersCreateSchema>;

/**
 * Schema for complex tier reorganization
 * Supports reordering, merging, and splitting tier ranges
 */
export const PricingTierReorganizationSchema = z.object({
    pricingPlanId: z.string().uuid(),
    operations: z.array(
        z.discriminatedUnion('type', [
            z.object({
                type: z.literal('create'),
                tier: z.object({
                    minQuantity: z.number().int().min(1),
                    maxQuantity: z.number().int().positive().nullable(),
                    unitPriceMinor: z.bigint().positive()
                })
            }),
            z.object({
                type: z.literal('update'),
                tierId: z.string().uuid(),
                changes: PricingTierUpdateInputSchema
            }),
            z.object({
                type: z.literal('delete'),
                tierId: z.string().uuid()
            }),
            z.object({
                type: z.literal('reorder'),
                tierId: z.string().uuid(),
                newPosition: z.number().int().min(0)
            })
        ])
    ),
    validateFinalState: z.boolean().default(true),
    allowTemporaryInconsistency: z.boolean().default(false)
});

export type PricingTierReorganization = z.infer<typeof PricingTierReorganizationSchema>;
