import { dbLogger } from '@repo/db/utils/logger.js';
import { BuiltinRoleTypeEnum, type EntityTypeEnum, type UserType } from '@repo/types';
import { BookmarkModel, type BookmarkRecord } from '../model/index.js';
import type {
    InsertUserBookmark,
    PaginationParams,
    SelectBookmarkFilter,
    UpdateUserBookmarkData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

/**
 * Service layer for managing user bookmark operations.
 * Handles business logic, authorization, and interacts with the BookmarkModel.
 */
export class BookmarkService {
    private static isAdmin(actor: UserType): boolean {
        return actor.roleId === BuiltinRoleTypeEnum.ADMIN;
    }

    /**
     * Asserts that the actor is either the owner of the resource or an admin.
     * @param ownerId - The ID of the resource owner.
     * @param actor - The user performing the action.
     * @throws Error if the actor is neither the owner nor an admin.
     */
    private static assertOwnerOrAdmin(ownerId: string, actor: UserType): void {
        if (actor.id !== ownerId && !BookmarkService.isAdmin(actor)) {
            dbLogger.warn(
                {
                    actorId: actor.id,
                    requiredOwnerId: ownerId
                },
                'Forbidden access attempt'
            );
            throw new Error('Forbidden');
        }
    }

    private static assertAdmin(actor: UserType): void {
        if (!BookmarkService.isAdmin(actor)) {
            dbLogger.warn({ actorId: actor.id }, 'Admin access required');
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new bookmark.
     * @param data - The data for the new bookmark (Omit ownerId, audit fields, handled by service).
     * @param ownerId - The ID of the user who owns the bookmark.
     * @param actor - The user performing the action (must be owner or admin).
     * @returns The created bookmark record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(
        data: Omit<
            InsertUserBookmark,
            | 'id'
            | 'ownerId'
            | 'createdById'
            | 'updatedById'
            | 'deletedById'
            | 'createdAt'
            | 'updatedAt'
            | 'deletedAt'
        >,
        ownerId: string,
        actor: UserType
    ): Promise<BookmarkRecord> {
        dbLogger.info(
            {
                ownerId,
                entityType: data.entityType,
                entityId: data.entityId,
                actor: actor.id
            },
            'creating bookmark'
        );

        BookmarkService.assertOwnerOrAdmin(ownerId, actor);

        try {
            const dataToInsert: InsertUserBookmark = {
                ...data,
                ownerId: ownerId,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdBookmark = await BookmarkModel.insertBookmark(dataToInsert);
            dbLogger.info(
                {
                    bookmarkId: createdBookmark.id,
                    ownerId
                },
                'bookmark created successfully'
            );
            return createdBookmark;
        } catch (error) {
            dbLogger.error(error, 'failed to create bookmark');
            throw error;
        }
    }

    /**
     * Get a single bookmark by ID.
     * @param id - The ID of the bookmark to fetch.
     * @param actor - The user performing the action (must be owner or admin).
     * @returns The bookmark record.
     * @throws Error if bookmark is not found or actor is not authorized.
     */
    async getById(id: string, actor: UserType): Promise<BookmarkRecord> {
        dbLogger.info({ bookmarkId: id, actor: actor.id }, 'fetching bookmark by id');

        const bookmark = assertExists(
            await BookmarkModel.selectBookmarkById(id),
            `Bookmark ${id} not found`
        );

        BookmarkService.assertOwnerOrAdmin(bookmark.ownerId, actor);

        dbLogger.info({ bookmarkId: bookmark.id }, 'bookmark fetched successfully');
        return bookmark;
    }

    /**
     * List bookmarks with optional filtering and pagination.
     * This method is typically for admin use to list bookmarks across users.
     * @param filter - Filtering and pagination options (SelectBookmarkFilter type from db-types).
     * @param actor - The user performing the action (must be an admin).
     * @returns An array of bookmark records.
     * @throws Error if actor is not authorized or listing fails.
     */
    async list(filter: SelectBookmarkFilter, actor: UserType): Promise<BookmarkRecord[]> {
        dbLogger.info({ filter, actor: actor.id }, 'listing bookmarks');

        BookmarkService.assertAdmin(actor);

        try {
            const bookmarks = await BookmarkModel.selectBookmarks(filter);
            dbLogger.info({ count: bookmarks.length, filter }, 'bookmarks listed successfully');
            return bookmarks;
        } catch (error) {
            dbLogger.error(error, 'failed to list bookmarks');
            throw error;
        }
    }

    /**
     * List bookmarks for a specific owner.
     * @param ownerId - The ID of the owner.
     * @param actor - The user performing the action (must be owner or admin).
     * @param filter - Pagination options (PaginationParams type from db-types included in SelectBookmarkFilter).
     * @returns An array of bookmark records for the owner.
     * @throws Error if owner or actor is not authorized or listing fails.
     */
    async getByOwnerId(
        ownerId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<BookmarkRecord[]> {
        dbLogger.info(
            {
                ownerId,
                actor: actor.id,
                filter
            },
            'listing bookmarks by owner'
        );

        BookmarkService.assertOwnerOrAdmin(ownerId, actor);

        const ownerFilter: SelectBookmarkFilter = {
            ownerId: ownerId,
            ...filter
        };

        try {
            const bookmarks = await BookmarkModel.selectBookmarks(ownerFilter);
            dbLogger.info(
                {
                    ownerId,
                    count: bookmarks.length
                },
                'bookmarks listed by owner successfully'
            );
            return bookmarks;
        } catch (error) {
            dbLogger.error(error, 'failed to list bookmarks by owner');
            throw error;
        }
    }

    /**
     * List bookmarks for a specific entity type.
     * @param type - The type of entity.
     * @param actor - The user performing the action (must be an admin).
     * @param filter - Filtering and pagination options (PaginationParams type from db-types included in SelectBookmarkFilter).
     * @returns An array of bookmark records for the entity type.
     * @throws Error if actor is not authorized or listing fails.
     */
    async getByEntityType(
        type: EntityTypeEnum,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<BookmarkRecord[]> {
        dbLogger.info(
            {
                entityType: type,
                actor: actor.id,
                filter
            },
            'listing bookmarks by entity type'
        );

        BookmarkService.assertAdmin(actor);

        const entityTypeFilter: SelectBookmarkFilter = {
            entityType: type,
            ...filter
        };

        try {
            const bookmarks = await BookmarkModel.selectBookmarks(entityTypeFilter);
            dbLogger.info(
                {
                    entityType: type,
                    count: bookmarks.length
                },
                'bookmarks listed by entity type successfully'
            );
            return bookmarks;
        } catch (error) {
            dbLogger.error(error, 'failed to list bookmarks by entity type');
            throw error;
        }
    }

    /**
     * List bookmarks for a specific entity ID (across all types).
     * @param id - The ID of the entity.
     * @param actor - The user performing the action (must be an admin).
     * @param filter - Filtering and pagination options (PaginationParams type from db-types included in SelectBookmarkFilter).
     * @returns An array of bookmark records for the entity ID.
     * @throws Error if actor is not authorized or listing fails.
     */
    async getByEntityId(
        id: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<BookmarkRecord[]> {
        dbLogger.info(
            {
                entityId: id,
                actor: actor.id,
                filter
            },
            'listing bookmarks by entity id'
        );

        BookmarkService.assertAdmin(actor);

        const entityIdFilter: SelectBookmarkFilter = {
            entityId: id,
            ...filter
        };

        try {
            const bookmarks = await BookmarkModel.selectBookmarks(entityIdFilter);
            dbLogger.info(
                {
                    entityId: id,
                    count: bookmarks.length
                },
                'bookmarks listed by entity id successfully'
            );
            return bookmarks;
        } catch (error) {
            dbLogger.error(error, 'failed to list bookmarks by entity id');
            throw error;
        }
    }

    /**
     * Update fields on an existing bookmark.
     * @param id - The ID of the bookmark to update.
     * @param changes - The partial fields to update (UpdateUserBookmarkData type from db-types).
     * @param actor - The user performing the action (must be owner or admin).
     * @returns The updated bookmark record.
     * @throws Error if bookmark is not found, actor is not authorized, or update fails.
     */
    async update(
        id: string,
        changes: UpdateUserBookmarkData,
        actor: UserType
    ): Promise<BookmarkRecord> {
        dbLogger.info({ bookmarkId: id, actor: actor.id }, 'updating bookmark');

        const existingBookmark = await this.getById(id, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdateUserBookmarkData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            await BookmarkModel.updateBookmark(existingBookmark.id, dataWithAudit);
            // Re-fetch the updated record to ensure consistency if necessary, or return the result of updateBookmark if it returns the full record.
            // Assuming updateBookmark returns the full updated record based on its definition.
            const updatedBookmark = assertExists(
                await BookmarkModel.selectBookmarkByIdIncludingDeleted(existingBookmark.id),
                `Failed to retrieve updated bookmark ${existingBookmark.id}`
            );
            dbLogger.info({ bookmarkId: updatedBookmark.id }, 'bookmark updated successfully');
            return updatedBookmark;
        } catch (error) {
            dbLogger.error(error, 'failed to update bookmark');
            throw error;
        }
    }

    /**
     * Soft-delete a bookmark by setting the deletedAt timestamp.
     * @param id - The ID of the bookmark to soft-delete.
     * @param actor - The user performing the action (must be owner or admin).
     * @throws Error if bookmark is not found, actor is not authorized, or soft-delete fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ bookmarkId: id, actor: actor.id }, 'soft deleting bookmark');

        const existingBookmark = await this.getById(id, actor);

        try {
            const changes: UpdateUserBookmarkData = {
                deletedAt: new Date(),
                deletedById: actor.id
            };
            await BookmarkModel.updateBookmark(existingBookmark.id, changes);
            dbLogger.info(
                {
                    bookmarkId: existingBookmark.id
                },
                'bookmark soft deleted successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete bookmark');
            throw error;
        }
    }

    /**
     * Restore a soft-deleted bookmark by clearing the deletedAt timestamp.
     * @param id - The ID of the bookmark to restore.
     * @param actor - The user performing the action (must be owner or admin).
     * @throws Error if bookmark is not found, actor is not authorized, or restore fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ bookmarkId: id, actor: actor.id }, 'restoring bookmark');

        const existingBookmark = assertExists(
            await BookmarkModel.selectBookmarkByIdIncludingDeleted(id),
            `Bookmark ${id} not found for restore`
        );

        BookmarkService.assertOwnerOrAdmin(existingBookmark.ownerId, actor);

        try {
            const changes: UpdateUserBookmarkData = {
                deletedAt: null,
                deletedById: null
            };
            await BookmarkModel.updateBookmark(existingBookmark.id, changes);
            dbLogger.info(
                {
                    bookmarkId: existingBookmark.id
                },
                'bookmark restored successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to restore bookmark');
            throw error;
        }
    }

    /**
     * Permanently delete a bookmark record from the database.
     * @param id - The ID of the bookmark to hard-delete.
     * @param actor - The user performing the action (must be owner or admin).
     * @throws Error if bookmark is not found, actor is not authorized, or hard-delete fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ bookmarkId: id, actor: actor.id }, 'hard deleting bookmark');

        const existingBookmark = assertExists(
            await BookmarkModel.selectBookmarkByIdIncludingDeleted(id),
            `Bookmark ${id} not found for hard delete`
        );

        BookmarkService.assertOwnerOrAdmin(existingBookmark.ownerId, actor);

        try {
            await BookmarkModel.hardDeleteBookmark(existingBookmark.id);
            dbLogger.info(
                {
                    bookmarkId: existingBookmark.id
                },
                'bookmark hard deleted successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete bookmark');
            throw error;
        }
    }

    /**
     * Count bookmarks for a specific owner.
     * @param ownerId - The ID of the owner.
     * @param actor - The user performing the action (must be owner or admin).
     * @returns The number of bookmarks for the owner.
     * @throws Error if actor is not authorized or count fails.
     */
    async countByOwner(ownerId: string, actor: UserType): Promise<number> {
        dbLogger.info({ ownerId, actor: actor.id }, 'counting bookmarks by owner');

        BookmarkService.assertOwnerOrAdmin(ownerId, actor);

        try {
            const bookmarkCount = await BookmarkModel.countByOwnerId(ownerId);

            dbLogger.info(
                {
                    ownerId,
                    count: bookmarkCount
                },
                'bookmark count by owner successful'
            );
            return bookmarkCount;
        } catch (error) {
            dbLogger.error(error, 'failed to count bookmarks by owner');
            throw error;
        }
    }

    /**
     * Check if a specific bookmark relation exists for a user and entity.
     * This method does NOT require an 'actor' for authorization within itself, as it's a utility check.
     * @param ownerId - The ID of the user (owner).
     * @param entityType - The type of the entity.
     * @param entityId - The ID of the entity.
     * @returns True if the bookmark exists, false otherwise.
     */
    async exists(ownerId: string, entityType: EntityTypeEnum, entityId: string): Promise<boolean> {
        // dbLogger.info('checking if bookmark exists', 'exists', { ownerId, entityType, entityId }); // Avoid logging frequent checks
        // Note: No authorization check based on 'actor' here, as this IS an existence check.

        const bookmarkExists = await BookmarkModel.exists(ownerId, entityType, entityId);
        return bookmarkExists;
    }

    /**
     * Delete all bookmarks for a specific owner.
     * This performs a hard delete based on the method name "bulkDeleteByOwner".
     * @param ownerId - The ID of the owner whose bookmarks to delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if actor is not authorized or deletion fails.
     */
    async bulkDeleteByOwner(ownerId: string, actor: UserType): Promise<void> {
        dbLogger.info({ ownerId, actor: actor.id }, 'bulk deleting bookmarks by owner');

        BookmarkService.assertAdmin(actor);

        try {
            await BookmarkModel.hardDeleteAllByOwnerId(ownerId);
            dbLogger.info({ ownerId }, 'bulk delete by owner successful');
        } catch (error) {
            dbLogger.error(error, 'failed to bulk delete by owner');
            throw error;
        }
    }

    /**
     * Purge old bookmarks (hard delete bookmarks soft-deleted before a cutoff date).
     * @param cutoffDate - The date before which soft-deleted bookmarks should be purged.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if actor is not authorized or purge fails.
     */
    async purgeOld(cutoffDate: Date, actor: UserType): Promise<void> {
        dbLogger.info({ cutoffDate, actor: actor.id }, 'purging old bookmarks');

        BookmarkService.assertAdmin(actor);

        try {
            await BookmarkModel.hardDeleteOlderThan(cutoffDate);
            dbLogger.info({ cutoffDate }, 'purge old bookmarks successful');
        } catch (error) {
            dbLogger.error(error, 'failed to purge old bookmarks');
            throw error;
        }
    }

    /**
     * Get a list of entities that are bookmarked the most.
     * Only counts non-soft-deleted bookmarks.
     * @param limit - The maximum number of entities to return.
     * @param actor - The user performing the action (must be an admin).
     * @returns An array of objects containing entityType, entityId, and bookmarkCount.
     * @throws Error if query fails.
     */
    async getMostBookmarkedEntities(
        limit: number,
        actor: UserType
    ): Promise<Array<{ entityType: EntityTypeEnum; entityId: string; bookmarkCount: number }>> {
        dbLogger.info(
            {
                limit,
                actor: actor.id
            },
            'getting most bookmarked entities'
        );

        BookmarkService.assertAdmin(actor);

        try {
            const results = await BookmarkModel.getMostBookmarkedEntities(limit);

            dbLogger.info(
                { count: results.length, limit },
                'most bookmarked entities retrieved successfully'
            );
            return results;
        } catch (error) {
            dbLogger.error(error, 'failed to get most bookmarked entities');
            throw error;
        }
    }
}
