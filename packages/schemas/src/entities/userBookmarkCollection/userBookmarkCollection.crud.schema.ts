import type { z } from 'zod';
import { UserBookmarkCollectionSchema } from './userBookmarkCollection.schema.js';

/**
 * UserBookmarkCollection CRUD Schemas
 *
 * This file contains schemas for Create and Update operations on
 * UserBookmarkCollection entities, following the established patterns.
 *
 * Note: `id` and `userId` are intentionally excluded from the update schema
 * because they are provided via path/URL parameters, not the request body.
 */

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

/**
 * Schema for creating a new user bookmark collection.
 *
 * Omits all server-generated fields (id, timestamps, audit trail, lifecycle,
 * and admin metadata). The caller must supply a valid `userId` (UUID) and a
 * non-empty `name` (max 60 chars). All remaining fields are optional.
 *
 * @example
 * ```ts
 * const result = UserBookmarkCollectionCreateInputSchema.safeParse({
 *   userId: '123e4567-e89b-12d3-a456-426614174001',
 *   name: 'Viaje al Litoral',
 *   description: 'Alojamientos para las vacaciones de verano',
 *   color: '#E57373',
 *   icon: 'MapPin',
 * });
 * // result.success === true
 * ```
 */
export const UserBookmarkCollectionCreateInputSchema = UserBookmarkCollectionSchema.omit({
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

/**
 * Inferred TypeScript type for creating a user bookmark collection.
 */
export type UserBookmarkCollectionCreateInput = z.infer<
    typeof UserBookmarkCollectionCreateInputSchema
>;

/**
 * Schema for updating an existing user bookmark collection.
 *
 * All editable fields (`name`, `description`, `color`, `icon`) are optional.
 * `id` and `userId` are intentionally excluded — they must come from path/URL
 * parameters, not the request body.
 *
 * @example
 * ```ts
 * const result = UserBookmarkCollectionUpdateInputSchema.safeParse({
 *   name: 'Actualizado',
 *   color: '#42A5F5',
 * });
 * // result.success === true
 * ```
 */
export const UserBookmarkCollectionUpdateInputSchema = UserBookmarkCollectionCreateInputSchema.omit(
    {
        userId: true
    }
)
    .partial()
    .strict();

/**
 * Inferred TypeScript type for updating a user bookmark collection.
 */
export type UserBookmarkCollectionUpdateInput = z.infer<
    typeof UserBookmarkCollectionUpdateInputSchema
>;
