import { dbLogger } from '@repo/db/utils/logger.js';
import type { EntityTypeEnum } from '@repo/types';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../client.js';
import { userBookmarks } from '../schema/index.js';
import type { SelectBookmarkFilter } from '../types/db-types.js';
import { assertExists, castReturning } from '../utils/db-utils.js';

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
            dbLogger.info(data, 'inserting bookmark');
            const db = getDb();
            const rows = castReturning<BookmarkRecord>(
                await db.insert(userBookmarks).values(data).returning()
            );
            const bookmark = assertExists(rows[0], 'insertBookmark: no record returned');
            dbLogger.query({
                table: 'user_bookmarks',
                action: 'insert',
                params: data,
                result: bookmark
            });
            return bookmark;
        } catch (error) {
            dbLogger.error(error, 'insertBookmark failed');
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
        dbLogger.info({ id }, 'selecting bookmark by id');
        try {
            const db = getDb();
            const [bookmark] = await db
                .select()
                .from(userBookmarks)
                .where(and(eq(userBookmarks.id, id), sql`${userBookmarks.deletedAt} is null`)) // Only non-deleted
                .limit(1);

            dbLogger.query({
                table: 'user_bookmarks',
                action: 'select',
                params: { id },
                result: bookmark
            });
            return bookmark;
        } catch (error) {
            dbLogger.error(error, 'selectBookmarkById failed');
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
        dbLogger.info({ id }, 'selecting bookmark by id including deleted');
        try {
            const db = getDb();
            const [bookmark] = await db
                .select()
                .from(userBookmarks)
                .where(eq(userBookmarks.id, id))
                .limit(1);

            dbLogger.query({
                table: 'user_bookmarks',
                action: 'select',
                params: { id, includeDeleted: true },
                result: bookmark
            });
            return bookmark;
        } catch (error) {
            dbLogger.error(error, 'selectBookmarkByIdIncludingDeleted failed');
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
        dbLogger.info(filter, 'selecting bookmarks with filter');
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
            dbLogger.query({
                table: 'user_bookmarks',
                action: 'select',
                params: filter,
                result: bookmarks
            });
            return bookmarks;
        } catch (error) {
            dbLogger.error(error, 'selectBookmarks failed');
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
            dbLogger.info({ id, data }, 'updating bookmark');
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
            dbLogger.query({
                table: 'user_bookmarks',
                action: 'update',
                params: { id, data },
                result: bookmark
            });
            return bookmark;
        } catch (error) {
            dbLogger.error(error, 'updateBookmark failed');
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
            dbLogger.info({ id }, 'hard deleting bookmark');
            const db = getDb();
            await db.delete(userBookmarks).where(eq(userBookmarks.id, id));
            dbLogger.query({
                table: 'user_bookmarks',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteBookmark failed');
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
        dbLogger.info({ ownerId }, 'counting bookmarks by owner');
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

            dbLogger.query({
                table: 'user_bookmarks',
                action: 'select count',
                params: { ownerId },
                result: { count: bookmarkCount }
            });
            return bookmarkCount;
        } catch (error) {
            dbLogger.error(error, 'countByOwnerId failed');
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
        dbLogger.debug({ ownerId, entityType, entityId }, 'checking bookmark existence');
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

            dbLogger.debug(
                {
                    ownerId,
                    entityType,
                    entityId,
                    exists: !!bookmark
                },
                'bookmark existence check result'
            );
            return !!bookmark;
        } catch (error) {
            dbLogger.error(error, 'bookmark existence check failed');
            throw error;
        }
    },

    /**
     * Hard delete all bookmarks for a specific owner.
     * @param ownerId - The ID of the owner whose bookmarks to hard delete.
     * @throws Error if deletion fails.
     */
    async hardDeleteAllByOwnerId(ownerId: string): Promise<void> {
        dbLogger.info({ ownerId }, 'hard deleting all bookmarks by owner');
        try {
            const db = getDb();
            await db.delete(userBookmarks).where(eq(userBookmarks.ownerId, ownerId));
            dbLogger.query({
                table: 'user_bookmarks',
                action: 'delete',
                params: { ownerId },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteAllByOwnerId failed');
            throw error;
        }
    },

    /**
     * Hard delete bookmarks soft-deleted before a cutoff date.
     * @param cutoffDate - The date before which soft-deleted bookmarks should be purged.
     * @throws Error if deletion fails.
     */
    async hardDeleteOlderThan(cutoffDate: Date): Promise<void> {
        dbLogger.info({ cutoffDate }, 'purging old bookmarks');
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
            dbLogger.query({
                table: 'user_bookmarks',
                action: 'delete',
                params: { cutoffDate },
                result: { purged: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteOlderThan failed');
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
        dbLogger.info({ limit }, 'getting most bookmarked entities');
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

            dbLogger.query({
                table: 'user_bookmarks',
                action: 'select grouped count',
                params: { limit },
                result: formattedResults
            });
            return formattedResults;
        } catch (error) {
            dbLogger.error(error, 'getMostBookmarkedEntities failed');
            throw error;
        }
    }
};
