import { logger } from '@repo/logger';
import type { EntityTypeEnum } from '@repo/types';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../client';
import { userBookmarks } from '../schema/bookmark.dbschema';
import type {
    InsertUserBookmark,
    PaginationParams,
    SelectBookmarkFilter,
    UpdateUserBookmarkData
} from '../types/db-types';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils';

/**
 * Scoped logger for bookmark model operations.
 */
const log = logger.createLogger('BookmarkModel');

/**
 * Full bookmark record as returned by the database.
 */
export type BookmarkRecord = InferSelectModel<typeof userBookmarks>;

/**
 * BookmarkModel provides low-level CRUD operations for the user_bookmarks table.
 */
export const BookmarkModel = {
    /**
     * Create a new bookmark record.
     *
     * @param data - Fields required to create the bookmark (InsertUserBookmark type from db-types)
     * @returns The created bookmark record
     */
    async insertBookmark(data: InsertUserBookmark): Promise<BookmarkRecord> {
        try {
            log.info('creating bookmark', 'insertBookmark', data);
            const rows = castReturning<BookmarkRecord>(
                await db.insert(userBookmarks).values(data).returning()
            );
            const bookmark = assertExists(rows[0], 'insertBookmark: no bookmark returned');
            log.query('insert', 'user_bookmarks', data, bookmark);
            return bookmark;
        } catch (error) {
            log.error('insertBookmark failed', 'insertBookmark', error);
            throw error;
        }
    },

    /**
     * Fetch a single bookmark by ID.
     *
     * @param id - UUID of the bookmark
     * @returns The bookmark record or undefined if not found
     */
    async selectBookmarkById(id: string): Promise<BookmarkRecord | undefined> {
        try {
            log.info('fetching bookmark by id', 'selectBookmarkById', { id });
            const [bookmark] = await db
                .select()
                .from(userBookmarks)
                .where(eq(userBookmarks.id, id))
                .limit(1);
            log.query('select', 'user_bookmarks', { id }, bookmark);
            return bookmark ? (bookmark as BookmarkRecord) : undefined;
        } catch (error) {
            log.error('selectBookmarkById failed', 'selectBookmarkById', error);
            throw error;
        }
    },

    /**
     * List bookmarks with optional filters and pagination.
     *
     * @param filter - Filtering and pagination options (SelectBookmarkFilter type from db-types)
     * @returns Array of bookmark records
     */
    async selectBookmarks(filter: SelectBookmarkFilter): Promise<BookmarkRecord[]> {
        try {
            log.info('listing bookmarks', 'selectBookmarks', filter);

            let query = db.select().from(userBookmarks).$dynamic();

            if (filter.ownerId) {
                query = query.where(eq(userBookmarks.ownerId, filter.ownerId));
            }

            if (filter.entityType) {
                query = query.where(eq(userBookmarks.entityType, filter.entityType));
            }

            if (filter.entityId) {
                query = query.where(eq(userBookmarks.entityId, filter.entityId));
            }

            if (filter.state) {
                // Added state filter
                query = query.where(eq(userBookmarks.state, filter.state));
            }

            if (filter.createdById) {
                // Added createdById filter
                query = query.where(eq(userBookmarks.createdById, filter.createdById));
            }
            if (filter.updatedById) {
                // Added updatedById filter
                query = query.where(eq(userBookmarks.updatedById, filter.updatedById));
            }
            if (filter.deletedById) {
                // Added deletedById filter
                query = query.where(eq(userBookmarks.deletedById, filter.deletedById));
            }

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                // Assuming search applies to name or description fields if they exist and are relevant for search
                // Based on schema, name and description exist.
                query = query.where(
                    or(ilike(userBookmarks.name, term), ilike(userBookmarks.description, term))
                );
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(userBookmarks.deletedAt));
            }

            // Use the getOrderByColumn utility
            const orderByColumn = getOrderByColumn(
                userBookmarks,
                filter.orderBy,
                userBookmarks.createdAt
            );
            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as BookmarkRecord[];

            log.query('select', 'user_bookmarks', filter, rows);
            return rows;
        } catch (error) {
            log.error('selectBookmarks failed', 'selectBookmarks', error);
            throw error;
        }
    },

    /**
     * Fetch bookmarks by entity type.
     *
     * @param entityType - Type of the bookmarked entity
     * @param pagination - Pagination options
     * @returns Array of bookmark records
     */
    async selectByEntityType(
        entityType: EntityTypeEnum,
        pagination: PaginationParams = {}
    ): Promise<BookmarkRecord[]> {
        log.info('fetching bookmarks by entity type', 'selectByEntityType', {
            entityType,
            pagination
        });
        const filter: SelectBookmarkFilter = { entityType, ...pagination, includeDeleted: false }; // Default to excluding deleted
        return this.selectBookmarks(filter);
    },

    /**
     * Fetch bookmarks by entity ID.
     *
     * @param entityId - ID of the bookmarked entity
     * @param pagination - Pagination options
     * @returns Array of bookmark records
     */
    async selectByEntityId(
        entityId: string,
        pagination: PaginationParams = {}
    ): Promise<BookmarkRecord[]> {
        log.info('fetching bookmarks by entity id', 'selectByEntityId', { entityId, pagination });
        const filter: SelectBookmarkFilter = { entityId, ...pagination, includeDeleted: false }; // Default to excluding deleted
        return this.selectBookmarks(filter);
    },

    /**
     * Update fields on an existing bookmark.
     *
     * @param id - UUID of the bookmark to update
     * @param changes - Partial fields to update (UpdateUserBookmarkData type from db-types)
     * @returns The updated bookmark record
     */
    async updateBookmark(id: string, changes: UpdateUserBookmarkData): Promise<BookmarkRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating bookmark', 'updateBookmark', { id, changes: dataToUpdate });
            const rows = castReturning<BookmarkRecord>(
                await db
                    .update(userBookmarks)
                    .set(dataToUpdate)
                    .where(eq(userBookmarks.id, id))
                    .returning()
            );
            const updated = assertExists(rows[0], `updateBookmark: no bookmark found for id ${id}`);
            log.query('update', 'user_bookmarks', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateBookmark failed', 'updateBookmark', error);
            throw error;
        }
    },

    /**
     * Soft-delete a bookmark by setting the deletedAt timestamp.
     *
     * @param id - UUID of the bookmark
     */
    async softDeleteBookmark(id: string): Promise<void> {
        try {
            log.info('soft deleting bookmark', 'softDeleteBookmark', { id });
            await db
                .update(userBookmarks)
                .set({ deletedAt: new Date() })
                .where(eq(userBookmarks.id, id));
            log.query('update', 'user_bookmarks', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteBookmark failed', 'softDeleteBookmark', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted bookmark by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the bookmark
     */
    async restoreBookmark(id: string): Promise<void> {
        try {
            log.info('restoring bookmark', 'restoreBookmark', { id });
            await db.update(userBookmarks).set({ deletedAt: null }).where(eq(userBookmarks.id, id));
            log.query('update', 'user_bookmarks', { id }, { restored: true });
        } catch (error) {
            log.error('restoreBookmark failed', 'restoreBookmark', error);
            throw error;
        }
    },

    /**
     * Permanently delete a bookmark record from the database.
     *
     * @param id - UUID of the bookmark
     */
    async hardDeleteBookmark(id: string): Promise<void> {
        try {
            log.info('hard deleting bookmark', 'hardDeleteBookmark', { id });
            await db.delete(userBookmarks).where(eq(userBookmarks.id, id));
            log.query('delete', 'user_bookmarks', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteBookmark failed', 'hardDeleteBookmark', error);
            throw error;
        }
    }
};
