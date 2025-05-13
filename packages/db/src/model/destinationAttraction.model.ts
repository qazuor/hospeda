import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, ilike, isNull, or } from 'drizzle-orm';
import type { BaseSelectFilter, UpdateData } from 'src/types/db.types';
import { db } from '../client';
import { destinationAttractions } from '../schema/destination_attraction.dbschema';
import { assertExists, castReturning, rawSelect, sanitizePartialUpdate } from '../utils/db-utils';

/**
 * Scoped logger for DestinationAttractionModel operations.
 */
const log = logger.createLogger('DestinationAttractionModel');

/**
 * Full destination attraction record as returned by the database.
 */
export type DestinationAttractionRecord = InferSelectModel<typeof destinationAttractions>;

/**
 * Data required to create a new destination attraction.
 */
export type CreateDestinationAttractionData = InferInsertModel<typeof destinationAttractions>;

/**
 * Fields allowed for updating a destination attraction.
 */
export type UpdateDestinationAttractionData = UpdateData<CreateDestinationAttractionData>;

/**
 * Filter options for listing attractions.
 */
export interface SelectDestinationAttractionFilter extends BaseSelectFilter {
    /** ID of the destination */
    destinationId: string;
    /** Optional fuzzy search on name or description */
    query?: string;
    /** Include soft-deleted if true */
    includeDeleted?: boolean;
}

/**
 * DestinationAttractionModel provides CRUD operations for the destination_attractions table.
 */
export const DestinationAttractionModel = {
    /**
     * Create a new attraction.
     *
     * @param data - Fields required to create the attraction
     * @returns The created attraction record
     */
    async createAttraction(
        data: CreateDestinationAttractionData
    ): Promise<DestinationAttractionRecord> {
        try {
            log.info('creating destination attraction', 'createAttraction', data);
            const rows = castReturning<DestinationAttractionRecord>(
                await db.insert(destinationAttractions).values(data).returning()
            );
            const attraction = assertExists(rows[0], 'createAttraction: no attraction returned');
            log.query('insert', 'destination_attractions', data, attraction);
            return attraction;
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
            const [attraction] = (await db
                .select()
                .from(destinationAttractions)
                .where(eq(destinationAttractions.id, id))
                .limit(1)) as DestinationAttractionRecord[];
            log.query('select', 'destination_attractions', { id }, attraction);
            return attraction;
        } catch (error) {
            log.error('getAttractionById failed', 'getAttractionById', error);
            throw error;
        }
    },

    /**
     * List attractions for a given destination.
     *
     * @param filter - Filtering and pagination options
     * @returns Array of attraction records
     */
    async listAttractions(
        filter: SelectDestinationAttractionFilter
    ): Promise<DestinationAttractionRecord[]> {
        try {
            log.info('listing attractions', 'listAttractions', filter);

            let query = rawSelect(
                db
                    .select()
                    .from(destinationAttractions)
                    .where(eq(destinationAttractions.destinationId, filter.destinationId))
            );

            if (filter.query) {
                const term = `%${filter.query}%`;
                query = query.where(
                    or(
                        ilike(destinationAttractions.name, term),
                        ilike(destinationAttractions.description, term)
                    )
                );
            }
            if (!filter.includeDeleted) {
                query = query.where(isNull(destinationAttractions.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(
                    destinationAttractions.createdAt,
                    'desc'
                )) as DestinationAttractionRecord[];

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
     * @param changes - Partial fields to update
     * @returns The updated attraction record
     */
    async updateAttraction(
        id: string,
        changes: UpdateDestinationAttractionData
    ): Promise<DestinationAttractionRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating attraction', 'updateAttraction', { id, changes: dataToUpdate });
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
