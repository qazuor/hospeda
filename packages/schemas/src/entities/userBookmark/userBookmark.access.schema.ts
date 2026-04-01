import type { z } from 'zod';
import { UserBookmarkSchema } from './userBookmark.schema.js';

// ============================================================================
// USER BOOKMARK ACCESS SCHEMAS
// ============================================================================

/**
 * PUBLIC ACCESS SCHEMA — UserBookmark
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Bookmarks are personal by nature; this tier supports future shared-bookmark
 * or collections features where a user may opt in to sharing a bookmark publicly.
 *
 * The userId is withheld to prevent user enumeration. Only structural metadata
 * (what entity was bookmarked and an optional display name) is exposed.
 */
export const UserBookmarkPublicSchema = UserBookmarkSchema.pick({
    // Identification
    id: true,

    // What was bookmarked (safe for shared/public contexts)
    entityId: true,
    entityType: true,

    // Optional display name chosen by the user
    name: true
});

export type UserBookmarkPublic = z.infer<typeof UserBookmarkPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA — UserBookmark
 *
 * Contains data for the authenticated owner of the bookmark.
 * Includes the userId so the owning user's own client can verify ownership,
 * the full description, and audit timestamps.
 *
 * Extends public fields with ownership and audit data.
 */
export const UserBookmarkProtectedSchema = UserBookmarkSchema.pick({
    // All public fields
    id: true,
    entityId: true,
    entityType: true,
    name: true,

    // Ownership (visible only to the authenticated owner)
    userId: true,

    // Additional bookmark metadata
    description: true,

    // Audit timestamps
    createdAt: true,
    updatedAt: true
});

export type UserBookmarkProtected = z.infer<typeof UserBookmarkProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA — UserBookmark
 *
 * Contains ALL fields including soft-delete and admin-only audit data.
 * Used for admin dashboard, moderation, and data management.
 *
 * This is essentially the full schema.
 */
export const UserBookmarkAdminSchema = UserBookmarkSchema;

export type UserBookmarkAdmin = z.infer<typeof UserBookmarkAdminSchema>;
