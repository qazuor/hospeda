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
