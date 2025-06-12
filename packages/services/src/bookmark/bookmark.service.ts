import { UserBookmarkModel } from '@repo/db';
import type { PublicUserType, UserType } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types';
import { isUserType, logMethodEnd, logMethodStart, serviceLogger } from '../utils';
import type {
    BookmarkAddInput,
    BookmarkAddOutput,
    BookmarkGetUserBookmarksInput,
    BookmarkGetUserBookmarksOutput,
    BookmarkRemoveInput,
    BookmarkRemoveOutput
} from './bookmark.schemas';
import { BookmarkAddInputSchema, BookmarkGetUserBookmarksInputSchema } from './bookmark.schemas';

/**
 * BookmarkService provides methods to manage user bookmarks.
 * All methods follow the RO-RO pattern and are strongly typed.
 */
export const BookmarkService = {
    /**
     * Adds a bookmark for a user.
     *
     * @param input - The input object containing bookmark information.
     * @param actor - The user or public actor performing the operation.
     * @returns An object with the created bookmark.
     * @throws Error if the actor lacks permission or input is invalid.
     */
    async addBookmark(
        input: BookmarkAddInput,
        actor: UserType | PublicUserType
    ): Promise<BookmarkAddOutput> {
        logMethodStart(serviceLogger, 'addBookmark', input, actor);
        const parsedInput = BookmarkAddInputSchema.parse(input);
        // Only the user themselves can add bookmarks
        if (!isUserType(actor) || actor.id !== parsedInput.userId) {
            serviceLogger.permission({
                permission: 'BOOKMARK_ADD',
                userId: isUserType(actor) ? actor.id : 'public',
                role: isUserType(actor) ? actor.role : 'PUBLIC',
                extraData: { input, error: 'Forbidden: only the user can add their own bookmarks' }
            });
            throw new Error('Forbidden: only the user can add their own bookmarks');
        }
        const bookmark = await UserBookmarkModel.create({
            userId: parsedInput.userId,
            entityId: parsedInput.entityId,
            entityType: parsedInput.entityType,
            name: parsedInput.name,
            description: parsedInput.description,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        logMethodEnd(serviceLogger, 'addBookmark', { bookmark });
        return { bookmark };
    },

    /**
     * Removes a bookmark for a user.
     *
     * @param input - The input object containing bookmark information.
     * @param actor - The user or public actor performing the operation.
     * @returns An object with the result of the operation.
     * @throws Error if the actor lacks permission or input is invalid.
     */
    async removeBookmark(
        input: BookmarkRemoveInput,
        actor: UserType | PublicUserType
    ): Promise<BookmarkRemoveOutput> {
        logMethodStart(serviceLogger, 'removeBookmark', input, actor);
        // Validar input
        const { userId, bookmarkId } = input;
        if (!isUserType(actor) || actor.id !== userId) {
            serviceLogger.permission({
                permission: 'BOOKMARK_REMOVE',
                userId: isUserType(actor) ? actor.id : 'public',
                role: isUserType(actor) ? actor.role : 'PUBLIC',
                extraData: {
                    input,
                    error: 'Forbidden: only the user can remove their own bookmarks'
                }
            });
            throw new Error('Forbidden: only the user can remove their own bookmarks');
        }
        // Buscar el bookmark y validar que sea del usuario
        const bookmark = await UserBookmarkModel.getById(bookmarkId);
        if (!bookmark) {
            serviceLogger.permission({
                permission: 'BOOKMARK_REMOVE',
                userId: actor.id,
                role: actor.role,
                extraData: { input, error: 'Bookmark not found' }
            });
            throw new Error('Bookmark not found');
        }
        if (bookmark.userId !== userId) {
            serviceLogger.permission({
                permission: 'BOOKMARK_REMOVE',
                userId: actor.id,
                role: actor.role,
                extraData: { input, error: "Forbidden: cannot remove another user's bookmark" }
            });
            throw new Error("Forbidden: cannot remove another user's bookmark");
        }
        // Soft delete
        const deleted = await UserBookmarkModel.delete(bookmarkId, userId);
        const removed = !!deleted;
        logMethodEnd(serviceLogger, 'removeBookmark', { removed });
        return { removed };
    },

    /**
     * Gets all bookmarks for a user.
     *
     * @param input - The input object containing user information.
     * @param actor - The user or public actor requesting the data.
     * @returns An object with the list of bookmarks.
     * @throws Error if the actor lacks permission or input is invalid.
     */
    async getUserBookmarks(
        input: BookmarkGetUserBookmarksInput,
        actor: UserType | PublicUserType
    ): Promise<BookmarkGetUserBookmarksOutput> {
        logMethodStart(serviceLogger, 'getUserBookmarks', input, actor);
        const parsedInput = BookmarkGetUserBookmarksInputSchema.parse(input);
        const { userId } = parsedInput;
        if (!isUserType(actor) || actor.id !== userId) {
            serviceLogger.permission({
                permission: 'BOOKMARK_LIST',
                userId: isUserType(actor) ? actor.id : 'public',
                role: isUserType(actor) ? actor.role : 'PUBLIC',
                extraData: { input, error: 'Forbidden: only the user can view their own bookmarks' }
            });
            throw new Error('Forbidden: only the user can view their own bookmarks');
        }
        const bookmarks = await UserBookmarkModel.getByUserId(userId);
        logMethodEnd(serviceLogger, 'getUserBookmarks', { bookmarks });
        return { bookmarks };
    }
};
