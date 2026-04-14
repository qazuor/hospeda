import type { z } from 'zod';
import {
    AccommodationAdminSchema,
    AccommodationProtectedSchema,
    AccommodationPublicSchema
} from '../accommodation/accommodation.access.schema.js';
import {
    UserAdminSchema,
    UserProtectedSchema,
    UserPublicSchema
} from '../user/user.access.schema.js';
import { AccommodationReviewSchema } from './accommodationReview.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public review listing pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const AccommodationReviewPublicSchema = AccommodationReviewSchema.pick({
    // Identification
    id: true,

    // Relations (public safe)
    userId: true,
    accommodationId: true,

    // Review content
    title: true,
    content: true,
    rating: true,
    averageRating: true,

    // Timestamp (when the review was posted)
    createdAt: true
}).extend({
    /** Reviewer user data (public tier). Populated when the relation is loaded. */
    user: UserPublicSchema.optional(),
    /** Parent accommodation data (public tier). Populated when the relation is loaded. */
    accommodation: AccommodationPublicSchema.optional()
});

export type AccommodationReviewPublic = z.infer<typeof AccommodationReviewPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including audit timestamps.
 * Used for authenticated review interactions (own reviews, moderation helpers).
 *
 * Extends public fields with audit timestamps.
 * Note: *ById fields (createdById, updatedById) are Admin-only per established convention.
 */
export const AccommodationReviewProtectedSchema = AccommodationReviewSchema.pick({
    // All public fields
    id: true,
    userId: true,
    accommodationId: true,
    title: true,
    content: true,
    rating: true,
    averageRating: true,
    createdAt: true,

    // Audit timestamps (for authenticated users)
    updatedAt: true
}).extend({
    /** Reviewer user data (protected tier). Populated when the relation is loaded. */
    user: UserProtectedSchema.optional(),
    /** Parent accommodation data (protected tier). Populated when the relation is loaded. */
    accommodation: AccommodationProtectedSchema.optional()
});

export type AccommodationReviewProtected = z.infer<typeof AccommodationReviewProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const AccommodationReviewAdminSchema = AccommodationReviewSchema.extend({
    /** Reviewer user data (admin tier). Populated when the relation is loaded. */
    user: UserAdminSchema.optional(),
    /** Parent accommodation data (admin tier). Populated when the relation is loaded. */
    accommodation: AccommodationAdminSchema.optional()
});

export type AccommodationReviewAdmin = z.infer<typeof AccommodationReviewAdminSchema>;
