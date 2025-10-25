import { z } from 'zod';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import { PricingTierIdSchema } from './pricingTier.schema.js';

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for searching pricing tiers with filters
 * Supports filtering by pricing plan, quantity ranges, and price ranges
 */
export const PricingTierSearchSchema = BaseSearchSchema.extend({
    // Pricing plan relationship filter
    pricingPlanId: z.string().uuid().optional(),

    // Quantity range filters
    minQuantityMin: z.number().int().min(1).optional(),
    minQuantityMax: z.number().int().min(1).optional(),
    maxQuantityMin: z.number().int().positive().optional(),
    maxQuantityMax: z.number().int().positive().optional(),

    // Support for finding tiers that include a specific quantity
    includesQuantity: z.number().int().min(1).optional(),

    // Price range filters (in minor currency units)
    unitPriceMinorMin: z.bigint().positive().optional(),
    unitPriceMinorMax: z.bigint().positive().optional(),

    // Lifecycle and status filters
    lifecycleState: LifecycleStatusEnumSchema.optional(),

    // Date range filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),
    updatedAfter: z.date().optional(),
    updatedBefore: z.date().optional(),

    // Special filters
    hasUnlimitedMax: z.boolean().optional(), // Filter for tiers with maxQuantity = null
    isActive: z.boolean().optional() // Convenience filter for ACTIVE lifecycle state
});

export type PricingTierSearch = z.infer<typeof PricingTierSearchSchema>;

/**
 * Schema for finding the best pricing tier for a specific quantity
 * Used in pricing calculations
 */
export const PricingTierLookupSchema = z.object({
    pricingPlanId: z.string().uuid(),
    quantity: z.number().int().min(1),
    includeInactive: z.boolean().default(false)
});

export type PricingTierLookup = z.infer<typeof PricingTierLookupSchema>;

/**
 * Schema for validating pricing tier ordering and gaps
 * Used for plan validation and optimization
 */
export const PricingTierAnalysisSchema = z.object({
    pricingPlanId: z.string().uuid(),
    includeInactive: z.boolean().default(false)
});

export type PricingTierAnalysis = z.infer<typeof PricingTierAnalysisSchema>;

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

/**
 * Schema for individual pricing tier item in search results
 */
export const PricingTierItemSchema = z.object({
    id: PricingTierIdSchema,
    pricingPlanId: z.string().uuid(),
    minQuantity: z.number().int().min(1),
    maxQuantity: z.number().int().positive().nullable(),
    unitPriceMinor: z.bigint(),
    lifecycleState: LifecycleStatusEnumSchema,
    createdAt: z.date(),
    updatedAt: z.date(),

    // Optional computed fields
    quantityRange: z.string().optional(), // e.g., "1-10", "11-50", "51+"
    isUnlimited: z.boolean().optional() // true if maxQuantity is null
});

export type PricingTierItem = z.infer<typeof PricingTierItemSchema>;

/**
 * Schema for paginated pricing tier search results
 */
export const PricingTierSearchResultSchema = PaginationResultSchema(PricingTierItemSchema);

export type PricingTierSearchResult = z.infer<typeof PricingTierSearchResultSchema>;

/**
 * Schema for pricing tier lookup result
 */
export const PricingTierLookupResultSchema = z.object({
    tier: PricingTierItemSchema.nullable(),
    found: z.boolean(),
    quantity: z.number().int(),
    totalPrice: z.bigint().optional() // quantity * unitPriceMinor
});

export type PricingTierLookupResult = z.infer<typeof PricingTierLookupResultSchema>;

/**
 * Schema for pricing tier analysis result
 */
export const PricingTierAnalysisResultSchema = z.object({
    pricingPlanId: z.string().uuid(),
    totalTiers: z.number().int().min(0),
    hasGaps: z.boolean(),
    hasOverlaps: z.boolean(),
    gaps: z.array(
        z.object({
            fromQuantity: z.number().int(),
            toQuantity: z.number().int()
        })
    ),
    overlaps: z.array(
        z.object({
            tier1Id: PricingTierIdSchema,
            tier2Id: PricingTierIdSchema,
            conflictRange: z.object({
                min: z.number().int(),
                max: z.number().int()
            })
        })
    ),
    hasUnlimitedTier: z.boolean(),
    unlimitedTierStartsAt: z.number().int().optional(),
    maxCoveredQuantity: z.number().int().nullable(), // null if unlimited tier exists
    recommendations: z.array(z.string()).optional()
});

export type PricingTierAnalysisResult = z.infer<typeof PricingTierAnalysisResultSchema>;

// ============================================================================
// SORTING SCHEMAS
// ============================================================================

/**
 * Available sorting options for pricing tiers
 */
export const PricingTierSortFieldSchema = z.enum([
    'minQuantity',
    'maxQuantity',
    'unitPriceMinor',
    'createdAt',
    'updatedAt',
    'lifecycleState'
]);

export type PricingTierSortField = z.infer<typeof PricingTierSortFieldSchema>;

/**
 * Schema for pricing tier sorting parameters
 */
export const PricingTierSortSchema = z.object({
    field: PricingTierSortFieldSchema.default('minQuantity'),
    direction: z.enum(['asc', 'desc']).default('asc')
});

export type PricingTierSort = z.infer<typeof PricingTierSortSchema>;
