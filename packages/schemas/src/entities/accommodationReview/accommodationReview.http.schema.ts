/**
 * AccommodationReview HTTP Schemas
 *
 * HTTP-compatible schemas for accommodation review operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import { BaseHttpSearchSchema, createBooleanQueryParam } from '../../api/http/base-http.schema.js';

/**
 * HTTP-compatible accommodation review search schema with automatic coercion
 * Uses FLAT filter pattern for HTTP compatibility
 */
export const AccommodationReviewSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Entity relation filters with HTTP coercion
    accommodationId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),

    // Rating filters with HTTP coercion
    minRating: z.coerce.number().min(1).max(5).optional(),
    maxRating: z.coerce.number().min(1).max(5).optional(),
    rating: z.coerce.number().min(1).max(5).optional(),

    // Content filters with HTTP coercion
    hasContent: createBooleanQueryParam('Filter reviews with content'),
    hasImages: createBooleanQueryParam('Filter reviews with images'),
    minContentLength: z.coerce.number().int().min(0).optional(),
    maxContentLength: z.coerce.number().int().min(0).optional(),

    // Date filters with HTTP coercion
    reviewedAfter: z.coerce.date().optional(),
    reviewedBefore: z.coerce.date().optional(),
    stayDateAfter: z.coerce.date().optional(),
    stayDateBefore: z.coerce.date().optional(),

    // Status filters with HTTP coercion
    isVerified: createBooleanQueryParam('Filter verified reviews'),
    isPublished: createBooleanQueryParam('Filter published reviews'),
    isFlagged: createBooleanQueryParam('Filter flagged reviews'),

    // Response filters with HTTP coercion
    hasOwnerResponse: createBooleanQueryParam('Filter reviews with owner responses'),
    responseAfter: z.coerce.date().optional(),
    responseBefore: z.coerce.date().optional(),

    // Helpful/voting filters with HTTP coercion
    minHelpfulVotes: z.coerce.number().int().min(0).optional(),
    minTotalVotes: z.coerce.number().int().min(0).optional(),

    // Language filter
    language: z.string().length(2).optional(),

    // Guest type filters
    guestType: z.string().optional(),
    isBusinessTravel: createBooleanQueryParam('Filter business travel reviews'),
    isReturningGuest: createBooleanQueryParam('Filter returning guest reviews')
});

export type AccommodationReviewSearchHttp = z.infer<typeof AccommodationReviewSearchHttpSchema>;

/**
 * HTTP-compatible schema for reviews of a specific accommodation
 * Simplified schema for listing reviews by accommodation ID
 */
export const AccommodationReviewsByAccommodationHttpSchema = BaseHttpSearchSchema.extend({
    // Standard pagination
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),

    // Sorting
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),

    // Search query
    q: z.string().optional(),

    // Review-specific filters
    minRating: z.coerce.number().min(1).max(5).optional(),
    maxRating: z.coerce.number().min(1).max(5).optional(),
    isVerified: createBooleanQueryParam('Filter verified reviews'),
    hasImages: createBooleanQueryParam('Filter reviews with images')
});

export type AccommodationReviewsByAccommodationHttp = z.infer<
    typeof AccommodationReviewsByAccommodationHttpSchema
>;

/**
 * HTTP-compatible accommodation review creation schema
 * Handles form data and JSON input for creating reviews via HTTP
 */
export const AccommodationReviewCreateHttpSchema = z.object({
    accommodationId: z.string().uuid(),
    userId: z.string().uuid(),
    rating: z.coerce.number().min(1).max(5),
    title: z.string().min(5).max(200).optional(),
    content: z.string().min(10).max(2000).optional(),
    stayDate: z.coerce.date().optional(),
    guestType: z.string().optional(),
    isBusinessTravel: z.coerce.boolean().default(false),
    language: z.string().length(2).default('en')
});

export type AccommodationReviewCreateHttp = z.infer<typeof AccommodationReviewCreateHttpSchema>;

/**
 * HTTP-compatible accommodation review update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const AccommodationReviewUpdateHttpSchema = AccommodationReviewCreateHttpSchema.partial();

export type AccommodationReviewUpdateHttp = z.infer<typeof AccommodationReviewUpdateHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import type { AccommodationReviewSearchInput } from './accommodationReview.query.schema.js';

import type {
    AccommodationReviewCreateInput,
    AccommodationReviewUpdateInput
} from './accommodationReview.crud.schema.js';

/**
 * Convert HTTP accommodation review search parameters to domain search schema
 * Handles coercion from HTTP query strings to proper domain types
 */
export const httpToDomainAccommodationReviewSearch = (
    httpParams: AccommodationReviewSearchHttp
): AccommodationReviewSearchInput => {
    return {
        // Base search fields
        page: httpParams.page,
        pageSize: httpParams.pageSize,
        sortBy: httpParams.sortBy,
        sortOrder: httpParams.sortOrder,
        q: httpParams.q,

        // Entity relation filters
        accommodationId: httpParams.accommodationId,
        userId: httpParams.userId,

        // Rating filters
        minRating: httpParams.minRating,
        maxRating: httpParams.maxRating,
        rating: httpParams.rating,

        // Content filters
        hasContent: httpParams.hasContent,
        hasImages: httpParams.hasImages,
        minContentLength: httpParams.minContentLength,
        maxContentLength: httpParams.maxContentLength,

        // Date filters
        reviewedAfter: httpParams.reviewedAfter,
        reviewedBefore: httpParams.reviewedBefore,
        stayDateAfter: httpParams.stayDateAfter,
        stayDateBefore: httpParams.stayDateBefore,

        // Status filters
        isVerified: httpParams.isVerified,
        isPublished: httpParams.isPublished,
        isFlagged: httpParams.isFlagged,

        // Response filters
        hasOwnerResponse: httpParams.hasOwnerResponse,
        responseAfter: httpParams.responseAfter,
        responseBefore: httpParams.responseBefore,

        // Helpful/voting filters
        minHelpfulVotes: httpParams.minHelpfulVotes,
        minTotalVotes: httpParams.minTotalVotes,

        // Language filter
        language: httpParams.language,

        // Guest type filters
        guestType: httpParams.guestType,
        isBusinessTravel: httpParams.isBusinessTravel,
        isReturningGuest: httpParams.isReturningGuest
    };
};

/**
 * Convert HTTP accommodation review create data to domain create input
 * Handles form data conversion to proper domain types
 * Note: rating is converted from single number to complex rating object
 * Note: Some HTTP fields (stayDate, guestType, etc.) are not included in domain schema
 */
export const httpToDomainAccommodationReviewCreate = (
    httpData: AccommodationReviewCreateHttp
): AccommodationReviewCreateInput => {
    // Convert simple rating number to complex rating object with equal values
    const ratingValue = httpData.rating;
    const complexRating = {
        cleanliness: ratingValue,
        hospitality: ratingValue,
        services: ratingValue,
        accuracy: ratingValue,
        communication: ratingValue,
        location: ratingValue
    };

    return {
        accommodationId: httpData.accommodationId,
        userId: httpData.userId,
        rating: complexRating,
        title: httpData.title,
        content: httpData.content
        // Note: stayDate, guestType, isBusinessTravel, language are HTTP-only fields
    };
};

/**
 * Convert HTTP accommodation review update data to domain update input
 * Handles partial updates from HTTP PATCH requests
 * Note: rating is converted from single number to complex rating object if provided
 * Note: Some HTTP fields (stayDate, guestType, etc.) are not included in domain schema
 */
export const httpToDomainAccommodationReviewUpdate = (
    httpData: AccommodationReviewUpdateHttp
): AccommodationReviewUpdateInput => {
    // Convert simple rating number to complex rating object with equal values if provided
    const complexRating = httpData.rating
        ? {
              cleanliness: httpData.rating,
              hospitality: httpData.rating,
              services: httpData.rating,
              accuracy: httpData.rating,
              communication: httpData.rating,
              location: httpData.rating
          }
        : undefined;

    return {
        accommodationId: httpData.accommodationId,
        userId: httpData.userId,
        rating: complexRating,
        title: httpData.title,
        content: httpData.content
        // Note: stayDate, guestType, isBusinessTravel, language are HTTP-only fields
    };
};
