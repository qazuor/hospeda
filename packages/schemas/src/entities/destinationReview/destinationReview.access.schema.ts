import type { z } from 'zod';
import { DestinationReviewSchema } from './destinationReview.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public review listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const DestinationReviewPublicSchema = DestinationReviewSchema.pick({
    // Identification
    id: true,

    // Relations (public safe)
    userId: true,
    destinationId: true,

    // Review content
    title: true,
    content: true,
    rating: true,
    averageRating: true,

    // Visit context (public safe)
    visitDate: true,
    tripType: true,
    travelSeason: true,
    language: true,

    // Recommendation (public)
    isRecommended: true,
    wouldVisitAgain: true,

    // Voting aggregates (public)
    helpfulVotes: true,
    totalVotes: true,

    // Owner engagement indicator
    hasOwnerResponse: true,

    // Timestamp (when the review was posted)
    createdAt: true
});

export type DestinationReviewPublic = z.infer<typeof DestinationReviewPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including moderation status.
 * Used for authenticated review interactions (own reviews, voting, moderation helpers).
 *
 * Extends public fields with verification, publication status, and audit timestamps.
 * Note: *ById fields (createdById, updatedById) are Admin-only per established convention.
 */
export const DestinationReviewProtectedSchema = DestinationReviewSchema.pick({
    // All public fields
    id: true,
    userId: true,
    destinationId: true,
    title: true,
    content: true,
    rating: true,
    averageRating: true,
    visitDate: true,
    tripType: true,
    travelSeason: true,
    language: true,
    isRecommended: true,
    wouldVisitAgain: true,
    helpfulVotes: true,
    totalVotes: true,
    hasOwnerResponse: true,
    createdAt: true,

    // Protected fields
    isBusinessTravel: true,
    isVerified: true,
    isPublished: true,

    // Audit timestamps (for authenticated users)
    updatedAt: true
});

export type DestinationReviewProtected = z.infer<typeof DestinationReviewProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const DestinationReviewAdminSchema = DestinationReviewSchema;

export type DestinationReviewAdmin = z.infer<typeof DestinationReviewAdminSchema>;
