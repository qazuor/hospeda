import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type EntityTypeEnum, type UserType } from '@repo/types';
import { BookmarkModel, type BookmarkRecord } from '../model/index.js';
import type {
    InsertUserBookmark,
    PaginationParams,
    SelectBookmarkFilter,
    UpdateUserBookmarkData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

const log = logger.createLogger('BookmarkService');

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
            log.warn('Forbidden access attempt', 'assertOwnerOrAdmin', {
                actorId: actor.id,
                requiredOwnerId: ownerId
            });
            throw new Error('Forbidden');
        }
    }

    private static assertAdmin(actor: UserType): void {
        if (!BookmarkService.isAdmin(actor)) {
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
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
        log.info('creating bookmark', 'create', {
            ownerId,
            entityType: data.entityType,
            entityId: data.entityId,
            actor: actor.id
        });

        BookmarkService.assertOwnerOrAdmin(ownerId, actor);

        try {
            const dataToInsert: InsertUserBookmark = {
                ...data,
                ownerId: ownerId,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdBookmark = await BookmarkModel.insertBookmark(dataToInsert);
            log.info('bookmark created successfully', 'create', {
                bookmarkId: createdBookmark.id,
                ownerId
            });
            return createdBookmark;
        } catch (error) {
            log.error('failed to create bookmark', 'create', error, {
                ownerId,
                entityType: data.entityType,
                entityId: data.entityId,
                actor: actor.id
            });
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
        log.info('fetching bookmark by id', 'getById', { bookmarkId: id, actor: actor.id });

        const bookmark = assertExists(
            await BookmarkModel.selectBookmarkById(id),
            `Bookmark ${id} not found`
        );

        BookmarkService.assertOwnerOrAdmin(bookmark.ownerId, actor);

        log.info('bookmark fetched successfully', 'getById', { bookmarkId: bookmark.id });
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
        log.info('listing bookmarks', 'list', { filter, actor: actor.id });

        BookmarkService.assertAdmin(actor);

        try {
            const bookmarks = await BookmarkModel.selectBookmarks(filter);
            log.info('bookmarks listed successfully', 'list', { count: bookmarks.length, filter });
            return bookmarks;
        } catch (error) {
            log.error('failed to list bookmarks', 'list', error, { filter, actor: actor.id });
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
        log.info('listing bookmarks by owner', 'getByOwnerId', {
            ownerId,
            actor: actor.id,
            filter
        });

        BookmarkService.assertOwnerOrAdmin(ownerId, actor);

        const ownerFilter: SelectBookmarkFilter = {
            ownerId: ownerId,
            ...filter
        };

        try {
            const bookmarks = await BookmarkModel.selectBookmarks(ownerFilter);
            log.info('bookmarks listed by owner successfully', 'getByOwnerId', {
                ownerId,
                count: bookmarks.length
            });
            return bookmarks;
        } catch (error) {
            log.error('failed to list bookmarks by owner', 'getByOwnerId', error, {
                ownerId,
                actor: actor.id
            });
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
        log.info('listing bookmarks by entity type', 'getByEntityType', {
            entityType: type,
            actor: actor.id,
            filter
        });

        BookmarkService.assertAdmin(actor);

        const entityTypeFilter: SelectBookmarkFilter = {
            entityType: type,
            ...filter
        };

        try {
            const bookmarks = await BookmarkModel.selectBookmarks(entityTypeFilter);
            log.info('bookmarks listed by entity type successfully', 'getByEntityType', {
                entityType: type,
                count: bookmarks.length
            });
            return bookmarks;
        } catch (error) {
            log.error('failed to list bookmarks by entity type', 'getByEntityType', error, {
                entityType: type,
                actor: actor.id
            });
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
        log.info('listing bookmarks by entity id', 'getByEntityId', {
            entityId: id,
            actor: actor.id,
            filter
        });

        BookmarkService.assertAdmin(actor);

        const entityIdFilter: SelectBookmarkFilter = {
            entityId: id,
            ...filter
        };

        try {
            const bookmarks = await BookmarkModel.selectBookmarks(entityIdFilter);
            log.info('bookmarks listed by entity id successfully', 'getByEntityId', {
                entityId: id,
                count: bookmarks.length
            });
            return bookmarks;
        } catch (error) {
            log.error('failed to list bookmarks by entity id', 'getByEntityId', error, {
                entityId: id,
                actor: actor.id
            });
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
        log.info('updating bookmark', 'update', { bookmarkId: id, actor: actor.id });

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
            log.info('bookmark updated successfully', 'update', { bookmarkId: updatedBookmark.id });
            return updatedBookmark;
        } catch (error) {
            log.error('failed to update bookmark', 'update', error, {
                bookmarkId: id,
                actor: actor.id
            });
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
        log.info('soft deleting bookmark', 'delete', { bookmarkId: id, actor: actor.id });

        const existingBookmark = await this.getById(id, actor);

        try {
            const changes: UpdateUserBookmarkData = {
                deletedAt: new Date(),
                deletedById: actor.id
            };
            await BookmarkModel.updateBookmark(existingBookmark.id, changes);
            log.info('bookmark soft deleted successfully', 'delete', {
                bookmarkId: existingBookmark.id
            });
        } catch (error) {
            log.error('failed to soft delete bookmark', 'delete', error, {
                bookmarkId: id,
                actor: actor.id
            });
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
        log.info('restoring bookmark', 'restore', { bookmarkId: id, actor: actor.id });

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
            log.info('bookmark restored successfully', 'restore', {
                bookmarkId: existingBookmark.id
            });
        } catch (error) {
            log.error('failed to restore bookmark', 'restore', error, {
                bookmarkId: id,
                actor: actor.id
            });
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
        log.info('hard deleting bookmark', 'hardDelete', { bookmarkId: id, actor: actor.id });

        const existingBookmark = assertExists(
            await BookmarkModel.selectBookmarkByIdIncludingDeleted(id),
            `Bookmark ${id} not found for hard delete`
        );

        BookmarkService.assertOwnerOrAdmin(existingBookmark.ownerId, actor);

        try {
            await BookmarkModel.hardDeleteBookmark(existingBookmark.id);
            log.info('bookmark hard deleted successfully', 'hardDelete', {
                bookmarkId: existingBookmark.id
            });
        } catch (error) {
            log.error('failed to hard delete bookmark', 'hardDelete', error, {
                bookmarkId: id,
                actor: actor.id
            });
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
        log.info('counting bookmarks by owner', 'countByOwner', { ownerId, actor: actor.id });

        BookmarkService.assertOwnerOrAdmin(ownerId, actor);

        try {
            const bookmarkCount = await BookmarkModel.countByOwnerId(ownerId);

            log.info('bookmark count by owner successful', 'countByOwner', {
                ownerId,
                count: bookmarkCount
            });
            return bookmarkCount;
        } catch (error) {
            log.error('failed to count bookmarks by owner', 'countByOwner', error, {
                ownerId,
                actor: actor.id
            });
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
        // log.info('checking if bookmark exists', 'exists', { ownerId, entityType, entityId }); // Avoid logging frequent checks
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
        log.info('bulk deleting bookmarks by owner', 'bulkDeleteByOwner', {
            ownerId,
            actor: actor.id
        });

        BookmarkService.assertAdmin(actor);

        try {
            await BookmarkModel.hardDeleteAllByOwnerId(ownerId);
            log.info('bulk delete by owner successful', 'bulkDeleteByOwner', { ownerId });
        } catch (error) {
            log.error('failed to bulk delete by owner', 'bulkDeleteByOwner', error, {
                ownerId,
                actor: actor.id
            });
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
        log.info('purging old bookmarks', 'purgeOld', { cutoffDate, actor: actor.id });

        BookmarkService.assertAdmin(actor);

        try {
            await BookmarkModel.hardDeleteOlderThan(cutoffDate);
            log.info('purge old bookmarks successful', 'purgeOld', { cutoffDate });
        } catch (error) {
            log.error('failed to purge old bookmarks', 'purgeOld', error, {
                cutoffDate,
                actor: actor.id
            });
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
        log.info('getting most bookmarked entities', 'getMostBookmarkedEntities', {
            limit,
            actor: actor.id
        });

        BookmarkService.assertAdmin(actor);

        try {
            const results = await BookmarkModel.getMostBookmarkedEntities(limit);

            log.info(
                'most bookmarked entities retrieved successfully',
                'getMostBookmarkedEntities',
                { count: results.length, limit }
            );
            return results;
        } catch (error) {
            log.error(
                'failed to get most bookmarked entities',
                'getMostBookmarkedEntities',
                error,
                { limit, actor: actor.id }
            );
            throw error;
        }
    }
}
