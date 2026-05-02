import { z } from 'zod';
import { UserBookmarkSchema } from './userBookmark.schema.js';

/**
 * UserBookmark CRUD Schemas
 *
 * This file contains schemas for Create, Read, Update, Delete operations
 * for UserBookmark entities, following the established patterns.
 */

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

/**
 * Schema for creating a new user bookmark.
 * Omits server-generated fields (id, timestamps, audit fields).
 *
 * `collectionId` is optional at create-time (defaults to null — uncollected).
 * This allows seed scripts and admin-level callers to set the collection
 * directly during creation. UI consumers typically use the dedicated
 * `addBookmarkToCollection` endpoint instead of passing `collectionId` here.
 *
 * NOTE (security): the service layer does NOT currently validate that the actor
 * owns the referenced collection when `collectionId` is provided at create-time.
 * This is acceptable for seed/admin usage. A future task should add ownership
 * validation in the HTTP create handler for untrusted callers.
 */
export const UserBookmarkCreateInputSchema = UserBookmarkSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true,
    lifecycleState: true,
    adminInfo: true
}).strict();
export type UserBookmarkCreateInput = z.infer<typeof UserBookmarkCreateInputSchema>;

/**
 * Schema for updating an existing user bookmark
 * All fields are optional except identification fields
 */
export const UserBookmarkUpdateInputSchema = UserBookmarkCreateInputSchema.partial()
    .extend({
        // Require identification fields for updates
        userId: UserBookmarkCreateInputSchema.shape.userId,
        entityId: UserBookmarkCreateInputSchema.shape.entityId,
        entityType: UserBookmarkCreateInputSchema.shape.entityType
    })
    .strict();
export type UserBookmarkUpdateInput = z.infer<typeof UserBookmarkUpdateInputSchema>;

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

/**
 * Schema for user bookmark creation response
 * Returns the created bookmark entity
 */
export const UserBookmarkCreateOutputSchema = z
    .object({
        userBookmark: UserBookmarkSchema
    })
    .strict();
export type UserBookmarkCreateOutput = z.infer<typeof UserBookmarkCreateOutputSchema>;

/**
 * Schema for user bookmark update response
 * Returns the updated bookmark entity
 */
export const UserBookmarkUpdateOutputSchema = z
    .object({
        userBookmark: UserBookmarkSchema
    })
    .strict();
export type UserBookmarkUpdateOutput = z.infer<typeof UserBookmarkUpdateOutputSchema>;

/**
 * Schema for user bookmark get response
 * Returns a single bookmark entity
 */
export const UserBookmarkGetOutputSchema = z
    .object({
        userBookmark: UserBookmarkSchema
    })
    .strict();
export type UserBookmarkGetOutput = z.infer<typeof UserBookmarkGetOutputSchema>;

// ============================================================================
// NOTES UPDATE SCHEMA (inline notes editor — SPEC-098 T-032/T-034)
// ============================================================================

/**
 * Schema for updating only the user-editable note fields on a bookmark.
 * Strict: no extra fields allowed.
 * Both fields are optional so the caller can update just one at a time.
 *
 * Constraints match the base schema minus the minimum length requirement
 * (a blank name clears the label; a blank description clears the note).
 */
export const UserBookmarkUpdateNotesSchema = z
    .object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(300).optional()
    })
    .strict();

export type UserBookmarkUpdateNotesInput = z.infer<typeof UserBookmarkUpdateNotesSchema>;
