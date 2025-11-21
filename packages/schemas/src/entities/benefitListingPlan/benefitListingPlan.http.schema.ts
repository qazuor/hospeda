/**
 * BenefitListingPlan HTTP Schemas
 *
 * HTTP-compatible schemas for benefit listing plan operations with automatic coercion.
 * These schemas handle the conversion from HTTP input (strings, form data) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import { BaseHttpSearchSchema, createArrayQueryParam } from '../../api/http/base-http.schema.js';

/**
 * Benefit Listing Plan Limits HTTP Schema
 * All numeric and boolean fields use .coerce for HTTP compatibility
 */
export const BenefitListingPlanLimitsHttpSchema = z
    .object({
        // Numeric limits with HTTP coercion
        maxListings: z.coerce.number().int().positive().optional(),
        maxBenefitsPerListing: z.coerce.number().int().positive().optional(),
        maxTrialDays: z.coerce.number().int().positive().optional(),

        // Boolean flags with HTTP coercion
        allowCustomBranding: z.coerce.boolean().optional(),
        allowAnalytics: z.coerce.boolean().optional(),
        allowPromotions: z.coerce.boolean().optional(),
        allowTrialPeriods: z.coerce.boolean().optional(),

        // Array fields
        features: z.array(z.string()).optional()
    })
    .optional();

export type BenefitListingPlanLimitsHttp = z.infer<typeof BenefitListingPlanLimitsHttpSchema>;

/**
 * HTTP-compatible benefit listing plan search schema
 */
export const BenefitListingPlanSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Basic filters
    name: z.string().optional(),

    // Array filters
    features: createArrayQueryParam('Filter by features')
});

export type BenefitListingPlanSearchHttp = z.infer<typeof BenefitListingPlanSearchHttpSchema>;

/**
 * HTTP-compatible benefit listing plan creation schema
 * Complete schema matching all CreateBenefitListingPlanSchema fields with HTTP coercion
 */
export const BenefitListingPlanCreateHttpSchema = z.object({
    // Core required fields
    name: z.string().min(1).max(255),

    // Optional fields
    description: z.string().max(1000).optional(),

    // Nested limits object
    limits: BenefitListingPlanLimitsHttpSchema,

    // Admin metadata
    adminInfo: z
        .object({
            notes: z.string().max(300).optional(),
            favorite: z.coerce.boolean().default(false)
        })
        .optional()
});

export type BenefitListingPlanCreateHttp = z.infer<typeof BenefitListingPlanCreateHttpSchema>;

/**
 * HTTP-compatible benefit listing plan update schema
 * All fields optional for partial updates
 */
export const BenefitListingPlanUpdateHttpSchema = z.object({
    // Core fields (all optional for updates)
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),

    // Nested limits object
    limits: BenefitListingPlanLimitsHttpSchema,

    // Admin metadata
    adminInfo: z
        .object({
            notes: z.string().max(300).optional(),
            favorite: z.coerce.boolean().default(false)
        })
        .optional()
});

export type BenefitListingPlanUpdateHttp = z.infer<typeof BenefitListingPlanUpdateHttpSchema>;

/**
 * HTTP to Domain Conversion Functions
 * These functions convert HTTP request data to domain-compatible formats
 */

import type {
    CreateBenefitListingPlan,
    UpdateBenefitListingPlan
} from './benefitListingPlan.crud.schema.js';
import type { BenefitListingPlanLimits } from './benefitListingPlan.schema.js';

/**
 * Convert HTTP limits to domain limits
 */
function httpToDomainLimits(
    httpLimits: BenefitListingPlanLimitsHttp
): BenefitListingPlanLimits | undefined {
    if (!httpLimits) return undefined;

    return {
        maxListings: httpLimits.maxListings,
        maxBenefitsPerListing: httpLimits.maxBenefitsPerListing,
        maxTrialDays: httpLimits.maxTrialDays,
        allowCustomBranding: httpLimits.allowCustomBranding,
        allowAnalytics: httpLimits.allowAnalytics,
        allowPromotions: httpLimits.allowPromotions,
        allowTrialPeriods: httpLimits.allowTrialPeriods,
        features: httpLimits.features
    };
}

/**
 * Convert HTTP benefit listing plan creation data to domain format
 */
export function httpToDomainBenefitListingPlanCreate(
    httpData: BenefitListingPlanCreateHttp
): CreateBenefitListingPlan {
    return {
        name: httpData.name,
        description: httpData.description,
        limits: httpToDomainLimits(httpData.limits),
        adminInfo: httpData.adminInfo || null
    };
}

/**
 * Convert HTTP benefit listing plan update data to domain format
 * Only includes fields that are actually provided
 */
export function httpToDomainBenefitListingPlanUpdate(
    httpData: BenefitListingPlanUpdateHttp
): UpdateBenefitListingPlan {
    const result: UpdateBenefitListingPlan = {};

    // Only include fields that are actually provided
    if (httpData.name !== undefined) result.name = httpData.name;
    if (httpData.description !== undefined) result.description = httpData.description;
    if (httpData.limits !== undefined) result.limits = httpToDomainLimits(httpData.limits);
    if (httpData.adminInfo !== undefined) result.adminInfo = httpData.adminInfo;

    return result;
}
