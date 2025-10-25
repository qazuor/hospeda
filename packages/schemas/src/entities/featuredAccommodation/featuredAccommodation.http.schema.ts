import { z } from 'zod';
import {
    FeaturedAccommodationCreateInputSchema,
    FeaturedAccommodationPatchInputSchema,
    FeaturedAccommodationUpdateInputSchema
} from './featuredAccommodation.crud.schema.js';
import { FeaturedAccommodationListQuerySchema } from './featuredAccommodation.query.schema.js';
import type { FeaturedAccommodation } from './featuredAccommodation.schema.js';

/**
 * FeaturedAccommodation HTTP Schemas
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
 * HTTP-compatible version of featured accommodation list query
 * Handles string-to-type coercion for URL query parameters
 */
export const FeaturedAccommodationListHttpQuerySchema = FeaturedAccommodationListQuerySchema.extend(
    {
        // Coerce string page numbers to integers
        page: z.coerce.number().int().positive().default(1),
        pageSize: z.coerce.number().int().positive().max(100).default(10),

        // Boolean coercion for filters
        isActiveOnly: z.coerce.boolean().optional(),

        // Handle array parameters (comma-separated strings)
        featuredTypes: z
            .union([
                z.string().transform((str) => str.split(',').filter(Boolean)),
                z.array(z.string())
            ])
            .optional(),

        statuses: z
            .union([
                z.string().transform((str) => str.split(',').filter(Boolean)),
                z.array(z.string())
            ])
            .optional()
    }
);

export type FeaturedAccommodationListHttpQuery = z.infer<
    typeof FeaturedAccommodationListHttpQuerySchema
>;

// ============================================================================
// HTTP CREATE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible version of featured accommodation creation
 * Handles form data and JSON input
 */
export const FeaturedAccommodationCreateHttpInputSchema = FeaturedAccommodationCreateInputSchema;

export type FeaturedAccommodationCreateHttpInput = z.infer<
    typeof FeaturedAccommodationCreateHttpInputSchema
>;

// ============================================================================
// HTTP UPDATE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible version of featured accommodation update
 * Handles form data and JSON input
 */
export const FeaturedAccommodationUpdateHttpInputSchema = FeaturedAccommodationUpdateInputSchema;

export type FeaturedAccommodationUpdateHttpInput = z.infer<
    typeof FeaturedAccommodationUpdateHttpInputSchema
>;

// ============================================================================
// HTTP PATCH SCHEMAS
// ============================================================================

/**
 * HTTP-compatible version of featured accommodation patch
 * Handles partial updates with proper coercion
 */
export const FeaturedAccommodationPatchHttpInputSchema = FeaturedAccommodationPatchInputSchema;

export type FeaturedAccommodationPatchHttpInput = z.infer<
    typeof FeaturedAccommodationPatchHttpInputSchema
>;

// ============================================================================
// URL PARAMETER SCHEMAS
// ============================================================================

/**
 * Schema for URL path parameters
 */
export const FeaturedAccommodationParamsSchema = z.object({
    id: z.string().uuid({ message: 'zodError.featuredAccommodation.id.invalidUuid' })
});

export type FeaturedAccommodationParams = z.infer<typeof FeaturedAccommodationParamsSchema>;

/**
 * Schema for nested URL parameters (e.g., /clients/:clientId/featured/:id)
 */
export const FeaturedAccommodationNestedParamsSchema = z.object({
    clientId: z.string().uuid({ message: 'zodError.client.id.invalidUuid' }),
    id: z.string().uuid({ message: 'zodError.featuredAccommodation.id.invalidUuid' })
});

export type FeaturedAccommodationNestedParams = z.infer<
    typeof FeaturedAccommodationNestedParamsSchema
>;

// ============================================================================
// HTTP CONVERSION HELPERS
// ============================================================================

/**
 * Convert HTTP input to domain schema
 */
export const convertFeaturedAccommodationHttpToDomain = {
    /**
     * Convert HTTP create input to domain create input
     */
    create: (httpInput: FeaturedAccommodationCreateHttpInput) => {
        return FeaturedAccommodationCreateInputSchema.parse(httpInput);
    },

    /**
     * Convert HTTP update input to domain update input
     */
    update: (httpInput: FeaturedAccommodationUpdateHttpInput) => {
        return FeaturedAccommodationUpdateInputSchema.parse(httpInput);
    },

    /**
     * Convert HTTP patch input to domain patch input
     */
    patch: (httpInput: FeaturedAccommodationPatchHttpInput) => {
        return FeaturedAccommodationPatchInputSchema.parse(httpInput);
    },

    /**
     * Convert HTTP query to domain query
     */
    query: (httpQuery: FeaturedAccommodationListHttpQuery) => {
        return FeaturedAccommodationListQuerySchema.parse(httpQuery);
    }
};

/**
 * Convert domain response to HTTP response
 */
export const convertFeaturedAccommodationDomainToHttp = {
    /**
     * Convert domain featured accommodation to HTTP response
     */
    featuredAccommodation: (featured: FeaturedAccommodation) => {
        // Add any HTTP-specific transformations here
        return {
            ...featured,
            // Date fields are already strings in our schema, so no conversion needed
            // but we ensure consistency
            fromDate: featured.fromDate,
            toDate: featured.toDate
        };
    }
};
