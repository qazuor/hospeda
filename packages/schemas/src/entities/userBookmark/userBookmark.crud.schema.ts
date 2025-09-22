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
 * Schema for creating a new user bookmark
 * Omits server-generated fields (id, timestamps, audit fields)
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
