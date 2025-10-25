import { z } from 'zod';
import type { BillingIntervalEnum } from '../../enums/billing-interval.enum.js';
import type { BillingSchemeEnum } from '../../enums/billing-scheme.enum.js';
import type { PricingPlanCreateInput, PricingPlanUpdateInput } from './pricingPlan.crud.schema.js';
import type { PricingPlanSearch } from './pricingPlan.query.schema.js';
import { PricingPlanSearchSchema } from './pricingPlan.query.schema.js';

// ============================================================================
// HTTP COERCION SCHEMAS
// ============================================================================

/**
 * Custom boolean coercion that properly handles 'false' strings
 */
const booleanCoercion = z.union([
    z.boolean(),
    z.string().transform((val) => val.toLowerCase() === 'true')
]);

/**
 * HTTP schema for pricing plan search with parameter coercion
 * Converts string parameters to appropriate types
 */
export const HttpPricingPlanSearchSchema = PricingPlanSearchSchema.extend({
    // Coerce pagination parameters
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10),

    // Coerce amount range parameters
    amountMinorMin: z.coerce.number().int().min(0).optional(),
    amountMinorMax: z.coerce.number().int().min(0).optional(),

    // Coerce boolean parameters with custom logic
    isActive: booleanCoercion.optional(),
    isDeleted: booleanCoercion.optional(),

    // Coerce date parameters
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),
    updatedAfter: z.coerce.date().optional(),
    updatedBefore: z.coerce.date().optional()
});

export type HttpPricingPlanSearch = z.infer<typeof HttpPricingPlanSearchSchema>;

/**
 * HTTP schema for pricing plan creation with parameter coercion
 */
export const PricingPlanCreateHttpSchema = z.object({
    productId: z.string().uuid(),
    billingScheme: z.string(),
    interval: z.string().optional(),
    amountMinor: z.coerce.number().int().min(0),
    currency: z
        .string()
        .length(3)
        .regex(/^[A-Z]{3}$/),
    metadata: z.string().optional(),
    lifecycleState: z.string().optional()
});

export type PricingPlanCreateHttp = z.infer<typeof PricingPlanCreateHttpSchema>;

/**
 * HTTP schema for pricing plan updates with parameter coercion
 */
export const PricingPlanUpdateHttpSchema = z.object({
    productId: z.string().uuid().optional(),
    billingScheme: z.string().optional(),
    interval: z.string().optional(),
    amountMinor: z.coerce.number().int().min(0).optional(),
    currency: z
        .string()
        .length(3)
        .regex(/^[A-Z]{3}$/)
        .optional(),
    metadata: z.string().optional(),
    lifecycleState: z.string().optional()
});

export type PricingPlanUpdateHttp = z.infer<typeof PricingPlanUpdateHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert HTTP search parameters to domain search schema
 */
export function httpToDomainPricingPlanSearch(
    httpParams: HttpPricingPlanSearch
): PricingPlanSearch {
    return {
        ...httpParams,
        // Ensure enum conversion
        billingScheme: httpParams.billingScheme as BillingSchemeEnum | undefined,
        interval: httpParams.interval as BillingIntervalEnum | undefined
    };
}

/**
 * Convert HTTP create data to domain create input with JSON parsing
 */
export function httpToDomainPricingPlanCreate(
    httpData: PricingPlanCreateHttp
): PricingPlanCreateInput {
    // Parse metadata JSON string
    let metadata = {};
    if (httpData.metadata) {
        try {
            metadata = JSON.parse(httpData.metadata);
        } catch {
            metadata = {}; // Default to empty object on parse error
        }
    }

    return {
        productId: httpData.productId,
        billingScheme: httpData.billingScheme as BillingSchemeEnum,
        interval: httpData.interval as BillingIntervalEnum | undefined,
        amountMinor: httpData.amountMinor,
        currency: httpData.currency,
        metadata,
        lifecycleState: (httpData.lifecycleState as 'DRAFT' | 'ACTIVE' | 'ARCHIVED') || 'ACTIVE'
    };
}

/**
 * Convert HTTP update data to domain update input with JSON parsing
 */
export function httpToDomainPricingPlanUpdate(
    httpData: PricingPlanUpdateHttp
): PricingPlanUpdateInput {
    // Parse metadata JSON string if provided
    let metadata: Record<string, unknown> | undefined;
    if (httpData.metadata !== undefined) {
        try {
            metadata = JSON.parse(httpData.metadata);
        } catch {
            metadata = {}; // Default to empty object on parse error
        }
    }

    return {
        ...(httpData.productId && { productId: httpData.productId }),
        ...(httpData.billingScheme && {
            billingScheme: httpData.billingScheme as BillingSchemeEnum
        }),
        ...(httpData.interval !== undefined && {
            interval: httpData.interval as BillingIntervalEnum
        }),
        ...(httpData.amountMinor !== undefined && { amountMinor: httpData.amountMinor }),
        ...(httpData.currency && { currency: httpData.currency }),
        ...(metadata !== undefined && { metadata }),
        ...(httpData.lifecycleState && {
            lifecycleState: httpData.lifecycleState as 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
        })
    };
}
