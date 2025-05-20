import { logger } from '@repo/logger';
import type { EntityTypeEnum } from '@repo/types';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../client.js';
import { userBookmarks } from '../schema/index.js';
import type { SelectBookmarkFilter } from '../types/db-types.js';
import { assertExists, castReturning } from '../utils/db-utils.js';

/**
 * Scoped logger for bookmark model operations.
 */
const log = logger.createLogger('BookmarkModel');

/**
 * Full bookmark record as returned by the database.
 */
export type BookmarkRecord = InferSelectModel<typeof userBookmarks>;

/**
 * Data required to insert a new bookmark.
 */
export type InsertUserBookmark = InferInsertModel<typeof userBookmarks>;

/**
 * Data for updating an existing bookmark.
 */
export type UpdateUserBookmarkData = Partial<
    Omit<
        BookmarkRecord,
        | 'id'
        | 'createdAt'
        | 'updatedAt'
        | 'deletedAt'
        | 'createdById'
        | 'updatedById'
        | 'deletedById'
    >
>;

/**
 * BookmarkModel provides CRUD and query operations for the user_bookmarks table.
 * Handles direct database interactions.
 */
export const BookmarkModel = {
    /**
     * Insert a new bookmark into the database.
     * @param data - The data for the new bookmark.
     * @returns The created bookmark record.
     * @throws Error if insertion fails.
     */
    async insertBookmark(data: InsertUserBookmark): Promise<BookmarkRecord> {
        try {
            log.info('inserting bookmark', 'insertBookmark', data);
            const db = getDb();
            const rows = castReturning<BookmarkRecord>(
                await db.insert(userBookmarks).values(data).returning()
            );
            const bookmark = assertExists(rows[0], 'insertBookmark: no record returned');
            log.query('insert', 'user_bookmarks', data, bookmark);
            return bookmark;
        } catch (error) {
            log.error('insertBookmark failed', 'insertBookmark', error);
            throw error;
        }
    },

    /**
     * Select a single bookmark by its ID.
     * By default, only returns non-soft-deleted records.
     * @param id - The ID of the bookmark.
     * @returns The bookmark record or undefined if not found or soft-deleted.
     * @throws Error if the database query fails.
     */
    async selectBookmarkById(id: string): Promise<BookmarkRecord | undefined> {
        log.info('selecting bookmark by id', 'selectBookmarkById', { id });
        try {
            const db = getDb();
            const [bookmark] = await db
                .select()
                .from(userBookmarks)
                .where(and(eq(userBookmarks.id, id), sql`${userBookmarks.deletedAt} is null`)) // Only non-deleted
                .limit(1);

            log.query('select', 'user_bookmarks', { id }, bookmark);
            return bookmark;
        } catch (error) {
            log.error('selectBookmarkById failed', 'selectBookmarkById', error);
            throw error;
        }
    },

    /**
     * Select a single bookmark by its ID, including soft-deleted records.
     * Needed for operations like restore or hard delete where the record might be soft-deleted.
     * @param id - The ID of the bookmark.
     * @returns The bookmark record or undefined if not found.
     * @throws Error if the database query fails.
     */
    async selectBookmarkByIdIncludingDeleted(id: string): Promise<BookmarkRecord | undefined> {
        log.info(
            'selecting bookmark by id including deleted',
            'selectBookmarkByIdIncludingDeleted',
            { id }
        );
        try {
            const db = getDb();
            const [bookmark] = await db
                .select()
                .from(userBookmarks)
                .where(eq(userBookmarks.id, id))
                .limit(1);

            log.query('select', 'user_bookmarks', { id, includeDeleted: true }, bookmark);
            return bookmark;
        } catch (error) {
            log.error(
                'selectBookmarkByIdIncludingDeleted failed',
                'selectBookmarkByIdIncludingDeleted',
                error
            );
            throw error;
        }
    },

    /**
     * List bookmarks based on various filters.
     * @param filter - Filtering and pagination options.
     * @returns An array of bookmark records.
     * @throws Error if listing fails.
     */
    async selectBookmarks(filter: SelectBookmarkFilter): Promise<BookmarkRecord[]> {
        log.info('selecting bookmarks with filter', 'selectBookmarks', filter);
        try {
            const db = getDb();
            let query = db.select().from(userBookmarks).$dynamic();

            const conditions = [];
            if (filter.ownerId !== undefined)
                conditions.push(eq(userBookmarks.ownerId, filter.ownerId));
            if (filter.entityType !== undefined)
                conditions.push(eq(userBookmarks.entityType, filter.entityType));
            if (filter.entityId !== undefined)
                conditions.push(eq(userBookmarks.entityId, filter.entityId));

            if (!filter.includeDeleted) {
                conditions.push(sql`${userBookmarks.deletedAt} is null`);
            }

            if (conditions.length > 0) {
                query = query.where(and(...conditions));
            }

            query = query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(desc(userBookmarks.createdAt));

            const bookmarks = await query;
            log.query('select', 'user_bookmarks', filter, bookmarks);
            return bookmarks;
        } catch (error) {
            log.error('selectBookmarks failed', 'selectBookmarks', error);
            throw error;
        }
    },

    /**
     * Update an existing bookmark.
     * @param id - The ID of the bookmark to update.
     * @param data - The partial data to update.
     * @returns The updated bookmark record.
     * @throws Error if update fails or no record is found.
     */
    async updateBookmark(id: string, data: UpdateUserBookmarkData): Promise<BookmarkRecord> {
        try {
            log.info('updating bookmark', 'updateBookmark', { id, data });
            const db = getDb();
            const rows = castReturning<BookmarkRecord>(
                await db
                    .update(userBookmarks)
                    .set({ ...data, updatedAt: new Date() })
                    .where(eq(userBookmarks.id, id))
                    .returning()
            );
            const bookmark = assertExists(
                rows[0],
                `updateBookmark: record ${id} not found or not updated`
            );
            log.query('update', 'user_bookmarks', { id, data }, bookmark);
            return bookmark;
        } catch (error) {
            log.error('updateBookmark failed', 'updateBookmark', error);
            throw error;
        }
    },

    /**
     * Permanently delete a bookmark by its ID.
     * @param id - The ID of the bookmark to hard-delete.
     * @throws Error if deletion fails.
     */
    async hardDeleteBookmark(id: string): Promise<void> {
        try {
            log.info('hard deleting bookmark', 'hardDeleteBookmark', { id });
            const db = getDb();
            await db.delete(userBookmarks).where(eq(userBookmarks.id, id));
            log.query('delete', 'user_bookmarks', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteBookmark failed', 'hardDeleteBookmark', error);
            throw error;
        }
    },

    /**
     * Count bookmarks for a specific owner.
     * Only counts non-soft-deleted bookmarks.
     * @param ownerId - The ID of the owner.
     * @returns The number of non-soft-deleted bookmarks for the owner.
     * @throws Error if the database query fails.
     */
    async countByOwnerId(ownerId: string): Promise<number> {
        log.info('counting bookmarks by owner', 'countByOwnerId', { ownerId });
        try {
            const db = getDb();
            const [result] = await db
                .select({ count: count() })
                .from(userBookmarks)
                .where(
                    and(eq(userBookmarks.ownerId, ownerId), sql`${userBookmarks.deletedAt} is null`)
                );

            // Drizzle count is a string, safely parse to number using explicit conversion
            const bookmarkCount = Number.parseInt(String(result?.count ?? '0'), 10);

            log.query('select count', 'user_bookmarks', { ownerId }, { count: bookmarkCount });
            return bookmarkCount;
        } catch (error) {
            log.error('countByOwnerId failed', 'countByOwnerId', error);
            throw error;
        }
    },

    /**
     * Check if a specific bookmark relation exists for a user and entity.
     * Only checks for non-soft-deleted bookmarks.
     * @param ownerId - The ID of the user (owner).
     * @param entityType - The type of the entity.
     * @param entityId - The ID of the entity.
     * @returns True if a non-soft-deleted bookmark exists, false otherwise.
     * @throws Error if the database query fails.
     */
    async exists(ownerId: string, entityType: EntityTypeEnum, entityId: string): Promise<boolean> {
        log.debug('checking bookmark existence', 'exists', { ownerId, entityType, entityId });
        try {
            const db = getDb();
            const [bookmark] = await db
                .select({ id: userBookmarks.id })
                .from(userBookmarks)
                .where(
                    and(
                        eq(userBookmarks.ownerId, ownerId),
                        eq(userBookmarks.entityType, entityType),
                        eq(userBookmarks.entityId, entityId),
                        sql`${userBookmarks.deletedAt} is null`
                    )
                )
                .limit(1);

            log.debug('bookmark existence check result', 'exists', {
                ownerId,
                entityType,
                entityId,
                exists: !!bookmark
            });
            return !!bookmark;
        } catch (error) {
            log.error('bookmark existence check failed', 'exists', error);
            throw error;
        }
    },

    /**
     * Hard delete all bookmarks for a specific owner.
     * @param ownerId - The ID of the owner whose bookmarks to hard delete.
     * @throws Error if deletion fails.
     */
    async hardDeleteAllByOwnerId(ownerId: string): Promise<void> {
        log.info('hard deleting all bookmarks by owner', 'hardDeleteAllByOwnerId', { ownerId });
        try {
            const db = getDb();
            await db.delete(userBookmarks).where(eq(userBookmarks.ownerId, ownerId));
            log.query('delete', 'user_bookmarks', { ownerId }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteAllByOwnerId failed', 'hardDeleteAllByOwnerId', error);
            throw error;
        }
    },

    /**
     * Hard delete bookmarks soft-deleted before a cutoff date.
     * @param cutoffDate - The date before which soft-deleted bookmarks should be purged.
     * @throws Error if deletion fails.
     */
    async hardDeleteOlderThan(cutoffDate: Date): Promise<void> {
        log.info('purging old bookmarks', 'hardDeleteOlderThan', { cutoffDate });
        try {
            const db = getDb();
            await db
                .delete(userBookmarks)
                .where(
                    and(
                        sql`${userBookmarks.deletedAt} is not null`,
                        sql`${userBookmarks.deletedAt} < ${cutoffDate}`
                    )
                );
            log.query('delete', 'user_bookmarks', { cutoffDate }, { purged: true });
        } catch (error) {
            log.error('hardDeleteOlderThan failed', 'hardDeleteOlderThan', error);
            throw error;
        }
    },

    /**
     * Get a list of entities that are bookmarked the most.
     * Only counts non-soft-deleted bookmarks.
     * @param limit - The maximum number of entities to return.
     * @returns An array of objects containing entityType, entityId, and bookmarkCount.
     * @throws Error if query fails.
     */
    async getMostBookmarkedEntities(
        limit: number
    ): Promise<Array<{ entityType: EntityTypeEnum; entityId: string; bookmarkCount: number }>> {
        log.info('getting most bookmarked entities', 'getMostBookmarkedEntities', { limit });
        try {
            const db = getDb();
            const results = await db
                .select({
                    entityType: userBookmarks.entityType,
                    entityId: userBookmarks.entityId,
                    bookmarkCount: count(userBookmarks.id)
                })
                .from(userBookmarks)
                .where(sql`${userBookmarks.deletedAt} is null`)
                .groupBy(userBookmarks.entityType, userBookmarks.entityId)
                .orderBy(desc(sql`bookmarkCount`))
                .limit(limit);

            // Map results to ensure bookmarkCount is a number using explicit conversion
            const formattedResults = results.map((row) => ({
                entityType: row.entityType,
                entityId: row.entityId,
                bookmarkCount: Number.parseInt(String(row.bookmarkCount), 10)
            }));

            log.query('select grouped count', 'user_bookmarks', { limit }, formattedResults);
            return formattedResults;
        } catch (error) {
            log.error('getMostBookmarkedEntities failed', 'getMostBookmarkedEntities', error);
            throw error;
        }
    }
};
