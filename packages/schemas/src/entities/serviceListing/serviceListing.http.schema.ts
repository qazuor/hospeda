import { z } from 'zod';
import {
    ServiceListingCreateInputSchema,
    ServiceListingPatchInputSchema,
    ServiceListingUpdateInputSchema
} from './serviceListing.crud.schema.js';
import { ServiceListingListQuerySchema } from './serviceListing.query.schema.js';
import type { ServiceListing } from './serviceListing.schema.js';

/**
 * ServiceListing HTTP Schemas
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
 * HTTP-compatible version of service listing list query
 * Handles string-to-type coercion for URL query parameters
 */
export const ServiceListingListHttpQuerySchema = ServiceListingListQuerySchema.extend({
    // Coerce string page numbers to integers
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10),

    // Boolean coercion for filters
    isActive: z.coerce.boolean().optional(),
    isFeatured: z.coerce.boolean().optional(),
    isTrialListing: z.coerce.boolean().optional(),

    // Number coercion for price filters
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),

    // Handle array parameters (comma-separated strings)
    statuses: z
        .union([z.string().transform((str) => str.split(',').filter(Boolean)), z.array(z.string())])
        .optional()
});

export type ServiceListingListHttpQuery = z.infer<typeof ServiceListingListHttpQuerySchema>;

// ============================================================================
// HTTP CREATE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible version of service listing creation
 * Handles form data and JSON input
 */
export const ServiceListingCreateHttpInputSchema = ServiceListingCreateInputSchema;

export type ServiceListingCreateHttpInput = z.infer<typeof ServiceListingCreateHttpInputSchema>;

// ============================================================================
// HTTP UPDATE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible version of service listing update
 * Handles form data and JSON input
 */
export const ServiceListingUpdateHttpInputSchema = ServiceListingUpdateInputSchema;

export type ServiceListingUpdateHttpInput = z.infer<typeof ServiceListingUpdateHttpInputSchema>;

// ============================================================================
// HTTP PATCH SCHEMAS
// ============================================================================

/**
 * HTTP-compatible version of service listing patch
 * Handles partial updates with proper coercion
 */
export const ServiceListingPatchHttpInputSchema = ServiceListingPatchInputSchema;

export type ServiceListingPatchHttpInput = z.infer<typeof ServiceListingPatchHttpInputSchema>;

// ============================================================================
// URL PARAMETER SCHEMAS
// ============================================================================

/**
 * Schema for URL path parameters
 */
export const ServiceListingParamsSchema = z.object({
    id: z.string().uuid({ message: 'zodError.serviceListing.id.invalidUuid' })
});

export type ServiceListingParams = z.infer<typeof ServiceListingParamsSchema>;

/**
 * Schema for nested URL parameters (e.g., /clients/:clientId/listings/:id)
 */
export const ServiceListingNestedParamsSchema = z.object({
    clientId: z.string().uuid({ message: 'zodError.client.id.invalidUuid' }),
    id: z.string().uuid({ message: 'zodError.serviceListing.id.invalidUuid' })
});

export type ServiceListingNestedParams = z.infer<typeof ServiceListingNestedParamsSchema>;

/**
 * Schema for service-specific nested URL parameters
 */
export const ServiceListingServiceNestedParamsSchema = z.object({
    touristServiceId: z.string().uuid({ message: 'zodError.touristService.id.invalidUuid' }),
    id: z.string().uuid({ message: 'zodError.serviceListing.id.invalidUuid' })
});

export type ServiceListingServiceNestedParams = z.infer<
    typeof ServiceListingServiceNestedParamsSchema
>;

// ============================================================================
// HTTP CONVERSION HELPERS
// ============================================================================

/**
 * Convert HTTP input to domain schema
 */
export const convertServiceListingHttpToDomain = {
    /**
     * Convert HTTP create input to domain create input
     */
    create: (httpInput: ServiceListingCreateHttpInput) => {
        return ServiceListingCreateInputSchema.parse(httpInput);
    },

    /**
     * Convert HTTP update input to domain update input
     */
    update: (httpInput: ServiceListingUpdateHttpInput) => {
        return ServiceListingUpdateInputSchema.parse(httpInput);
    },

    /**
     * Convert HTTP patch input to domain patch input
     */
    patch: (httpInput: ServiceListingPatchHttpInput) => {
        return ServiceListingPatchInputSchema.parse(httpInput);
    },

    /**
     * Convert HTTP query to domain query
     */
    query: (httpQuery: ServiceListingListHttpQuery) => {
        return ServiceListingListQuerySchema.parse(httpQuery);
    }
};

/**
 * Convert domain response to HTTP response
 */
export const convertServiceListingDomainToHttp = {
    /**
     * Convert domain service listing to HTTP response
     */
    serviceListing: (listing: ServiceListing) => {
        // Add any HTTP-specific transformations here
        return {
            ...listing,
            // Date fields are already properly formatted in our schema
            publishedAt: listing.publishedAt,
            expiresAt: listing.expiresAt,
            trialStartDate: listing.trialStartDate,
            trialEndDate: listing.trialEndDate
        };
    }
};
