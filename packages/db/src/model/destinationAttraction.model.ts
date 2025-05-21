import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { getDb } from '../client.js';
import { destinationAttractions } from '../schema/destination_attraction.dbschema.js';
import type {
    InsertDestinationAttraction,
    SelectDestinationAttractionFilter,
    UpdateDestinationAttractionData
} from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

/**
 * Full destination attraction record as returned by the database.
 */
export type DestinationAttractionRecord = InferSelectModel<typeof destinationAttractions>;

/**
 * DestinationAttractionModel provides CRUD operations for the destination_attractions table.
 */
export const DestinationAttractionModel = {
    /**
     * Create a new attraction.
     *
     * @param data - Fields required to create the attraction (InsertDestinationAttraction type from db-types)
     * @returns The created attraction record
     */
    async createAttraction(
        data: InsertDestinationAttraction
    ): Promise<DestinationAttractionRecord> {
        try {
            dbLogger.info(data, 'creating destination attraction');
            const db = getDb();
            const rows = castReturning<DestinationAttractionRecord>(
                await db.insert(destinationAttractions).values(data).returning()
            );
            const attr = assertExists(rows[0], 'createAttraction: no attraction returned');
            dbLogger.query({
                table: 'destination_attractions',
                action: 'insert',
                params: data,
                result: attr
            });
            return attr;
        } catch (error) {
            dbLogger.error(error, 'createAttraction failed');
            throw error;
        }
    },

    /**
     * Fetch a single attraction by ID.
     *
     * @param id - UUID of the attraction
     * @returns The attraction record or undefined if not found
     */
    async getAttractionById(id: string): Promise<DestinationAttractionRecord | undefined> {
        try {
            dbLogger.info({ id }, 'fetching attraction by id');
            const db = getDb();
            const [attr] = await db
                .select()
                .from(destinationAttractions)
                .where(eq(destinationAttractions.id, id))
                .limit(1);
            dbLogger.query({
                table: 'destination_attractions',
                action: 'select',
                params: { id },
                result: attr
            });
            return attr ? (attr as DestinationAttractionRecord) : undefined;
        } catch (error) {
            dbLogger.error(error, 'getAttractionById failed');
            throw error;
        }
    },

    /**
     * List attractions with optional filters, pagination, and search.
     *
     * @param filter - Filtering and pagination options (SelectDestinationAttractionFilter type from db-types)
     * @returns Array of attraction records
     */
    async listAttractions(
        filter: SelectDestinationAttractionFilter
    ): Promise<DestinationAttractionRecord[]> {
        try {
            dbLogger.info(filter, 'listing attractions');
            const db = getDb();
            let query = db.select().from(destinationAttractions).$dynamic();

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                query = query.where(
                    or(
                        ilike(destinationAttractions.name, term),
                        ilike(destinationAttractions.displayName, term),
                        ilike(destinationAttractions.description, term),
                        ilike(destinationAttractions.slug, term)
                    )
                );
            }

            if (filter.state) {
                query = query.where(eq(destinationAttractions.state, filter.state));
            }

            if (filter.createdById) {
                query = query.where(eq(destinationAttractions.createdById, filter.createdById));
            }
            if (filter.updatedById) {
                query = query.where(eq(destinationAttractions.updatedById, filter.updatedById));
            }
            if (filter.deletedById) {
                query = query.where(eq(destinationAttractions.deletedById, filter.deletedById));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(destinationAttractions.deletedAt));
            }

            // Use the getOrderByColumn utility
            const orderByColumn = getOrderByColumn(
                destinationAttractions,
                filter.orderBy,
                destinationAttractions.createdAt
            );
            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as DestinationAttractionRecord[];

            dbLogger.query({
                table: 'destination_attractions',
                action: 'select',
                params: filter,
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listAttractions failed');
            throw error;
        }
    },

    /**
     * Update fields on an existing attraction.
     *
     * @param id - UUID of the attraction to update
     * @param changes - Partial fields to update (UpdateDestinationAttractionData type from db-types)
     * @returns The updated attraction record
     */
    async updateAttraction(
        id: string,
        changes: UpdateDestinationAttractionData
    ): Promise<DestinationAttractionRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            dbLogger.info(
                {
                    id,
                    changes: dataToUpdate
                },
                'updating attraction'
            );
            const db = getDb();
            const rows = castReturning<DestinationAttractionRecord>(
                await db
                    .update(destinationAttractions)
                    .set(dataToUpdate)
                    .where(eq(destinationAttractions.id, id))
                    .returning()
            );
            const updated = assertExists(
                rows[0],
                `updateAttraction: no attraction found for id ${id}`
            );
            dbLogger.query({
                table: 'destination_attractions',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateAttraction failed');
            throw error;
        }
    },

    /**
     * Soft-delete an attraction by setting the deletedAt timestamp.
     *
     * @param id - UUID of the attraction
     */
    async softDeleteAttraction(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'soft deleting attraction');
            const db = getDb();
            await db
                .update(destinationAttractions)
                .set({ deletedAt: new Date() })
                .where(eq(destinationAttractions.id, id));
            dbLogger.query({
                table: 'destination_attractions',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteAttraction failed');
            throw error;
        }
    },

    /**
     * Restore a soft-deleted attraction by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the attraction
     */
    async restoreAttraction(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'restoring attraction');
            const db = getDb();
            await db
                .update(destinationAttractions)
                .set({ deletedAt: null })
                .where(eq(destinationAttractions.id, id));
            dbLogger.query({
                table: 'destination_attractions',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreAttraction failed');
            throw error;
        }
    },

    /**
     * Permanently delete an attraction record from the database.
     *
     * @param id - UUID of the attraction
     */
    async hardDeleteAttraction(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'hard deleting attraction');
            const db = getDb();
            await db.delete(destinationAttractions).where(eq(destinationAttractions.id, id));
            dbLogger.query({
                table: 'destination_attractions',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteAttraction failed');
            throw error;
        }
    }
};
