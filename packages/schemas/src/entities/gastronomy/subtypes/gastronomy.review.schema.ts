import { z } from 'zod';
import { BaseAuditFields } from '../../../common/audit.schema.js';
import { CommerceRatingSchema } from '../../../common/commerce-rating.schema.js';
import { UserIdSchema } from '../../../common/id.schema.js';
import { BaseLifecycleFields } from '../../../common/lifecycle.schema.js';
import { BaseModerationFields } from '../../../common/moderation.schema.js';

/**
 * Gastronomy Review Schema — User review for a gastronomy listing.
 *
 * Mirrors the accommodation review subtype pattern but uses
 * {@link CommerceRatingSchema} for the rating breakdown (food / service /
 * ambiance / value) instead of accommodation-specific dimensions.
 *
 * Columns match the `gastronomy_reviews` DB table exactly:
 * - `title` (text, nullable) — optional short headline for the review.
 * - `content` (text, nullable) — optional free-text body.
 * - `averageRating` (numeric 3,2) — computed average of the rating breakdown.
 * - `overallRating` (numeric 3,2) — aggregated scalar rating shown on cards.
 *
 * Moderation fields are included so the admin can approve or reject reviews
 * before they are surfaced to the public.
 */
export const GastronomyReviewSchema = z.object({
    // Base ID
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    // Foreign key to the reviewed gastronomy listing
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    // Reviewer reference (nullable: guest reviews without an account are allowed)
    userId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }).nullable(),

    /**
     * Optional short headline / title for the review (mirrors accommodation_reviews.title).
     * Nullable: the reviewer may omit it.
     */
    title: z
        .string()
        .min(3, { message: 'zodError.gastronomy.review.title.min' })
        .max(255, { message: 'zodError.gastronomy.review.title.max' })
        .nullable()
        .optional(),

    /**
     * Free-text review body (mirrors accommodation_reviews.content).
     * Optional; the reviewer may submit a rating-only review.
     * Nullable to match the DB column which allows NULL.
     */
    content: z
        .string()
        .min(10, { message: 'zodError.gastronomy.review.content.min' })
        .max(2000, { message: 'zodError.gastronomy.review.content.max' })
        .nullable()
        .optional(),

    /**
     * Granular rating breakdown using commerce-specific dimensions:
     * food / service / ambiance / value.
     * Optional: the reviewer may submit an overall rating without breakdown.
     */
    rating: CommerceRatingSchema.optional(),

    /**
     * Computed average of all granular rating categories (0.00–5.00).
     * Mirrors the `average_rating` numeric(3,2) column; default 0.
     */
    averageRating: z.number().min(0).max(5).default(0),

    /**
     * Overall aggregated rating score (0.00–5.00).
     * Serves as the scalar aggregate displayed on listing cards.
     * Mirrors the `overall_rating` numeric(3,2) column; required on creation.
     */
    overallRating: z
        .number({ message: 'zodError.gastronomy.review.overallRating.required' })
        .min(1, { message: 'zodError.gastronomy.review.overallRating.min' })
        .max(5, { message: 'zodError.gastronomy.review.overallRating.max' }),

    /**
     * Reviewer display name (for guest reviews without a registered account).
     * May be null for authenticated users whose display name comes from the users table.
     */
    reviewerName: z.string().max(100).nullish(),

    /**
     * UUID of the user who last performed a moderation action.
     * Nullable until a moderator acts on the review.
     * Mirrors the `moderated_by_id` column in `gastronomy_reviews`.
     */
    moderatedById: UserIdSchema.nullish(),

    /**
     * Timestamp of the last moderation action.
     * Nullable until the first moderation action is performed.
     */
    moderatedAt: z.coerce.date().nullish(),

    /**
     * Free-text reason provided by the moderator.
     * Nullable; expected for REJECTED decisions by convention.
     */
    moderationReason: z.string().nullish(),

    // Lifecycle, moderation, and audit
    ...BaseLifecycleFields,
    ...BaseModerationFields,
    ...BaseAuditFields
});

/** TypeScript type for {@link GastronomyReviewSchema}. */
export type GastronomyReview = z.infer<typeof GastronomyReviewSchema>;

// ----------------------------------------------------------------------------
// CRUD Input Schemas
// ----------------------------------------------------------------------------

/**
 * Input schema for creating a gastronomy review.
 *
 * `gastronomyId` and `overallRating` are the only required fields.
 * `title` and `content` mirror the DB columns (both nullable/optional).
 * `averageRating` is server-computed from the rating breakdown; clients
 * must NOT send it — it is omitted from the create input.
 */
export const GastronomyReviewCreateInputSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    overallRating: z
        .number({ message: 'zodError.gastronomy.review.overallRating.required' })
        .min(1, { message: 'zodError.gastronomy.review.overallRating.min' })
        .max(5, { message: 'zodError.gastronomy.review.overallRating.max' }),
    rating: CommerceRatingSchema.optional(),
    /** Optional review headline (mirrors `title` DB column). */
    title: z
        .string()
        .min(3, { message: 'zodError.gastronomy.review.title.min' })
        .max(255, { message: 'zodError.gastronomy.review.title.max' })
        .optional(),
    /** Optional free-text review body (mirrors `content` DB column). */
    content: z
        .string()
        .min(10, { message: 'zodError.gastronomy.review.content.min' })
        .max(2000, { message: 'zodError.gastronomy.review.content.max' })
        .optional(),
    reviewerName: z.string().max(100).optional()
});

/** TypeScript type for {@link GastronomyReviewCreateInputSchema}. */
export type GastronomyReviewCreateInput = z.infer<typeof GastronomyReviewCreateInputSchema>;

/**
 * Input schema for updating a gastronomy review (partial).
 */
export const GastronomyReviewUpdateInputSchema = GastronomyReviewCreateInputSchema.omit({
    gastronomyId: true
}).partial();

/** TypeScript type for {@link GastronomyReviewUpdateInputSchema}. */
export type GastronomyReviewUpdateInput = z.infer<typeof GastronomyReviewUpdateInputSchema>;
