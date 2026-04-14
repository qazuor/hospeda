import { z } from 'zod';
import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import {
    DestinationAdminSchema,
    DestinationProtectedSchema,
    DestinationPublicSchema
} from '../destination/destination.access.schema.js';
import {
    UserAdminSchema,
    UserProtectedSchema,
    UserPublicSchema
} from '../user/user.access.schema.js';
import { DestinationReviewSchema } from './destinationReview.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public review listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 * Extends with optional relation fields so that safeParse() does not strip relation
 * data returned by the API when relations are eagerly loaded.
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
}).extend({
    /** Public user data joined from users table. No sensitive fields. */
    user: UserPublicSchema.optional(),
    /** Public destination data joined from destinations table. No sensitive fields. */
    destination: DestinationPublicSchema.optional()
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
}).extend({
    /** Protected user data for authenticated context. */
    user: UserProtectedSchema.optional(),
    /** Protected destination data for authenticated context. */
    destination: DestinationProtectedSchema.optional()
});

export type DestinationReviewProtected = z.infer<typeof DestinationReviewProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * Extends the full schema with relation fields and the preemptive lifecycleState
 * field introduced in SPEC-063.
 */
export const DestinationReviewAdminSchema = DestinationReviewSchema.extend({
    /** Full admin user data for admin dashboard and audit purposes. */
    user: UserAdminSchema.optional(),
    /** Full admin destination data for admin dashboard and audit purposes. */
    destination: DestinationAdminSchema.optional(),
    /**
     * Lifecycle state for admin moderation workflow.
     * Preemptively added here per SPEC-063 — will be a required field
     * on the base schema once SPEC-063 is implemented.
     */
    lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()
});

export type DestinationReviewAdmin = z.infer<typeof DestinationReviewAdminSchema>;
