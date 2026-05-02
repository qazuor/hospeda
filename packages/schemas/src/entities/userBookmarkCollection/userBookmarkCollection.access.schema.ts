import type { z } from 'zod';
import {
    UserAdminSchema,
    UserProtectedSchema,
    UserPublicSchema
} from '../user/user.access.schema.js';
import { UserBookmarkCollectionSchema } from './userBookmarkCollection.schema.js';

// ============================================================================
// USER BOOKMARK COLLECTION ACCESS SCHEMAS
// ============================================================================

/**
 * PUBLIC ACCESS SCHEMA — UserBookmarkCollection
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Collections are inherently personal; this tier supports future scenarios
 * where a user may choose to share a named collection publicly (e.g., a curated
 * travel wishlist with a shareable link).
 *
 * The `userId` is withheld to prevent user enumeration. Only the structural
 * metadata (display name, visual customisation) is exposed.
 */
export const UserBookmarkCollectionPublicSchema = UserBookmarkCollectionSchema.pick({
    id: true,
    name: true,
    color: true,
    icon: true
}).extend({
    /** Relation field — only populated when the query includes user data. */
    user: UserPublicSchema.optional()
});

export type UserBookmarkCollectionPublic = z.infer<typeof UserBookmarkCollectionPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA — UserBookmarkCollection
 *
 * Contains data for the authenticated owner of the collection.
 * Includes the `userId` so the owning user's client can verify ownership,
 * the optional `description`, and audit timestamps.
 *
 * Extends public fields with ownership and audit data.
 */
export const UserBookmarkCollectionProtectedSchema = UserBookmarkCollectionSchema.pick({
    // All public fields
    id: true,
    name: true,
    color: true,
    icon: true,

    // Ownership (visible only to the authenticated owner)
    userId: true,

    // Additional collection metadata
    description: true,

    // Audit timestamps
    createdAt: true,
    updatedAt: true
}).extend({
    /** Relation field — only populated when the query includes user data. */
    user: UserProtectedSchema.optional()
});

export type UserBookmarkCollectionProtected = z.infer<typeof UserBookmarkCollectionProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA — UserBookmarkCollection
 *
 * Contains ALL fields including soft-delete data, lifecycle state, and admin
 * metadata. Used for admin dashboard, moderation, and data management.
 *
 * This is essentially the full schema with an optional embedded user record.
 */
export const UserBookmarkCollectionAdminSchema = UserBookmarkCollectionSchema.extend({
    /** Relation field — only populated when the query includes user data. */
    user: UserAdminSchema.optional()
});

export type UserBookmarkCollectionAdmin = z.infer<typeof UserBookmarkCollectionAdminSchema>;
