import { z } from 'zod';
import { AdminInfoSchema } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { UserBookmarkCollectionIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';

/**
 * User Bookmark Collection schema definition using Zod for validation.
 *
 * Represents a named collection (wishlist) created by an authenticated user to
 * organise their bookmarks. Each collection belongs to one user and optionally
 * carries a display colour (hex) and an icon name from the `@repo/icons` subset.
 * Soft-delete semantics are enforced via the audit `deletedAt` field.
 *
 * @example
 * ```ts
 * const result = UserBookmarkCollectionSchema.safeParse({
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   userId: '123e4567-e89b-12d3-a456-426614174001',
 *   name: 'Viaje al Litoral',
 *   description: 'Alojamientos para las vacaciones de verano',
 *   color: '#E57373',
 *   icon: 'MapPin',
 *   lifecycleState: 'ACTIVE',
 *   adminInfo: null,
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 *   createdById: null,
 *   updatedById: null,
 *   deletedAt: null,
 *   deletedById: null,
 * });
 * // result.success === true
 * ```
 */
export const UserBookmarkCollectionSchema = z.object({
    // Base fields
    id: UserBookmarkCollectionIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,

    // Admin info (optional JSONB blob)
    adminInfo: AdminInfoSchema.nullable().optional(),

    // Collection fields
    userId: UserIdSchema,
    name: z
        .string({ message: 'zodError.userBookmarkCollection.name.required' })
        .min(1, { message: 'zodError.userBookmarkCollection.name.min' })
        .max(60, { message: 'zodError.userBookmarkCollection.name.max' }),
    description: z
        .string()
        .max(300, { message: 'zodError.userBookmarkCollection.description.max' })
        .nullable()
        .optional(),
    color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, {
            message: 'zodError.userBookmarkCollection.color.invalidHex'
        })
        .nullable()
        .optional(),
    icon: z
        .string()
        .max(40, { message: 'zodError.userBookmarkCollection.icon.max' })
        .nullable()
        .optional()
});

/**
 * Type for UserBookmarkCollection, inferred from UserBookmarkCollectionSchema.
 */
export type UserBookmarkCollection = z.infer<typeof UserBookmarkCollectionSchema>;
