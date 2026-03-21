/**
 * @module accommodationReview.admin-search.schema
 * @description Admin Search Schema for Accommodation Reviews.
 *
 * Extends the base admin search schema with accommodation-review-specific filters
 * for use in admin list endpoints. Provides full filtering capabilities including
 * soft-deleted records, lifecycle status, and date range filters not available
 * in the public search schema.
 *
 * @example
 * ```ts
 * const params = AccommodationReviewAdminSearchSchema.parse({
 *   page: 1,
 *   pageSize: 20,
 *   status: 'ACTIVE',
 *   includeDeleted: false,
 *   accommodationId: '123e4567-e89b-12d3-a456-426614174000',
 *   minRating: 3.5,
 *   maxRating: 5,
 *   createdAfter: '2025-01-01T00:00:00Z'
 * });
 * ```
 */
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';

/**
 * Admin search schema for accommodation reviews.
 * Extends base admin search with accommodation-review-specific filters.
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
 * - `accommodationId`: Narrow to a specific accommodation
 * - `userId`: Narrow to reviews by a specific user
 * - `minRating` / `maxRating`: Filter by average rating range (1-5, supports decimals)
 *
 * Note: The `accommodation_reviews` table has no `isVerified` column.
 * The `averageRating` column is `numeric(3,2)` storing decimals like 4.50.
 *
 * @example
 * ```ts
 * // List reviews with rating >= 4.0 for a specific accommodation
 * const params = AccommodationReviewAdminSearchSchema.parse({
 *   accommodationId: 'uuid-here',
 *   minRating: 4.0,
 *   sort: 'createdAt:desc'
 * });
 * ```
 */
export const AccommodationReviewAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by accommodation UUID */
    accommodationId: z
        .string()
        .uuid({ message: 'zodError.admin.search.accommodationReview.accommodationId.uuid' })
        .optional()
        .describe('Filter reviews by accommodation'),

    /** Filter by reviewer user UUID */
    userId: z
        .string()
        .uuid({ message: 'zodError.admin.search.accommodationReview.userId.uuid' })
        .optional()
        .describe('Filter reviews by user'),

    /** Minimum average rating value (inclusive, 1-5, supports decimals like 3.5) */
    minRating: z.coerce
        .number()
        .min(1, { message: 'zodError.admin.search.accommodationReview.minRating.min' })
        .max(5, { message: 'zodError.admin.search.accommodationReview.minRating.max' })
        .optional()
        .describe('Minimum average rating filter (1-5, inclusive, supports decimals)'),

    /** Maximum average rating value (inclusive, 1-5, supports decimals like 4.5) */
    maxRating: z.coerce
        .number()
        .min(1, { message: 'zodError.admin.search.accommodationReview.maxRating.min' })
        .max(5, { message: 'zodError.admin.search.accommodationReview.maxRating.max' })
        .optional()
        .describe('Maximum average rating filter (1-5, inclusive, supports decimals)')
});

/**
 * Type inferred from {@link AccommodationReviewAdminSearchSchema}.
 * Represents the validated admin search parameters for accommodation reviews.
 */
export type AccommodationReviewAdminSearch = z.infer<typeof AccommodationReviewAdminSearchSchema>;
