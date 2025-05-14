import { logger } from '@repo/logger';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../client';
import { destinationAttractions } from '../schema/destination_attraction.dbschema';
import type {
    InsertDestinationAttraction,
    SelectDestinationAttractionFilter,
    UpdateDestinationAttractionData
} from '../types/db-types';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils';

/**
 * Scoped logger for destination attraction model operations.
 */
const log = logger.createLogger('DestinationAttractionModel');

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
            log.info('creating destination attraction', 'createAttraction', data);
            const rows = castReturning<DestinationAttractionRecord>(
                await db.insert(destinationAttractions).values(data).returning()
            );
            const attr = assertExists(rows[0], 'createAttraction: no attraction returned');
            log.query('insert', 'destination_attractions', data, attr);
            return attr;
        } catch (error) {
            log.error('createAttraction failed', 'createAttraction', error);
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
            log.info('fetching attraction by id', 'getAttractionById', { id });
            const [attr] = await db
                .select()
                .from(destinationAttractions)
                .where(eq(destinationAttractions.id, id))
                .limit(1);
            log.query('select', 'destination_attractions', { id }, attr);
            return attr ? (attr as DestinationAttractionRecord) : undefined;
        } catch (error) {
            log.error('getAttractionById failed', 'getAttractionById', error);
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
            log.info('listing attractions', 'listAttractions', filter);

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

            log.query('select', 'destination_attractions', filter, rows);
            return rows;
        } catch (error) {
            log.error('listAttractions failed', 'listAttractions', error);
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
            log.info('updating attraction', 'updateAttraction', {
                id,
                changes: dataToUpdate
            });
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
            log.query('update', 'destination_attractions', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateAttraction failed', 'updateAttraction', error);
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
            log.info('soft deleting attraction', 'softDeleteAttraction', { id });
            await db
                .update(destinationAttractions)
                .set({ deletedAt: new Date() })
                .where(eq(destinationAttractions.id, id));
            log.query('update', 'destination_attractions', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteAttraction failed', 'softDeleteAttraction', error);
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
            log.info('restoring attraction', 'restoreAttraction', { id });
            await db
                .update(destinationAttractions)
                .set({ deletedAt: null })
                .where(eq(destinationAttractions.id, id));
            log.query('update', 'destination_attractions', { id }, { restored: true });
        } catch (error) {
            log.error('restoreAttraction failed', 'restoreAttraction', error);
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
            log.info('hard deleting attraction', 'hardDeleteAttraction', { id });
            await db.delete(destinationAttractions).where(eq(destinationAttractions.id, id));
            log.query('delete', 'destination_attractions', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteAttraction failed', 'hardDeleteAttraction', error);
            throw error;
        }
    }
};
