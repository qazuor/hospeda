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
 *   minRating: 3,
 *   maxRating: 5,
 *   isVerified: true,
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
 * - `minRating` / `maxRating`: Filter by rating range (1-5)
 * - `isVerified`: Filter by verification status
 *
 * @example
 * ```ts
 * // List unverified reviews for a specific accommodation
 * const params = AccommodationReviewAdminSearchSchema.parse({
 *   accommodationId: 'uuid-here',
 *   isVerified: false,
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

    /** Minimum rating value (inclusive, 1-5) */
    minRating: z.coerce
        .number()
        .int()
        .min(1, { message: 'zodError.admin.search.accommodationReview.minRating.min' })
        .max(5, { message: 'zodError.admin.search.accommodationReview.minRating.max' })
        .optional()
        .describe('Minimum rating filter (1-5, inclusive)'),

    /** Maximum rating value (inclusive, 1-5) */
    maxRating: z.coerce
        .number()
        .int()
        .min(1, { message: 'zodError.admin.search.accommodationReview.maxRating.min' })
        .max(5, { message: 'zodError.admin.search.accommodationReview.maxRating.max' })
        .optional()
        .describe('Maximum rating filter (1-5, inclusive)'),

    /**
     * Filter by verification status.
     *
     * NOTE: Uses z.coerce.boolean(). From query params, any non-empty string
     * (including "false") coerces to true. Consumers should send "true" or
     * omit the param entirely (defaults to undefined / no filter).
     */
    isVerified: z.coerce
        .boolean()
        .optional()
        .describe('Filter by verification status (true = verified only, false = unverified only)')
});

/**
 * Type inferred from {@link AccommodationReviewAdminSearchSchema}.
 * Represents the validated admin search parameters for accommodation reviews.
 */
export type AccommodationReviewAdminSearch = z.infer<typeof AccommodationReviewAdminSearchSchema>;
