/**
 * DestinationReview HTTP Schemas
 *
 * HTTP-compatible schemas for destination review operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import { BaseHttpSearchSchema, createBooleanQueryParam } from '../../api/http/base-http.schema.js';

/**
 * HTTP-compatible destination review search schema with automatic coercion
 * Uses FLAT filter pattern for HTTP compatibility
 */
export const DestinationReviewSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Entity relation filters with HTTP coercion
    destinationId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),

    // Rating filters with HTTP coercion
    minRating: z.coerce.number().min(1).max(5).optional(),
    maxRating: z.coerce.number().min(1).max(5).optional(),
    rating: z.coerce.number().min(1).max(5).optional(),

    // Content filters with HTTP coercion
    hasTitle: createBooleanQueryParam('Filter reviews with titles'),
    hasContent: createBooleanQueryParam('Filter reviews with content'),
    hasImages: createBooleanQueryParam('Filter reviews with images'),
    minContentLength: z.coerce.number().int().min(0).optional(),
    maxContentLength: z.coerce.number().int().min(0).optional(),

    // Date filters with HTTP coercion
    reviewedAfter: z.coerce.date().optional(),
    reviewedBefore: z.coerce.date().optional(),
    visitedAfter: z.coerce.date().optional(),
    visitedBefore: z.coerce.date().optional(),

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

    // Trip type filters
    tripType: z.string().optional(),
    travelSeason: z.string().optional(),
    isBusinessTravel: createBooleanQueryParam('Filter business travel reviews'),
    isReturningVisitor: createBooleanQueryParam('Filter returning visitor reviews'),

    // Recommendation filters with HTTP coercion
    isRecommended: createBooleanQueryParam('Filter recommended destinations'),
    wouldVisitAgain: createBooleanQueryParam('Filter reviews by visitors who would return')
});

export type DestinationReviewSearchHttp = z.infer<typeof DestinationReviewSearchHttpSchema>;

/**
 * HTTP-compatible destination reviews by destination schema
 * For listing reviews of a specific destination with basic pagination
 */
export const DestinationReviewsByDestinationHttpSchema = BaseHttpSearchSchema.extend({
    // No additional filters needed - uses basic pagination from BaseHttpSearchSchema
    // destinationId comes from path params, not query params
});

export type DestinationReviewsByDestinationHttp = z.infer<
    typeof DestinationReviewsByDestinationHttpSchema
>;

/**
 * HTTP-compatible destination review creation schema
 * Handles form data and JSON input for creating reviews via HTTP
 */
export const DestinationReviewCreateHttpSchema = z.object({
    destinationId: z.string().uuid(),
    userId: z.string().uuid(),
    rating: z.coerce.number().min(1).max(5),
    title: z.string().min(5).max(200).optional(),
    content: z.string().min(10).max(2000).optional(),
    visitDate: z.coerce.date().optional(),
    tripType: z.string().optional(),
    travelSeason: z.string().optional(),
    isBusinessTravel: z.coerce.boolean().default(false),
    isRecommended: z.coerce.boolean().default(true),
    wouldVisitAgain: z.coerce.boolean().default(true),
    language: z.string().length(2).default('en')
});

export type DestinationReviewCreateHttp = z.infer<typeof DestinationReviewCreateHttpSchema>;

/**
 * HTTP-compatible destination review update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const DestinationReviewUpdateHttpSchema = DestinationReviewCreateHttpSchema.partial();

export type DestinationReviewUpdateHttp = z.infer<typeof DestinationReviewUpdateHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import type { DestinationReviewSearchInput } from './destinationReview.query.schema.js';

import type {
    DestinationReviewCreateInput,
    DestinationReviewUpdateInput
} from './destinationReview.crud.schema.js';

/**
 * Convert HTTP destination review search parameters to domain search schema
 * Handles coercion from HTTP query strings to proper domain types
 */
export const httpToDomainDestinationReviewSearch = (
    httpParams: DestinationReviewSearchHttp
): DestinationReviewSearchInput => {
    return {
        // Base search fields
        page: httpParams.page,
        pageSize: httpParams.pageSize,
        sortBy: httpParams.sortBy,
        sortOrder: httpParams.sortOrder,
        q: httpParams.q,

        // Entity relation filters
        destinationId: httpParams.destinationId,
        userId: httpParams.userId,

        // Rating filters
        minRating: httpParams.minRating,
        maxRating: httpParams.maxRating,
        rating: httpParams.rating,

        // Content filters
        hasTitle: httpParams.hasTitle,
        hasContent: httpParams.hasContent,
        hasImages: httpParams.hasImages,
        minContentLength: httpParams.minContentLength,
        maxContentLength: httpParams.maxContentLength,

        // Date filters
        reviewedAfter: httpParams.reviewedAfter,
        reviewedBefore: httpParams.reviewedBefore,
        visitedAfter: httpParams.visitedAfter,
        visitedBefore: httpParams.visitedBefore,

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

        // Trip type filters
        tripType: httpParams.tripType,
        travelSeason: httpParams.travelSeason,
        isBusinessTravel: httpParams.isBusinessTravel,
        isReturningVisitor: httpParams.isReturningVisitor,

        // Recommendation filters
        isRecommended: httpParams.isRecommended,
        wouldVisitAgain: httpParams.wouldVisitAgain
    };
};

/**
 * Convert HTTP destination review create data to domain create input
 * Handles form data conversion to proper domain types
 * Note: rating is converted from single number to complex rating object
 * Note: Some HTTP fields may not be included in domain schema
 */
export const httpToDomainDestinationReviewCreate = (
    httpData: DestinationReviewCreateHttp
): DestinationReviewCreateInput => {
    // Convert simple rating number to complex rating object with equal values
    const ratingValue = httpData.rating;
    const complexRating = {
        landscape: ratingValue,
        attractions: ratingValue,
        accessibility: ratingValue,
        safety: ratingValue,
        cleanliness: ratingValue,
        hospitality: ratingValue,
        culturalOffer: ratingValue,
        gastronomy: ratingValue,
        affordability: ratingValue,
        nightlife: ratingValue,
        infrastructure: ratingValue,
        environmentalCare: ratingValue,
        wifiAvailability: ratingValue,
        shopping: ratingValue,
        beaches: ratingValue,
        greenSpaces: ratingValue,
        localEvents: ratingValue,
        weatherSatisfaction: ratingValue
    };

    return {
        destinationId: httpData.destinationId,
        userId: httpData.userId,
        rating: complexRating,
        title: httpData.title,
        content: httpData.content
        // Note: visitDate, tripType, travelSeason, isBusinessTravel, isRecommended,
        // wouldVisitAgain, language are HTTP-only fields not in domain schema
    };
};

/**
 * Convert HTTP destination review update data to domain update input
 * Handles partial updates from HTTP PATCH requests
 * Note: rating is converted from single number to complex rating object if provided
 */
export const httpToDomainDestinationReviewUpdate = (
    httpData: DestinationReviewUpdateHttp
): DestinationReviewUpdateInput => {
    // Convert simple rating number to complex rating object with equal values if provided
    const complexRating = httpData.rating
        ? {
              landscape: httpData.rating,
              attractions: httpData.rating,
              accessibility: httpData.rating,
              safety: httpData.rating,
              cleanliness: httpData.rating,
              hospitality: httpData.rating,
              culturalOffer: httpData.rating,
              gastronomy: httpData.rating,
              affordability: httpData.rating,
              nightlife: httpData.rating,
              infrastructure: httpData.rating,
              environmentalCare: httpData.rating,
              wifiAvailability: httpData.rating,
              shopping: httpData.rating,
              beaches: httpData.rating,
              greenSpaces: httpData.rating,
              localEvents: httpData.rating,
              weatherSatisfaction: httpData.rating
          }
        : undefined;

    return {
        rating: complexRating,
        title: httpData.title,
        content: httpData.content
        // Note: destinationId and userId are not updatable in domain schema
        // Note: visitDate, tripType, travelSeason, isBusinessTravel, isRecommended,
        // wouldVisitAgain, language are HTTP-only fields not in domain schema
    };
};
