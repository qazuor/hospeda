import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, ilike, isNull, or } from 'drizzle-orm';
import type { BaseSelectFilter, UpdateData } from 'src/types/db.types';
import { db } from '../client';
import { destinations } from '../schema/destination.dbschema';
import { assertExists, castReturning, rawSelect, sanitizePartialUpdate } from '../utils/db-utils';

/**
 * Scoped logger for destination model operations.
 */
const log = logger.createLogger('DestinationModel');

/**
 * Full destination record as returned by the database.
 */
export type DestinationRecord = InferSelectModel<typeof destinations>;

/**
 * Data required to create a new destination.
 */
export type CreateDestinationData = InferInsertModel<typeof destinations>;

/**
 * Fields allowed for updating a destination.
 */
export type UpdateDestinationData = UpdateData<CreateDestinationData>;

/**
 * Filter options for listing destinations.
 */
export interface SelectDestinationFilter extends BaseSelectFilter {
    /** Filter by visibility */
    visibility?: string;
}

/**
 * DestinationModel provides CRUD operations for the destinations table.
 */
export const DestinationModel = {
    /**
     * Create a new destination record.
     *
     * @param data - Fields required to create the destination
     * @returns The created destination record
     */
    async createDestination(data: CreateDestinationData): Promise<DestinationRecord> {
        try {
            log.info('creating a new destination', 'createDestination', data);
            const rows = castReturning<DestinationRecord>(
                await db.insert(destinations).values(data).returning()
            );
            const dest = assertExists(rows[0], 'createDestination: no record returned');
            log.query('insert', 'destinations', data, dest);
            return dest;
        } catch (error) {
            log.error('createDestination failed', 'createDestination', error);
            throw error;
        }
    },

    /**
     * Fetch a single destination by ID.
     *
     * @param id - UUID of the destination
     * @returns The destination record or undefined if not found
     */
    async getDestinationById(id: string): Promise<DestinationRecord | undefined> {
        try {
            log.info('fetching destination by id', 'getDestinationById', { id });
            const [dest] = (await db
                .select()
                .from(destinations)
                .where(eq(destinations.id, id))
                .limit(1)) as DestinationRecord[];
            log.query('select', 'destinations', { id }, dest);
            return dest;
        } catch (error) {
            log.error('getDestinationById failed', 'getDestinationById', error);
            throw error;
        }
    },

    /**
     * List destinations with optional filters, pagination, and search.
     *
     * @param filter - Pagination and filtering options
     * @returns Array of destination records
     */
    async listDestinations(filter: SelectDestinationFilter): Promise<DestinationRecord[]> {
        try {
            log.info('listing destinations', 'listDestinations', filter);
            let query = rawSelect(db.select().from(destinations));

            if (filter.query) {
                const term = `%${filter.query}%`;
                query = query.where(
                    or(ilike(destinations.name, term), ilike(destinations.displayName, term))
                );
            }

            if (filter.visibility) {
                query = query.where(eq(destinations.visibility, filter.visibility));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(destinations.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(destinations.createdAt, 'desc')) as DestinationRecord[];

            log.query('select', 'destinations', filter, rows);
            return rows;
        } catch (error) {
            log.error('listDestinations failed', 'listDestinations', error);
            throw error;
        }
    },

    /**
     * Update fields on an existing destination.
     *
     * @param id - UUID of the destination to update
     * @param changes - Partial fields to update
     * @returns The updated destination record
     */
    async updateDestination(
        id: string,
        changes: UpdateDestinationData
    ): Promise<DestinationRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating destination', 'updateDestination', {
                id,
                dataToUpdate
            });
            const rows = castReturning<DestinationRecord>(
                await db
                    .update(destinations)
                    .set(dataToUpdate)
                    .where(eq(destinations.id, id))
                    .returning()
            );
            const updated = assertExists(
                rows[0],
                `updateDestination: no record found for id ${id}`
            );
            log.query('update', 'destinations', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateDestination failed', 'updateDestination', error);
            throw error;
        }
    },

    /**
     * Soft-delete a destination by setting the deletedAt timestamp.
     *
     * @param id - UUID of the destination
     */
    async softDeleteDestination(id: string): Promise<void> {
        try {
            log.info('soft deleting destination', 'softDeleteDestination', {
                id
            });
            await db
                .update(destinations)
                .set({ deletedAt: new Date() })
                .where(eq(destinations.id, id));
            log.query('update', 'destinations', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteDestination failed', 'softDeleteDestination', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted destination by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the destination
     */
    async restoreDestination(id: string): Promise<void> {
        try {
            log.info('restoring destination', 'restoreDestination', { id });
            await db.update(destinations).set({ deletedAt: null }).where(eq(destinations.id, id));
            log.query('update', 'destinations', { id }, { restored: true });
        } catch (error) {
            log.error('restoreDestination failed', 'restoreDestination', error);
            throw error;
        }
    },

    /**
     * Permanently delete a destination record from the database.
     *
     * @param id - UUID of the destination
     */
    async hardDeleteDestination(id: string): Promise<void> {
        try {
            log.info('hard deleting destination', 'hardDeleteDestination', {
                id
            });
            await db.delete(destinations).where(eq(destinations.id, id));
            log.query('delete', 'destinations', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteDestination failed', 'hardDeleteDestination', error);
            throw error;
        }
    }
};
