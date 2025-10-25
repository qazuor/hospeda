import { z } from 'zod';
import {
    AccommodationListingPlanCreateInputSchema,
    AccommodationListingPlanPatchInputSchema,
    AccommodationListingPlanUpdateInputSchema
} from './accommodationListingPlan.crud.schema.js';
import { AccommodationListingPlanListQuerySchema } from './accommodationListingPlan.query.schema.js';
import type { AccommodationListingPlan } from './accommodationListingPlan.schema.js';

/**
 * AccommodationListingPlan HTTP Schemas
 *
 * This file contains HTTP-compatible schemas with proper coercion for:
 * - Query parameters (string to proper types)
 * - Form data handling
 * - URL parameter parsing
 * - HTTP-specific validations
 */

// ============================================================================
// HTTP QUERY SCHEMAS (with coercion)
// ============================================================================

/**
 * HTTP-compatible version of accommodation listing plan list query
 * Handles string-to-type coercion for URL query parameters
 */
export const AccommodationListingPlanListHttpQuerySchema =
    AccommodationListingPlanListQuerySchema.extend({
        // Coerce string page numbers to integers
        page: z.coerce.number().int().positive().default(1),
        pageSize: z.coerce.number().int().positive().max(100).default(10),

        // Boolean coercion for filters
        includeLimitsBreakdown: z.coerce.boolean().optional()
    });

export type AccommodationListingPlanListHttpQuery = z.infer<
    typeof AccommodationListingPlanListHttpQuerySchema
>;

// ============================================================================
// HTTP CREATE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible version of accommodation listing plan creation
 * Handles form data and JSON input with special handling for limits JSON
 */
export const AccommodationListingPlanCreateHttpInputSchema =
    AccommodationListingPlanCreateInputSchema.extend({
        // Handle limits as either JSON string or object
        limits: z
            .union([
                z.string().transform((str) => {
                    try {
                        return JSON.parse(str);
                    } catch {
                        return {};
                    }
                }),
                z.record(z.string(), z.unknown())
            ])
            .optional()
    });

export type AccommodationListingPlanCreateHttpInput = z.infer<
    typeof AccommodationListingPlanCreateHttpInputSchema
>;

// ============================================================================
// HTTP UPDATE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible version of accommodation listing plan update
 * Handles form data and JSON input with special handling for limits JSON
 */
export const AccommodationListingPlanUpdateHttpInputSchema =
    AccommodationListingPlanUpdateInputSchema.extend({
        // Handle limits as either JSON string or object
        limits: z
            .union([
                z.string().transform((str) => {
                    try {
                        return JSON.parse(str);
                    } catch {
                        return {};
                    }
                }),
                z.record(z.string(), z.unknown())
            ])
            .optional()
    });

export type AccommodationListingPlanUpdateHttpInput = z.infer<
    typeof AccommodationListingPlanUpdateHttpInputSchema
>;

// ============================================================================
// HTTP PATCH SCHEMAS
// ============================================================================

/**
 * HTTP-compatible version of accommodation listing plan patch
 * Handles partial updates with proper coercion
 */
export const AccommodationListingPlanPatchHttpInputSchema =
    AccommodationListingPlanPatchInputSchema.extend({
        // Handle limits as either JSON string or object
        limits: z
            .union([
                z.string().transform((str) => {
                    try {
                        return JSON.parse(str);
                    } catch {
                        return {};
                    }
                }),
                z.record(z.string(), z.unknown())
            ])
            .optional()
    });

export type AccommodationListingPlanPatchHttpInput = z.infer<
    typeof AccommodationListingPlanPatchHttpInputSchema
>;

// ============================================================================
// URL PARAMETER SCHEMAS
// ============================================================================

/**
 * Schema for URL path parameters
 */
export const AccommodationListingPlanParamsSchema = z.object({
    id: z.string().uuid({ message: 'zodError.accommodationListingPlan.id.invalidUuid' })
});

export type AccommodationListingPlanParams = z.infer<typeof AccommodationListingPlanParamsSchema>;

// ============================================================================
// HTTP CONVERSION HELPERS
// ============================================================================

/**
 * Convert HTTP input to domain schema
 */
export const convertAccommodationListingPlanHttpToDomain = {
    /**
     * Convert HTTP create input to domain create input
     */
    create: (httpInput: AccommodationListingPlanCreateHttpInput) => {
        // Parse with HTTP schema first to handle JSON coercion, then validate with domain schema
        const parsed = AccommodationListingPlanCreateHttpInputSchema.parse(httpInput);
        return AccommodationListingPlanCreateInputSchema.parse(parsed);
    },

    /**
     * Convert HTTP update input to domain update input
     */
    update: (httpInput: AccommodationListingPlanUpdateHttpInput) => {
        // Parse with HTTP schema first to handle JSON coercion, then validate with domain schema
        const parsed = AccommodationListingPlanUpdateHttpInputSchema.parse(httpInput);
        return AccommodationListingPlanUpdateInputSchema.parse(parsed);
    },

    /**
     * Convert HTTP patch input to domain patch input
     */
    patch: (httpInput: AccommodationListingPlanPatchHttpInput) => {
        // Parse with HTTP schema first to handle JSON coercion, then validate with domain schema
        const parsed = AccommodationListingPlanPatchHttpInputSchema.parse(httpInput);
        return AccommodationListingPlanPatchInputSchema.parse(parsed);
    },

    /**
     * Convert HTTP query to domain query
     */
    query: (httpQuery: AccommodationListingPlanListHttpQuery) => {
        return AccommodationListingPlanListQuerySchema.parse(httpQuery);
    }
};

/**
 * Convert domain response to HTTP response
 */
export const convertAccommodationListingPlanDomainToHttp = {
    /**
     * Convert domain accommodation listing plan to HTTP response
     */
    accommodationListingPlan: (plan: AccommodationListingPlan) => {
        // Add any HTTP-specific transformations here
        return {
            ...plan,
            // Ensure limits is properly serialized for HTTP
            limits: plan.limits ? JSON.parse(JSON.stringify(plan.limits)) : undefined
        };
    }
};
