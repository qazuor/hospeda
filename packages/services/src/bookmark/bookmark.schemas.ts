import type {
    AccommodationId,
    DestinationId,
    EntityTypeEnum,
    EventId,
    PostId,
    UserBookmarkType,
    UserId
} from '@repo/types';
import { z } from 'zod';

/**
 * Input schema for addBookmark.
 * @example
 * const input = { userId, entityId, entityType, name, description };
 */
export const BookmarkAddInputSchema = z.object({
    userId: z.string().min(1, 'User ID is required') as unknown as z.ZodType<UserId>,
    entityId: z.string().min(1, 'Entity ID is required') as unknown as z.ZodType<
        AccommodationId | DestinationId | PostId | EventId | UserId
    >,
    entityType: z
        .string()
        .min(1, 'Entity type is required') as unknown as z.ZodType<EntityTypeEnum>,
    name: z.string().min(1, 'Name is required').max(100),
    description: z.string().max(500).optional()
});
export type BookmarkAddInput = z.infer<typeof BookmarkAddInputSchema>;
export type BookmarkAddOutput = { bookmark: UserBookmarkType };

/**
 * Input schema for removeBookmark.
 * @example
 * const input = { userId, bookmarkId };
 */
export const BookmarkRemoveInputSchema = z.object({
    userId: z.string().min(1, 'User ID is required') as unknown as z.ZodType<UserId>,
    bookmarkId: z.string().min(1, 'Bookmark ID is required')
});
export type BookmarkRemoveInput = z.infer<typeof BookmarkRemoveInputSchema>;
export type BookmarkRemoveOutput = { removed: boolean };

/**
 * Input schema for getUserBookmarks.
 * @example
 * const input = { userId };
 */
export const BookmarkGetUserBookmarksInputSchema = z.object({
    userId: z.string().min(1, 'User ID is required') as unknown as z.ZodType<UserId>
});
export type BookmarkGetUserBookmarksInput = z.infer<typeof BookmarkGetUserBookmarksInputSchema>;
export type BookmarkGetUserBookmarksOutput = { bookmarks: UserBookmarkType[] };
