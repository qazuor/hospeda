// packages/db/src/service/bookmark.service.ts

import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, EntityTypeEnum, type UserType } from '@repo/types';
import {
    AccommodationModel,
    BookmarkModel,
    type BookmarkRecord,
    type CreateBookmarkData,
    DestinationModel,
    EventModel,
    PostModel,
    type SelectBookmarkFilter,
    type UpdateBookmarkData,
    UserModel
} from '../model';
import type { PaginationParams } from '../types/db-types';
import { assertExists } from '../utils/db-utils';

// Scoped logger for the service layer
const log = logger.createLogger('BookmarkService');

export class BookmarkService {
    private static isAdmin(actor: UserType): boolean {
        return actor.roleId === BuiltinRoleTypeEnum.ADMIN;
    }

    private static assertOwnerOrAdmin(ownerId: string, actor: UserType): void {
        if (actor.id !== ownerId && !BookmarkService.isAdmin(actor)) {
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new bookmark.
     */
    async createBookmark(data: CreateBookmarkData, actor: UserType): Promise<BookmarkRecord> {
        log.info('creating bookmark', 'createBookmark', { data, actor: actor.id });

        BookmarkService.assertOwnerOrAdmin(data.ownerId, actor);
        await assertExists(
            await UserModel.getUserById(data.ownerId),
            `User ${data.ownerId} not found`
        );

        switch (data.entityType) {
            case EntityTypeEnum.ACCOMMODATION:
                await assertExists(
                    await AccommodationModel.getAccommodationById(data.entityId),
                    `Accommodation ${data.entityId} not found`
                );
                break;
            case EntityTypeEnum.DESTINATION:
                await assertExists(
                    await DestinationModel.getDestinationById(data.entityId),
                    `Destination ${data.entityId} not found`
                );
                break;
            case EntityTypeEnum.EVENT:
                await assertExists(
                    await EventModel.getEventById(data.entityId),
                    `Event ${data.entityId} not found`
                );
                break;
            case EntityTypeEnum.POST:
                await assertExists(
                    await PostModel.getPostById(data.entityId),
                    `Post ${data.entityId} not found`
                );
                break;
            case EntityTypeEnum.USER:
                await assertExists(
                    await UserModel.getUserById(data.entityId),
                    `User ${data.entityId} not found`
                );
                break;
            default:
                throw new Error(`Unsupported entityType: ${data.entityType}`);
        }

        const created = await BookmarkModel.insertBookmark(data);
        log.info('bookmark created', 'createBookmark', created.id);
        return created;
    }

    /**
     * Get bookmarks by owner.
     */
    async getBookmarksByOwnerId(
        ownerId: string,
        actor: UserType,
        pagination: PaginationParams = {}
    ): Promise<BookmarkRecord[]> {
        log.info('listing bookmarks by owner', 'getBookmarksByOwnerId', {
            ownerId,
            actor: actor.id,
            pagination
        });
        BookmarkService.assertOwnerOrAdmin(ownerId, actor);
        const filter: SelectBookmarkFilter = {
            ownerId,
            includeDeleted: true,
            limit: pagination.limit,
            offset: pagination.offset,
            order: pagination.order
        };
        return BookmarkModel.selectBookmarks(filter);
    }

    /**
     * Get bookmarks by entityType (admin only).
     */
    async getBookmarksByEntityType(
        entityType: EntityTypeEnum,
        actor: UserType,
        pagination: PaginationParams = {}
    ): Promise<BookmarkRecord[]> {
        log.info('listing bookmarks by entityType', 'getBookmarksByEntityType', {
            entityType,
            actor: actor.id,
            pagination
        });
        if (!BookmarkService.isAdmin(actor)) throw new Error('Forbidden');
        return BookmarkModel.selectByEntityType(entityType, pagination);
    }

    /**
     * Get bookmarks by entityId (admin only).
     */
    async getBookmarksByEntityId(
        entityId: string,
        actor: UserType,
        pagination: PaginationParams = {}
    ): Promise<BookmarkRecord[]> {
        log.info('listing bookmarks by entityId', 'getBookmarksByEntityId', {
            entityId,
            actor: actor.id,
            pagination
        });
        if (!BookmarkService.isAdmin(actor)) throw new Error('Forbidden');
        return BookmarkModel.selectByEntityId(entityId, pagination);
    }

    /**
     * Fetch a single bookmark by its ID.
     */
    async getBookmarkById(bookmarkId: string, actor: UserType): Promise<BookmarkRecord> {
        log.info('fetching bookmark by id', 'getBookmarkById', { bookmarkId, actor: actor.id });
        const bm = assertExists(
            await BookmarkModel.selectBookmarkById(bookmarkId),
            `Bookmark ${bookmarkId} not found`
        );
        BookmarkService.assertOwnerOrAdmin(bm.ownerId, actor);
        return bm;
    }

    /**
     * Update a bookmark.
     */
    async updateBookmark(
        bookmarkId: string,
        changes: UpdateBookmarkData,
        actor: UserType
    ): Promise<BookmarkRecord> {
        log.info('updating bookmark', 'updateBookmark', { bookmarkId, changes, actor: actor.id });
        const updated = await BookmarkModel.updateBookmark(bookmarkId, changes);
        log.info('bookmark updated', 'updateBookmark', updated.id);
        return updated;
    }

    /**
     * Soft-delete a bookmark.
     */
    async softDeleteBookmark(bookmarkId: string, actor: UserType): Promise<void> {
        log.info('soft deleting bookmark', 'softDeleteBookmark', { bookmarkId, actor: actor.id });
        const existing = await this.getBookmarkById(bookmarkId, actor);
        await BookmarkModel.softDeleteBookmark(existing.id);
        log.info('bookmark soft deleted', 'softDeleteBookmark', existing.id);
    }

    /**
     * Restore a soft-deleted bookmark.
     */
    async restoreBookmark(bookmarkId: string, actor: UserType): Promise<void> {
        log.info('restoring bookmark', 'restoreBookmark', { bookmarkId, actor: actor.id });
        const existing = await this.getBookmarkById(bookmarkId, actor);
        await BookmarkModel.restoreBookmark(existing.id);
        log.info('bookmark restored', 'restoreBookmark', existing.id);
    }

    /**
     * Permanently delete a bookmark.
     */
    async hardDeleteBookmark(bookmarkId: string, actor: UserType): Promise<void> {
        log.info('hard deleting bookmark', 'hardDeleteBookmark', {
            bookmarkId,
            actor: actor.id
        });
        if (!BookmarkService.isAdmin(actor)) throw new Error('Forbidden');
        const existing = await this.getBookmarkById(bookmarkId, actor);
        await BookmarkModel.hardDeleteBookmark(existing.id);
        log.info('bookmark permanently deleted', 'hardDeleteBookmark', existing.id);
    }
}
