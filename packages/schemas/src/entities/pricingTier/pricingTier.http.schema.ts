import { z } from 'zod';
import {
    PricingTierAnalysisSchema,
    PricingTierLookupSchema,
    PricingTierSearchSchema
} from './pricingTier.query.schema.js';

// ============================================================================
// HTTP COERCION HELPERS
// ============================================================================

/**
 * Custom boolean coercion that properly handles 'false' strings and '0'/'1'
 */
const booleanCoercion = z.union([
    z.boolean(),
    z.string().transform((val) => {
        const lower = val.toLowerCase();
        return lower === 'true' || lower === '1';
    }),
    z.number().transform((val) => val !== 0)
]);

/**
 * Custom BigInt coercion for price values
 * Handles string representation of large numbers
 */
const bigintCoercion = z.union([
    z.bigint(),
    z.string().transform((val) => BigInt(val)),
    z.number().transform((val) => BigInt(Math.floor(val)))
]);

/**
 * Custom nullable number coercion for maxQuantity
 * Handles 'null', 'unlimited', empty strings, and numeric values
 */
const nullableNumberCoercion = z
    .union([
        z.number().int().positive(),
        z.string().transform((val) => {
            const lower = val.toLowerCase().trim();
            if (lower === 'null' || lower === 'unlimited' || lower === '' || lower === 'infinity') {
                return null;
            }
            const parsed = Number.parseInt(val, 10);
            if (Number.isNaN(parsed) || parsed <= 0) {
                throw new Error('Invalid number or negative value');
            }
            return parsed;
        }),
        z.null()
    ])
    .nullable();

// ============================================================================
// SEARCH HTTP SCHEMAS
// ============================================================================

/**
 * HTTP schema for pricing tier search with parameter coercion
 * Converts URL query parameters to appropriate types
 */
export const HttpPricingTierSearchSchema = PricingTierSearchSchema.extend({
    // Coerce pagination parameters
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10),

    // Coerce quantity range parameters
    minQuantityMin: z.coerce.number().int().min(1).optional(),
    minQuantityMax: z.coerce.number().int().min(1).optional(),
    maxQuantityMin: z.coerce.number().int().positive().optional(),
    maxQuantityMax: z.coerce.number().int().positive().optional(),
    includesQuantity: z.coerce.number().int().min(1).optional(),

    // Coerce price range parameters
    unitPriceMinorMin: bigintCoercion.refine((val) => val > 0n, 'Must be positive').optional(),
    unitPriceMinorMax: bigintCoercion.refine((val) => val > 0n, 'Must be positive').optional(),

    // Coerce boolean parameters
    hasUnlimitedMax: booleanCoercion.optional(),
    isActive: booleanCoercion.optional(),

    // Coerce date parameters
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),
    updatedAfter: z.coerce.date().optional(),
    updatedBefore: z.coerce.date().optional()
});

export type HttpPricingTierSearch = z.infer<typeof HttpPricingTierSearchSchema>;

/**
 * HTTP schema for pricing tier lookup with parameter coercion
 */
export const HttpPricingTierLookupSchema = PricingTierLookupSchema.extend({
    quantity: z.coerce.number().int().min(1),
    includeInactive: booleanCoercion.default(false)
});

export type HttpPricingTierLookup = z.infer<typeof HttpPricingTierLookupSchema>;

/**
 * HTTP schema for pricing tier analysis with parameter coercion
 */
export const HttpPricingTierAnalysisSchema = PricingTierAnalysisSchema.extend({
    includeInactive: booleanCoercion.default(false)
});

export type HttpPricingTierAnalysis = z.infer<typeof HttpPricingTierAnalysisSchema>;

// ============================================================================
// CRUD HTTP SCHEMAS
// ============================================================================

/**
 * HTTP schema for pricing tier creation with parameter coercion
 */
export const PricingTierCreateHttpSchema = z
    .object({
        pricingPlanId: z.string().uuid(),
        minQuantity: z.coerce.number().int().min(1),
        maxQuantity: nullableNumberCoercion,
        unitPriceMinor: bigintCoercion.refine((val) => val > 0n, 'unitPriceMinor must be positive')
    })
    .refine((data) => data.maxQuantity === null || data.maxQuantity > data.minQuantity, {
        message: 'maxQuantity must be greater than minQuantity when specified',
        path: ['maxQuantity']
    });

export type PricingTierCreateHttp = z.infer<typeof PricingTierCreateHttpSchema>;

/**
 * HTTP schema for pricing tier updates with parameter coercion
 */
export const PricingTierUpdateHttpSchema = z
    .object({
        minQuantity: z.coerce.number().int().min(1).optional(),
        maxQuantity: nullableNumberCoercion.optional(),
        unitPriceMinor: bigintCoercion
            .refine((val) => val > 0n, 'unitPriceMinor must be positive')
            .optional(),
        lifecycleState: z.string().optional()
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

export type PricingTierUpdateHttp = z.infer<typeof PricingTierUpdateHttpSchema>;

// ============================================================================
// BULK OPERATIONS HTTP SCHEMAS
// ============================================================================

/**
 * HTTP schema for bulk tier creation with JSON body parsing
 */
export const PricingTierBulkCreateHttpSchema = z.object({
    pricingPlanId: z.string().uuid(),
    tiers: z
        .union([
            z.string().transform((str) => {
                const parsed = JSON.parse(str) as Array<{
                    minQuantity: string | number;
                    maxQuantity: string | number | null;
                    unitPriceMinor: string | number;
                }>;
                return parsed.map((tier) => ({
                    minQuantity: Number(tier.minQuantity),
                    maxQuantity: tier.maxQuantity === null ? null : Number(tier.maxQuantity),
                    unitPriceMinor: BigInt(tier.unitPriceMinor)
                }));
            }),
            z.array(
                z.object({
                    minQuantity: z.coerce.number().int().min(1),
                    maxQuantity: nullableNumberCoercion,
                    unitPriceMinor: bigintCoercion.refine(
                        (val) => val > 0n,
                        'unitPriceMinor must be positive'
                    )
                })
            )
        ])
        .pipe(
            z
                .array(
                    z.object({
                        minQuantity: z.number().int().min(1),
                        maxQuantity: z.number().int().positive().nullable(),
                        unitPriceMinor: z.bigint().positive()
                    })
                )
                .min(1, 'At least one tier is required')
        )
});

export type PricingTierBulkCreateHttp = z.infer<typeof PricingTierBulkCreateHttpSchema>;

/**
 * HTTP schema for bulk tier deletion with ID array parsing
 */
export const PricingTierBulkDeleteHttpSchema = z.object({
    ids: z
        .union([
            z.string().transform((str) => str.split(',').map((id) => id.trim())),
            z.array(z.string())
        ])
        .pipe(z.array(z.string().uuid()).min(1, 'At least one valid UUID is required')),
    force: booleanCoercion.default(false)
});

export type PricingTierBulkDeleteHttp = z.infer<typeof PricingTierBulkDeleteHttpSchema>;

// ============================================================================
// PATH PARAMETER SCHEMAS
// ============================================================================

/**
 * HTTP schema for pricing tier ID path parameter
 */
export const PricingTierIdPathSchema = z.object({
    id: z.string().uuid()
});

export type PricingTierIdPath = z.infer<typeof PricingTierIdPathSchema>;

/**
 * HTTP schema for pricing plan ID path parameter
 */
export const PricingPlanIdPathSchema = z.object({
    pricingPlanId: z.string().uuid()
});

export type PricingPlanIdPath = z.infer<typeof PricingPlanIdPathSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * HTTP schema for pricing tier creation response
 */
export const PricingTierCreateResponseSchema = z.object({
    success: z.boolean(),
    data: z
        .object({
            id: z.string().uuid(),
            pricingPlanId: z.string().uuid(),
            minQuantity: z.number().int().min(1),
            maxQuantity: z.number().int().positive().nullable(),
            unitPriceMinor: z.bigint(),
            lifecycleState: z.string(),
            createdAt: z.date(),
            quantityRange: z.string()
        })
        .optional(),
    error: z
        .object({
            code: z.string(),
            message: z.string()
        })
        .optional()
});

export type PricingTierCreateResponse = z.infer<typeof PricingTierCreateResponseSchema>;

/**
 * HTTP schema for pricing tier validation errors
 */
export const PricingTierValidationErrorSchema = z.object({
    success: z.literal(false),
    error: z.object({
        code: z.literal('VALIDATION_ERROR'),
        message: z.string(),
        details: z
            .array(
                z.object({
                    field: z.string(),
                    message: z.string(),
                    value: z.any().optional()
                })
            )
            .optional()
    })
});

export type PricingTierValidationError = z.infer<typeof PricingTierValidationErrorSchema>;
