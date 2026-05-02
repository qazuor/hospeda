import { z } from 'zod';
import { UserBookmarkCollectionIdSchema, UserBookmarkIdSchema } from '../../common/id.schema.js';

// ============================================================================
// PATH / ROUTE PARAMETER SCHEMAS
// ============================================================================

/**
 * Path parameter schema for routes that target a single collection.
 *
 * Used by:
 * - GET `/user-bookmark-collections/:id`
 * - PATCH `/user-bookmark-collections/:id`
 * - DELETE `/user-bookmark-collections/:id`
 *
 * @example
 * ```ts
 * const params = UserBookmarkCollectionIdParamSchema.parse(ctx.params);
 * // params.id — validated UUID string
 * ```
 */
export const UserBookmarkCollectionIdParamSchema = z
    .object({
        id: UserBookmarkCollectionIdSchema
    })
    .strict();

export type UserBookmarkCollectionIdParam = z.infer<typeof UserBookmarkCollectionIdParamSchema>;

/**
 * Path parameter schema for routes that target a specific bookmark within a collection.
 *
 * Used by:
 * - PUT `/user-bookmark-collections/:id/bookmarks/:bookmarkId`
 * - DELETE `/user-bookmark-collections/:id/bookmarks/:bookmarkId`
 *
 * @example
 * ```ts
 * const params = UserBookmarkCollectionBookmarkParamsSchema.parse(ctx.params);
 * // params.id — collection UUID
 * // params.bookmarkId — bookmark UUID
 * ```
 */
export const UserBookmarkCollectionBookmarkParamsSchema = z
    .object({
        id: UserBookmarkCollectionIdSchema,
        bookmarkId: UserBookmarkIdSchema
    })
    .strict();

export type UserBookmarkCollectionBookmarkParams = z.infer<
    typeof UserBookmarkCollectionBookmarkParamsSchema
>;
