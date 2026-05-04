import { z } from 'zod';

/**
 * Public Platform Stats Schema
 *
 * Aggregate read-only counters and the global accommodation rating
 * exposed publicly to power marketing surfaces (footer trust signals,
 * landing hero stats, etc.).
 *
 * All counts are restricted to publicly visible, non-deleted entities so
 * the numbers reflect what an unauthenticated visitor can actually browse.
 */
export const PublicPlatformStatsSchema = z.object({
    /** Total of public, non-deleted accommodations. */
    accommodations: z.number().int().nonnegative({
        message: 'zodError.publicStats.accommodations.nonnegative'
    }),

    /** Total of public, non-deleted destinations. */
    destinations: z.number().int().nonnegative({
        message: 'zodError.publicStats.destinations.nonnegative'
    }),

    /** Total of public, non-deleted events. */
    events: z.number().int().nonnegative({
        message: 'zodError.publicStats.events.nonnegative'
    }),

    /** Total of published, non-deleted posts. */
    posts: z.number().int().nonnegative({
        message: 'zodError.publicStats.posts.nonnegative'
    }),

    /** Combined total of accommodation + destination reviews (non-deleted). */
    reviews: z.number().int().nonnegative({
        message: 'zodError.publicStats.reviews.nonnegative'
    }),

    /**
     * Global average of accommodation ratings, on a 0-5 scale rounded to 2
     * decimals. Returns 0 when there are no rated accommodations.
     */
    averageRating: z
        .number()
        .min(0, { message: 'zodError.publicStats.averageRating.min' })
        .max(5, { message: 'zodError.publicStats.averageRating.max' }),

    /**
     * Up to N avatar URLs of users who recently reviewed an accommodation.
     * Used to populate the "social proof" overlay in marketing surfaces with
     * real user avatars (no placeholders). Only users with a non-empty
     * `users.image` or `profile.avatar` are included; deleted users are
     * filtered out. May be empty when no rated accommodations exist or no
     * recent reviewers have an avatar.
     */
    recentReviewerAvatars: z
        .array(z.string().url({ message: 'zodError.publicStats.recentReviewerAvatars.itemUrl' }))
        .default([])
});

export type PublicPlatformStats = z.infer<typeof PublicPlatformStatsSchema>;
