import { logger } from '@repo/logger';
import type { EntityTypeEnum } from '@repo/types';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, isNull } from 'drizzle-orm';
import { db } from '../client';
import { userBookmarks } from '../schema/bookmark.dbschema';
import type { BaseSelectFilter, UpdateData } from '../types/db-types';
import { assertExists, castReturning, sanitizePartialUpdate } from '../utils/db-utils';

// Create a scoped logger for bookmark model operations
const log = logger.createLogger('BookmarkModel');

/**
 * Type representing a full bookmark record as selected from the database.
 */
export type BookmarkRecord = InferSelectModel<typeof userBookmarks>;

/**
 * Type representing the data needed to insert a new bookmark.
 */
export type CreateBookmarkData = InferInsertModel<typeof userBookmarks>;

/**
 * Type representing the fields that can be updated on a bookmark (partial insert fields).
 */
export type UpdateBookmarkData = UpdateData<CreateBookmarkData>;

/**
 * Filters and pagination options for querying bookmarks.
 */
export interface SelectBookmarkFilter extends BaseSelectFilter {
    /** ID of the user who owns the bookmarks */
    ownerId: string;
    /** Optional filter by entity ID */
    entityId?: string;
    /** Optional filter by entity type */
    entityType?: EntityTypeEnum;
}

/**
 * Model layer for user bookmarks.
 * Contains low-level CRUD operations using Drizzle.
 */
export const BookmarkModel = {
    /**
     * Insert a new bookmark record.
     *
     * @param data - The fields required to create a bookmark
     * @returns The created bookmark record
     */
    async insertBookmark(data: CreateBookmarkData): Promise<BookmarkRecord> {
        try {
            log.info('creating a new bookmark', 'insertBookmark', data);
            const result = castReturning<BookmarkRecord>(
                await db.insert(userBookmarks).values(data).returning()
            );
            const created = assertExists(
                result[0],
                'insertBookmark: no record returned after insert'
            );
            log.query('insert', 'user_bookmarks', data, created);
            return created;
        } catch (error) {
            log.error('insertBookmark failed', 'insertBookmark', error);
            throw error;
        }
    },

    /**
     * Select bookmarks with optional filtering and pagination.
     *
     * @param filter - Filtering and pagination options
     * @returns Array of bookmark records
     */
    async selectBookmarks(filter: SelectBookmarkFilter): Promise<BookmarkRecord[]> {
        try {
            log.info('fetching bookmarks', 'selectBookmarks', filter);

            // Build base query (cast to any for fluent where())
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            let rawQuery: any = db.select().from(userBookmarks);

            // Apply filters
            rawQuery = rawQuery.where(eq(userBookmarks.ownerId, filter.ownerId));
            if (filter.entityType) {
                rawQuery = rawQuery.where(eq(userBookmarks.entityType, filter.entityType));
            }
            if (!filter.includeDeleted) {
                rawQuery = rawQuery.where(isNull(userBookmarks.deletedAt));
            }

            // Apply pagination and ordering, then cast back
            const paged = (await rawQuery
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(userBookmarks.createdAt, 'desc')) as BookmarkRecord[];

            log.query('select', 'user_bookmarks', filter, paged);
            return paged;
        } catch (error) {
            log.error('selectBookmarks failed', 'selectBookmarks', error);
            throw error;
        }
    },

    /**
     * Helper: fetch all bookmarks for a given entityType (admin use).
     */
    async selectByEntityType(
        entityType: EntityTypeEnum,
        pagination: Pick<BaseSelectFilter, 'limit' | 'offset' | 'order'>
    ): Promise<BookmarkRecord[]> {
        return this.selectBookmarks({
            ownerId: '', // ignored
            entityType,
            includeDeleted: true,
            limit: pagination.limit,
            offset: pagination.offset,
            order: pagination.order
        });
    },

    /**
     * Helper: fetch all bookmarks for a given entityId (admin use).
     */
    async selectByEntityId(
        entityId: string,
        pagination: Pick<BaseSelectFilter, 'limit' | 'offset' | 'order'>
    ): Promise<BookmarkRecord[]> {
        return this.selectBookmarks({
            ownerId: '', // ignored
            entityId,
            includeDeleted: true,
            limit: pagination.limit,
            offset: pagination.offset,
            order: pagination.order
        });
    },

    /**
     * Select a single bookmark by its ID.
     *
     * @param id - Bookmark record ID
     * @returns The bookmark record or undefined if not found
     */
    async selectBookmarkById(id: string): Promise<BookmarkRecord | undefined> {
        try {
            log.info('fetching bookmark by id', 'selectBookmarkById', { id });

            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            const raw: any = db
                .select()
                .from(userBookmarks)
                .where(eq(userBookmarks.id, id))
                .limit(1);
            const [record] = (await raw) as BookmarkRecord[];

            log.query('select', 'user_bookmarks', { id }, record);
            return record;
        } catch (error) {
            log.error('selectBookmarkById failed', 'selectBookmarkById', error);
            throw error;
        }
    },

    /**
     * Update fields on an existing bookmark.
     *
     * @param id - Bookmark record ID
     * @param changes - Partial fields to update
     * @returns The updated bookmark record
     */
    async updateBookmark(id: string, changes: UpdateBookmarkData): Promise<BookmarkRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating bookmark', 'updateBookmark', { id, dataToUpdate });
            const updatedRows = castReturning<BookmarkRecord>(
                await db
                    .update(userBookmarks)
                    .set(dataToUpdate)
                    .where(eq(userBookmarks.id, id))
                    .returning()
            );
            const updated = assertExists(
                updatedRows[0],
                `updateBookmark: no record found for id ${id}`
            );
            log.query('update', 'user_bookmarks', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateBookmark failed', 'updateBookmark', error);
            throw error;
        }
    },

    /**
     * Soft-delete a bookmark by setting its deletedAt timestamp.
     *
     * @param id - Bookmark record ID
     */
    async softDeleteBookmark(id: string): Promise<void> {
        try {
            const deletedAt = new Date();
            log.info('soft deleting bookmark', 'softDeleteBookmark', { id });
            await db.update(userBookmarks).set({ deletedAt }).where(eq(userBookmarks.id, id));
            log.query(
                'update',
                'user_bookmarks',
                { id, deletedAt },
                { deleted: true, hard: false }
            );
        } catch (error) {
            log.error('softDeleteBookmark failed', 'softDeleteBookmark', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted bookmark by clearing its deletedAt timestamp.
     *
     * @param id - Bookmark record ID
     */
    async restoreBookmark(id: string): Promise<void> {
        try {
            log.info('restoring bookmark', 'restoreBookmark', { id });
            await db.update(userBookmarks).set({ deletedAt: null }).where(eq(userBookmarks.id, id));
            log.query('update', 'user_bookmarks', { id, deletedAt: null }, { restored: true });
        } catch (error) {
            log.error('restoreBookmark failed', 'restoreBookmark', error);
            throw error;
        }
    },

    /**
     * Permanently delete a bookmark record from the database.
     *
     * @param id - Bookmark record ID
     */
    async hardDeleteBookmark(id: string): Promise<void> {
        try {
            log.info('permanently deleting bookmark', 'hardDeleteBookmark', { id });
            await db.delete(userBookmarks).where(eq(userBookmarks.id, id));
            log.query('delete', 'user_bookmarks', { id }, { deleted: true, hard: true });
        } catch (error) {
            log.error('hardDeleteBookmark failed', 'hardDeleteBookmark', error);
            throw error;
        }
    }
};
