import type { z } from 'zod';
import { PostSponsorshipSchema } from './postSponsorship.schema.js';

// ============================================================================
// POST SPONSORSHIP ACCESS SCHEMAS
// ============================================================================

/**
 * PUBLIC ACCESS SCHEMA — PostSponsorship
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public sponsorship display (e.g., "sponsored by" labels on posts).
 *
 * Financial information (paid amount, paidAt) and lifecycle state are withheld.
 */
export const PostSponsorshipPublicSchema = PostSponsorshipSchema.pick({
    // Identification
    id: true,
    postId: true,
    sponsorId: true,

    // Display fields
    description: true,
    message: true,
    isHighlighted: true,

    // Validity window (safe to show publicly for display purposes)
    fromDate: true,
    toDate: true
});

export type PostSponsorshipPublic = z.infer<typeof PostSponsorshipPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA — PostSponsorship
 *
 * Contains data for authenticated users, including payment information
 * and lifecycle state. Used for sponsor self-service views and contributor pages.
 *
 * Extends public fields with financial and audit data.
 */
export const PostSponsorshipProtectedSchema = PostSponsorshipSchema.pick({
    // All public fields
    id: true,
    postId: true,
    sponsorId: true,
    description: true,
    message: true,
    isHighlighted: true,
    fromDate: true,
    toDate: true,

    // Financial data visible to the sponsoring party
    paid: true,
    paidAt: true,

    // Lifecycle
    lifecycleState: true,

    // Audit timestamps
    createdAt: true,
    updatedAt: true
});

export type PostSponsorshipProtected = z.infer<typeof PostSponsorshipProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA — PostSponsorship
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const PostSponsorshipAdminSchema = PostSponsorshipSchema;

export type PostSponsorshipAdmin = z.infer<typeof PostSponsorshipAdminSchema>;
