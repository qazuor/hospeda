import { logger } from '@repo/logger';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { getDb } from '../client.js';
import { tags } from '../schema/tag.dbschema.js';
import type { InsertTag, SelectTagFilter, UpdateTagData } from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

/**
 * Scoped logger for tag model operations.
 */
const log = logger.createLogger('TagModel');

/**
 * Full tag record as returned by the database.
 */
export type TagRecord = InferSelectModel<typeof tags>;

/**
 * TagModel provides CRUD operations for the tags table.
 */
export const TagModel = {
    /**
     * Create a new tag.
     *
     * @param data - Fields required to create the tag (InsertTag type from db-types)
     * @returns The created tag record
     */
    async createTag(data: InsertTag): Promise<TagRecord> {
        try {
            log.info('creating a new tag', 'createTag', data);
            const db = getDb();
            const rows = castReturning<TagRecord>(await db.insert(tags).values(data).returning());
            const tag = assertExists(rows[0], 'createTag: no record returned');
            log.query('insert', 'tags', data, tag);
            return tag;
        } catch (error) {
            log.error('createTag failed', 'createTag', error);
            throw error;
        }
    },

    /**
     * Fetch a single tag by ID.
     *
     * @param id - UUID of the tag
     * @returns The tag record or undefined if not found
     */
    async getTagById(id: string): Promise<TagRecord | undefined> {
        try {
            log.info('fetching tag by id', 'getTagById', { id });
            const db = getDb();
            const [tag] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
            log.query('select', 'tags', { id }, tag);
            return tag ? (tag as TagRecord) : undefined;
        } catch (error) {
            log.error('getTagById failed', 'getTagById', error);
            throw error;
        }
    },

    /**
     * List tags with optional filters, pagination, and search.
     *
     * @param filter - Pagination and filtering options (SelectTagFilter type from db-types)
     * @returns Array of tag records
     */
    async listTags(filter: SelectTagFilter): Promise<TagRecord[]> {
        try {
            log.info('listing tags', 'listTags', filter);
            const db = getDb();
            let query = db.select().from(tags).$dynamic();

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                query = query.where(or(ilike(tags.name, term), ilike(tags.displayName, term)));
            }

            if (filter.ownerId) {
                query = query.where(eq(tags.ownerId, filter.ownerId));
            }

            if (filter.state) {
                // Using inherited 'state' filter
                query = query.where(eq(tags.state, filter.state));
            }

            if (filter.color) {
                query = query.where(eq(tags.color, filter.color));
            }

            if (filter.createdById) {
                // Added createdById filter
                query = query.where(eq(tags.createdById, filter.createdById));
            }
            if (filter.updatedById) {
                // Added updatedById filter
                query = query.where(eq(tags.updatedById, filter.updatedById));
            }
            if (filter.deletedById) {
                // Added deletedById filter
                query = query.where(eq(tags.deletedById, filter.deletedById));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(tags.deletedAt));
            }

            // Use the getOrderByColumn utility with double type assertion for the schema object
            const orderByColumn = getOrderByColumn(
                // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                tags as unknown as Record<string, PgColumn<any, any, any>>,
                filter.orderBy,
                tags.createdAt
            );
            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as TagRecord[];

            log.query('select', 'tags', filter, rows);
            return rows;
        } catch (error) {
            log.error('listTags failed', 'listTags', error);
            throw error;
        }
    },

    /**
     * Update fields on an existing tag.
     *
     * @param id - UUID of the tag to update
     * @param changes - Partial fields to update (UpdateTagData type from db-types)
     * @returns The updated tag record
     */
    async updateTag(id: string, changes: UpdateTagData): Promise<TagRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating tag', 'updateTag', { id, dataToUpdate });
            const db = getDb();
            const rows = castReturning<TagRecord>(
                await db.update(tags).set(dataToUpdate).where(eq(tags.id, id)).returning()
            );
            const updated = assertExists(rows[0], `updateTag: no tag found for id ${id}`);
            log.query('update', 'tags', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateTag failed', 'updateTag', error);
            throw error;
        }
    },

    /**
     * Soft-delete a tag by setting the deletedAt timestamp.
     *
     * @param id - UUID of the tag
     */
    async softDeleteTag(id: string): Promise<void> {
        try {
            log.info('soft deleting tag', 'softDeleteTag', { id });
            const db = getDb();
            await db.update(tags).set({ deletedAt: new Date() }).where(eq(tags.id, id));
            log.query('update', 'tags', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteTag failed', 'softDeleteTag', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted tag by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the tag
     */
    async restoreTag(id: string): Promise<void> {
        try {
            log.info('restoring tag', 'restoreTag', { id });
            const db = getDb();
            await db.update(tags).set({ deletedAt: null }).where(eq(tags.id, id));
            log.query('update', 'tags', { id }, { restored: true });
        } catch (error) {
            log.error('restoreTag failed', 'restoreTag', error);
            throw error;
        }
    },

    /**
     * Permanently delete a tag record from the database.
     *
     * @param id - UUID of the tag
     */
    async hardDeleteTag(id: string): Promise<void> {
        try {
            log.info('hard deleting tag', 'hardDeleteTag', { id });
            const db = getDb();
            await db.delete(tags).where(eq(tags.id, id));
            log.query('delete', 'tags', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteTag failed', 'hardDeleteTag', error);
            throw error;
        }
    }
};
