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
