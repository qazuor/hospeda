/**
 * @module destinationReview.admin-search.schema
 * @description Admin Search Schema for Destination Reviews.
 *
 * Extends the base admin search schema with destination-review-specific filters
 * for use in admin list endpoints. Provides full filtering capabilities including
 * soft-deleted records and date range filters not available in the public search schema.
 *
 * `lifecycleState` filter is inherited from AdminSearchBaseSchema via its `status`
 * field (SPEC-063 adds the column and removes the prior workaround).
 *
 * @example
 * ```ts
 * const params = DestinationReviewAdminSearchSchema.parse({
 *   page: 1,
 *   pageSize: 20,
 *   includeDeleted: false,
 *   status: 'DRAFT',
 *   destinationId: '123e4567-e89b-12d3-a456-426614174000',
 *   minRating: 4.0,
 *   createdAfter: '2025-01-01T00:00:00Z'
 * });
 * ```
 */
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';

/**
 * Admin search schema for destination reviews.
 * Extends base admin search with destination-review-specific filters.
 *
 * Inherits from {@link AdminSearchBaseSchema}:
 * - `page` / `pageSize`: Pagination (default 1/20, max 100)
 * - `search`: Text search across title/content fields
 * - `sort`: Sort field and direction (format: "field:asc" or "field:desc")
 * - `includeDeleted`: Include soft-deleted reviews (default false)
 * - `createdAfter` / `createdBefore`: Date range filters
 *
 * Additional filters:
 * - `destinationId`: Narrow to a specific destination
 * - `userId`: Narrow to reviews by a specific user
 * - `minRating` / `maxRating`: Filter by average rating range (1-5, supports decimals)
 *
 * Note: The `destination_reviews` table has no `isVerified` column.
 * The `averageRating` column is `numeric(3,2)` storing decimals like 4.50.
 *
 * @example
 * ```ts
 * // List reviews with high ratings for a specific destination
 * const params = DestinationReviewAdminSearchSchema.parse({
 *   destinationId: 'uuid-here',
 *   minRating: 4.0,
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

    /** Minimum average rating value (inclusive, 1-5, supports decimals like 3.5) */
    minRating: z.coerce
        .number()
        .min(1, { message: 'zodError.admin.search.destinationReview.minRating.min' })
        .max(5, { message: 'zodError.admin.search.destinationReview.minRating.max' })
        .optional()
        .describe('Minimum average rating filter (1-5, inclusive, supports decimals)'),

    /** Maximum average rating value (inclusive, 1-5, supports decimals like 4.5) */
    maxRating: z.coerce
        .number()
        .min(1, { message: 'zodError.admin.search.destinationReview.maxRating.min' })
        .max(5, { message: 'zodError.admin.search.destinationReview.maxRating.max' })
        .optional()
        .describe('Maximum average rating filter (1-5, inclusive, supports decimals)')
});

/**
 * Type inferred from {@link DestinationReviewAdminSearchSchema}.
 * Represents the validated admin search parameters for destination reviews.
 */
export type DestinationReviewAdminSearch = z.infer<typeof DestinationReviewAdminSearchSchema>;
