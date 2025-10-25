import { z } from 'zod';
import {
    AccommodationListingCreateInputSchema,
    AccommodationListingPatchInputSchema,
    AccommodationListingUpdateInputSchema
} from './accommodationListing.crud.schema.js';
import { AccommodationListingListQuerySchema } from './accommodationListing.query.schema.js';
import type { AccommodationListing } from './accommodationListing.schema.js';

/**
 * AccommodationListing HTTP Schemas
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
 * HTTP-compatible version of accommodation listing list query
 * Handles string-to-type coercion for URL query parameters
 */
export const AccommodationListingListHttpQuerySchema = AccommodationListingListQuerySchema.extend({
    // Coerce string page numbers to integers with fallback for invalid values
    page: z.preprocess((val) => {
        const num = Number(val);
        return Number.isNaN(num) ? 1 : num;
    }, z.number().int().positive().default(1)),

    pageSize: z.preprocess((val) => {
        const num = Number(val);
        return Number.isNaN(num) ? 10 : num;
    }, z.number().int().positive().max(100).default(10)),

    // Proper boolean coercion for filters (handles 'false' string correctly)
    isTrial: z.preprocess((val) => {
        if (typeof val === 'string') {
            return val.toLowerCase() === 'true';
        }
        return val;
    }, z.boolean().optional()),

    isActiveOnly: z.preprocess((val) => {
        if (typeof val === 'string') {
            return val.toLowerCase() === 'true';
        }
        return val;
    }, z.boolean().optional()),

    // Handle array parameters (comma-separated strings)
    statuses: z
        .union([z.string().transform((str) => str.split(',').filter(Boolean)), z.array(z.string())])
        .optional()
});

export type AccommodationListingListHttpQuery = z.infer<
    typeof AccommodationListingListHttpQuerySchema
>;

// ============================================================================
// HTTP CREATE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible version of accommodation listing creation
 * Handles form data and JSON input
 */
export const AccommodationListingCreateHttpInputSchema =
    AccommodationListingCreateInputSchema.extend({
        // Coerce boolean values
        isTrial: z.coerce.boolean().default(false)
    });

export type AccommodationListingCreateHttpInput = z.infer<
    typeof AccommodationListingCreateHttpInputSchema
>;

// ============================================================================
// HTTP UPDATE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible version of accommodation listing update
 * Handles form data and JSON input
 */
export const AccommodationListingUpdateHttpInputSchema =
    AccommodationListingUpdateInputSchema.extend({
        // Coerce boolean values
        isTrial: z.coerce.boolean().optional()
    });

export type AccommodationListingUpdateHttpInput = z.infer<
    typeof AccommodationListingUpdateHttpInputSchema
>;

// ============================================================================
// HTTP PATCH SCHEMAS
// ============================================================================

/**
 * HTTP-compatible version of accommodation listing patch
 * Handles partial updates with proper coercion
 */
export const AccommodationListingPatchHttpInputSchema = AccommodationListingPatchInputSchema.extend(
    {
        // Coerce boolean values
        isTrial: z.coerce.boolean().optional()
    }
);

export type AccommodationListingPatchHttpInput = z.infer<
    typeof AccommodationListingPatchHttpInputSchema
>;

// ============================================================================
// URL PARAMETER SCHEMAS
// ============================================================================

/**
 * Schema for URL path parameters
 */
export const AccommodationListingParamsSchema = z.object({
    id: z.string().uuid({ message: 'zodError.accommodationListing.id.invalidUuid' })
});

export type AccommodationListingParams = z.infer<typeof AccommodationListingParamsSchema>;

/**
 * Schema for nested URL parameters (e.g., /clients/:clientId/listings/:id)
 */
export const AccommodationListingNestedParamsSchema = z.object({
    clientId: z.string().uuid({ message: 'zodError.client.id.invalidUuid' }),
    id: z.string().uuid({ message: 'zodError.accommodationListing.id.invalidUuid' })
});

export type AccommodationListingNestedParams = z.infer<
    typeof AccommodationListingNestedParamsSchema
>;

// ============================================================================
// HTTP CONVERSION HELPERS
// ============================================================================

/**
 * Convert HTTP input to domain schema
 */
export const convertAccommodationListingHttpToDomain = {
    /**
     * Convert HTTP create input to domain create input
     */
    create: (httpInput: AccommodationListingCreateHttpInput) => {
        return AccommodationListingCreateInputSchema.parse(httpInput);
    },

    /**
     * Convert HTTP update input to domain update input
     */
    update: (httpInput: AccommodationListingUpdateHttpInput) => {
        return AccommodationListingUpdateInputSchema.parse(httpInput);
    },

    /**
     * Convert HTTP patch input to domain patch input
     */
    patch: (httpInput: AccommodationListingPatchHttpInput) => {
        return AccommodationListingPatchInputSchema.parse(httpInput);
    },

    /**
     * Convert HTTP query to domain query
     */
    query: (httpQuery: AccommodationListingListHttpQuery) => {
        return AccommodationListingListQuerySchema.parse(httpQuery);
    }
};

/**
 * Convert domain response to HTTP response
 */
export const convertAccommodationListingDomainToHttp = {
    /**
     * Convert domain accommodation listing to HTTP response
     */
    accommodationListing: (listing: AccommodationListing) => {
        // Add any HTTP-specific transformations here
        return {
            ...listing,
            // Date fields are already strings in our schema, so no conversion needed
            // but we ensure consistency
            fromDate: listing.fromDate,
            toDate: listing.toDate,
            trialEndsAt: listing.trialEndsAt
        };
    }
};
