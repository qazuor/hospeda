import { z } from 'zod';
import { BaseAuditFields } from '../../../common/audit.schema.js';
import { CommerceRatingSchema } from '../../../common/commerce-rating.schema.js';
import { UserIdSchema } from '../../../common/id.schema.js';
import { BaseLifecycleFields } from '../../../common/lifecycle.schema.js';
import { BaseModerationFields } from '../../../common/moderation.schema.js';

/**
 * Experience Review Schema — User review for an experience listing.
 *
 * Mirrors the `GastronomyReviewSchema` pattern but uses
 * {@link CommerceRatingSchema} for the rating breakdown (service / value /
 * guide / overall) instead of gastronomy-specific dimensions.
 *
 * Columns match the `experience_reviews` DB table exactly:
 * - `title` (text, nullable) — optional short headline for the review.
 * - `content` (text, nullable) — optional free-text body.
 * - `averageRating` (numeric 3,2) — computed average of the rating breakdown.
 * - `overallRating` (numeric 3,2) — aggregated scalar rating shown on cards.
 *
 * Moderation fields are included so the admin can approve or reject reviews
 * before they are surfaced to the public.
 */
export const ExperienceReviewSchema = z.object({
    // Base ID
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    // Foreign key to the reviewed experience listing
    experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    // Reviewer reference (nullable: guest reviews without an account are allowed)
    userId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }).nullable(),

    /**
     * Optional short headline / title for the review.
     * Nullable: the reviewer may omit it.
     */
    title: z
        .string()
        .min(3, { message: 'zodError.experience.review.title.min' })
        .max(255, { message: 'zodError.experience.review.title.max' })
        .nullable()
        .optional(),

    /**
     * Free-text review body.
     * Optional; the reviewer may submit a rating-only review.
     * Nullable to match the DB column which allows NULL.
     */
    content: z
        .string()
        .min(10, { message: 'zodError.experience.review.content.min' })
        .max(2000, { message: 'zodError.experience.review.content.max' })
        .nullable()
        .optional(),

    /**
     * Granular rating breakdown using commerce-specific dimensions.
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
        .number({ message: 'zodError.experience.review.overallRating.required' })
        .min(1, { message: 'zodError.experience.review.overallRating.min' })
        .max(5, { message: 'zodError.experience.review.overallRating.max' }),

    /**
     * Reviewer display name (for guest reviews without a registered account).
     * May be null for authenticated users whose display name comes from the users table.
     */
    reviewerName: z.string().max(100).nullish(),

    /**
     * UUID of the user who last performed a moderation action.
     * Nullable until a moderator acts on the review.
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

/** TypeScript type for {@link ExperienceReviewSchema}. */
export type ExperienceReview = z.infer<typeof ExperienceReviewSchema>;

// ----------------------------------------------------------------------------
// CRUD Input Schemas
// ----------------------------------------------------------------------------

/**
 * Input schema for creating an experience review.
 *
 * `experienceId` and `overallRating` are the only required fields.
 * `title` and `content` mirror the DB columns (both nullable/optional).
 * `averageRating` is server-computed from the rating breakdown; clients
 * must NOT send it — it is omitted from the create input.
 */
export const ExperienceReviewCreateInputSchema = z.object({
    experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    overallRating: z
        .number({ message: 'zodError.experience.review.overallRating.required' })
        .min(1, { message: 'zodError.experience.review.overallRating.min' })
        .max(5, { message: 'zodError.experience.review.overallRating.max' }),
    rating: CommerceRatingSchema.optional(),
    /** Optional review headline. */
    title: z
        .string()
        .min(3, { message: 'zodError.experience.review.title.min' })
        .max(255, { message: 'zodError.experience.review.title.max' })
        .optional(),
    /** Optional free-text review body. */
    content: z
        .string()
        .min(10, { message: 'zodError.experience.review.content.min' })
        .max(2000, { message: 'zodError.experience.review.content.max' })
        .optional(),
    reviewerName: z.string().max(100).optional()
});

/** TypeScript type for {@link ExperienceReviewCreateInputSchema}. */
export type ExperienceReviewCreateInput = z.infer<typeof ExperienceReviewCreateInputSchema>;

/**
 * Input schema for updating an experience review (partial).
 */
export const ExperienceReviewUpdateInputSchema = ExperienceReviewCreateInputSchema.omit({
    experienceId: true
}).partial();

/** TypeScript type for {@link ExperienceReviewUpdateInputSchema}. */
export type ExperienceReviewUpdateInput = z.infer<typeof ExperienceReviewUpdateInputSchema>;
