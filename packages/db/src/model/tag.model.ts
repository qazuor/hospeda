import { dbLogger } from '@repo/db/utils/logger.js';
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
            dbLogger.info(data, 'creating a new tag');
            const db = getDb();
            const rows = castReturning<TagRecord>(await db.insert(tags).values(data).returning());
            const tag = assertExists(rows[0], 'createTag: no record returned');
            dbLogger.query({ table: 'tags', action: 'insert', params: data, result: tag });
            return tag;
        } catch (error) {
            dbLogger.error(error, 'createTag failed');
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
            dbLogger.info({ id }, 'fetching tag by id');
            const db = getDb();
            const [tag] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
            dbLogger.query({ table: 'tags', action: 'select', params: { id }, result: tag });
            return tag ? (tag as TagRecord) : undefined;
        } catch (error) {
            dbLogger.error(error, 'getTagById failed');
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
            dbLogger.info(filter, 'listing tags');
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

            dbLogger.query({ table: 'tags', action: 'select', params: filter, result: rows });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listTags failed');
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
            dbLogger.info({ id, dataToUpdate }, 'updating tag');
            const db = getDb();
            const rows = castReturning<TagRecord>(
                await db.update(tags).set(dataToUpdate).where(eq(tags.id, id)).returning()
            );
            const updated = assertExists(rows[0], `updateTag: no tag found for id ${id}`);
            dbLogger.query({
                table: 'tags',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateTag failed');
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
            dbLogger.info({ id }, 'soft deleting tag');
            const db = getDb();
            await db.update(tags).set({ deletedAt: new Date() }).where(eq(tags.id, id));
            dbLogger.query({
                table: 'tags',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteTag failed');
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
            dbLogger.info({ id }, 'restoring tag');
            const db = getDb();
            await db.update(tags).set({ deletedAt: null }).where(eq(tags.id, id));
            dbLogger.query({
                table: 'tags',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreTag failed');
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
            dbLogger.info({ id }, 'hard deleting tag');
            const db = getDb();
            await db.delete(tags).where(eq(tags.id, id));
            dbLogger.query({
                table: 'tags',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteTag failed');
            throw error;
        }
    }
};
