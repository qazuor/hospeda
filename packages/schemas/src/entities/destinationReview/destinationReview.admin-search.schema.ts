/**
 * @module destinationReview.admin-search.schema
 * @description Admin Search Schema for Destination Reviews.
 *
 * Extends the base admin search schema with destination-review-specific filters
 * for use in admin list endpoints. Provides full filtering capabilities including
 * soft-deleted records, lifecycle status, and date range filters not available
 * in the public search schema.
 *
 * @example
 * ```ts
 * const params = DestinationReviewAdminSearchSchema.parse({
 *   page: 1,
 *   pageSize: 20,
 *   status: 'ACTIVE',
 *   includeDeleted: false,
 *   destinationId: '123e4567-e89b-12d3-a456-426614174000',
 *   minRating: 4,
 *   isVerified: true,
 *   createdAfter: '2025-01-01T00:00:00Z'
 * });
 * ```
 */
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';

/**
 * Admin search schema for destination reviews.
 * Extends base admin search with destination-review-specific filters.
 *
 * Inherits from {@link AdminSearchBaseSchema}:
 * - `page` / `pageSize`: Pagination (default 1/20, max 100)
 * - `search`: Text search across title/content fields
 * - `sort`: Sort field and direction (format: "field:asc" or "field:desc")
 * - `status`: Lifecycle status filter (all, DRAFT, ACTIVE, ARCHIVED)
 * - `includeDeleted`: Include soft-deleted reviews (default false)
 * - `createdAfter` / `createdBefore`: Date range filters
 *
 * Additional filters:
 * - `destinationId`: Narrow to a specific destination
 * - `userId`: Narrow to reviews by a specific user
 * - `minRating` / `maxRating`: Filter by rating range (1-5)
 * - `isVerified`: Filter by verification status
 *
 * @example
 * ```ts
 * // List unverified reviews for a specific destination
 * const params = DestinationReviewAdminSearchSchema.parse({
 *   destinationId: 'uuid-here',
 *   isVerified: false,
 *   sort: 'createdAt:desc',
 *   includeDeleted: true
 * });
 * ```
 */
export const DestinationReviewAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by destination UUID */
    destinationId: z
        .string()
        .uuid({ message: 'zodError.admin.search.destinationReview.destinationId.uuid' })
        .optional()
        .describe('Filter reviews by destination'),

    /** Filter by reviewer user UUID */
    userId: z
        .string()
        .uuid({ message: 'zodError.admin.search.destinationReview.userId.uuid' })
        .optional()
        .describe('Filter reviews by user'),

    /** Minimum rating value (inclusive, 1-5) */
    minRating: z.coerce
        .number()
        .int()
        .min(1, { message: 'zodError.admin.search.destinationReview.minRating.min' })
        .max(5, { message: 'zodError.admin.search.destinationReview.minRating.max' })
        .optional()
        .describe('Minimum rating filter (1-5, inclusive)'),

    /** Maximum rating value (inclusive, 1-5) */
    maxRating: z.coerce
        .number()
        .int()
        .min(1, { message: 'zodError.admin.search.destinationReview.maxRating.min' })
        .max(5, { message: 'zodError.admin.search.destinationReview.maxRating.max' })
        .optional()
        .describe('Maximum rating filter (1-5, inclusive)'),

    /** Filter by verification status (true = verified only, false = unverified only) */
    isVerified: queryBooleanParam().describe(
        'Filter by verification status (true = verified only, false = unverified only)'
    )
});

/**
 * Type inferred from {@link DestinationReviewAdminSearchSchema}.
 * Represents the validated admin search parameters for destination reviews.
 */
export type DestinationReviewAdminSearch = z.infer<typeof DestinationReviewAdminSearchSchema>;
