import type {
    AccommodationId,
    DestinationId,
    EventId,
    PostId,
    UserId
} from '@repo/types/common/id.types';
import type { UserBookmarkType } from '@repo/types/entities/user/user.bookmark.types';
import type { EntityTypeEnum } from '@repo/types/enums/entity-type.enum';
import { z } from 'zod';

/**
 * Input schema for addBookmark.
 * @example
 * const input = { userId, entityId, entityType, name, description };
 */
export const addBookmarkInputSchema = z.object({
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
export type AddBookmarkInput = z.infer<typeof addBookmarkInputSchema>;
export type AddBookmarkOutput = { bookmark: UserBookmarkType };

/**
 * Input schema for removeBookmark.
 * @example
 * const input = { userId, bookmarkId };
 */
export const removeBookmarkInputSchema = z.object({
    userId: z.string().min(1, 'User ID is required') as unknown as z.ZodType<UserId>,
    bookmarkId: z.string().min(1, 'Bookmark ID is required')
});
export type RemoveBookmarkInput = z.infer<typeof removeBookmarkInputSchema>;
export type RemoveBookmarkOutput = { removed: boolean };

/**
 * Input schema for getUserBookmarks.
 * @example
 * const input = { userId };
 */
export const getUserBookmarksInputSchema = z.object({
    userId: z.string().min(1, 'User ID is required') as unknown as z.ZodType<UserId>
});
export type GetUserBookmarksInput = z.infer<typeof getUserBookmarksInputSchema>;
export type GetUserBookmarksOutput = { bookmarks: UserBookmarkType[] };
