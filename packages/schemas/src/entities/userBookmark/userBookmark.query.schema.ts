import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { PaginationSchema } from '../../common/search.schemas.js';
import { EntityTypeEnumSchema } from '../../enums/index.js';
import { UserBookmarkSchema } from './userBookmark.schema.js';

/**
 * UserBookmark Query Schemas
 *
 * This file contains schemas for query operations (list, search, count)
 * for UserBookmark entities, following the established patterns.
 */

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

/**
 * Schema for listing bookmarks by user
 * Includes pagination support
 */
export const UserBookmarkListByUserInputSchema = z
    .object({
        userId: UserIdSchema,
        pagination: PaginationSchema.optional()
    })
    .strict();

/**
 * Schema for listing bookmarks by entity
 * Includes pagination support and entity identification
 */
export const UserBookmarkListByEntityInputSchema = z
    .object({
        entityId: z
            .string({ message: 'zodError.userBookmark.query.entityId.required' })
            .uuid({ message: 'zodError.userBookmark.query.entityId.invalidUuid' }),
        entityType: EntityTypeEnumSchema,
        pagination: PaginationSchema.optional()
    })
    .strict();

/**
 * Schema for counting bookmarks for a specific entity
 * Used to get bookmark count for any entity type
 */
export const UserBookmarkCountByEntityInputSchema = z
    .object({
        entityId: z
            .string({ message: 'zodError.userBookmark.query.entityId.required' })
            .uuid({ message: 'zodError.userBookmark.query.entityId.invalidUuid' }),
        entityType: EntityTypeEnumSchema
    })
    .strict();

/**
 * Schema for counting bookmarks for a specific user
 * Used to get total bookmark count for a user
 */
export const UserBookmarkCountByUserInputSchema = z
    .object({
        userId: UserIdSchema
    })
    .strict();

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

/**
 * Schema for user bookmark list response (by user)
 * Returns array of bookmarks for a specific user
 */
export const UserBookmarkListByUserOutputSchema = z
    .object({
        bookmarks: z.array(UserBookmarkSchema)
    })
    .strict();

/**
 * Schema for user bookmark list response (by entity)
 * Returns array of bookmarks for a specific entity
 */
export const UserBookmarkListByEntityOutputSchema = z
    .object({
        bookmarks: z.array(UserBookmarkSchema)
    })
    .strict();

/**
 * Schema for bookmark count response
 * Returns count of bookmarks (used for both entity and user counts)
 */
export const UserBookmarkCountOutputSchema = z
    .object({
        count: z
            .number({ message: 'zodError.userBookmark.query.count.invalidType' })
            .int({ message: 'zodError.userBookmark.query.count.int' })
            .min(0, { message: 'zodError.userBookmark.query.count.min' })
    })
    .strict();

/**
 * Schema for paginated bookmark list response
 * Used when pagination information is needed in response
 */
export const UserBookmarkPaginatedListOutputSchema = z
    .object({
        bookmarks: z.array(UserBookmarkSchema),
        pagination: z.object({
            page: z.number().int().positive(),
            pageSize: z.number().int().positive(),
            total: z.number().int().min(0)
        })
    })
    .strict();

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UserBookmarkListByUserInput = z.infer<typeof UserBookmarkListByUserInputSchema>;
export type UserBookmarkListByEntityInput = z.infer<typeof UserBookmarkListByEntityInputSchema>;
export type UserBookmarkCountByEntityInput = z.infer<typeof UserBookmarkCountByEntityInputSchema>;
export type UserBookmarkCountByUserInput = z.infer<typeof UserBookmarkCountByUserInputSchema>;
export type UserBookmarkListByUserOutput = z.infer<typeof UserBookmarkListByUserOutputSchema>;
export type UserBookmarkListByEntityOutput = z.infer<typeof UserBookmarkListByEntityOutputSchema>;
export type UserBookmarkCountOutput = z.infer<typeof UserBookmarkCountOutputSchema>;
export type UserBookmarkPaginatedListOutput = z.infer<typeof UserBookmarkPaginatedListOutputSchema>;
