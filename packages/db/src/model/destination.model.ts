import { logger } from '@repo/logger';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../client';
import { destinations } from '../schema/destination.dbschema';
import type {
    InsertDestination,
    SelectDestinationFilter,
    UpdateDestinationData
} from '../types/db-types';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils';

/**
 * Scoped logger for destination model operations.
 */
const log = logger.createLogger('DestinationModel');

/**
 * Full destination record as returned by the database.
 */
export type DestinationRecord = InferSelectModel<typeof destinations>;

/**
 * DestinationModel provides CRUD operations for the destinations table.
 */
export const DestinationModel = {
    /**
     * Create a new destination record.
     *
     * @param data - Fields required to create the destination (InsertDestination type from db-types)
     * @returns The created destination record
     */
    async createDestination(data: InsertDestination): Promise<DestinationRecord> {
        try {
            log.info('creating a new destination', 'createDestination', data);
            const rows = castReturning<DestinationRecord>(
                await db.insert(destinations).values(data).returning()
            );
            const dest = assertExists(rows[0], 'createDestination: no destination returned');
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
            const [dest] = await db
                .select()
                .from(destinations)
                .where(eq(destinations.id, id))
                .limit(1);
            log.query('select', 'destinations', { id }, dest);
            return dest ? (dest as DestinationRecord) : undefined;
        } catch (error) {
            log.error('getDestinationById failed', 'getDestinationById', error);
            throw error;
        }
    },

    /**
     * List destinations with optional filters, pagination, and search.
     *
     * @param filter - Filtering and pagination options (SelectDestinationFilter type from db-types)
     * @returns Array of destination records
     */
    async listDestinations(filter: SelectDestinationFilter): Promise<DestinationRecord[]> {
        try {
            log.info('listing destinations', 'listDestinations', filter);
            let query = db.select().from(destinations).$dynamic();

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                query = query.where(
                    or(
                        ilike(destinations.name, term),
                        ilike(destinations.displayName, term),
                        ilike(destinations.summary, term),
                        ilike(destinations.description, term),
                        ilike(destinations.slug, term)
                    )
                );
            }

            if (typeof filter.isFeatured === 'boolean') {
                query = query.where(eq(destinations.isFeatured, filter.isFeatured));
            }

            if (filter.visibility) {
                query = query.where(eq(destinations.visibility, filter.visibility));
            }

            if (filter.state) {
                query = query.where(eq(destinations.state, filter.state));
            }

            if (filter.createdById) {
                query = query.where(eq(destinations.createdById, filter.createdById));
            }
            if (filter.updatedById) {
                query = query.where(eq(destinations.updatedById, filter.updatedById));
            }
            if (filter.deletedById) {
                query = query.where(eq(destinations.deletedById, filter.deletedById));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(destinations.deletedAt));
            }

            // Use the getOrderByColumn utility
            const orderByColumn = getOrderByColumn(
                destinations,
                filter.orderBy,
                destinations.createdAt
            );
            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as DestinationRecord[];

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
     * @param changes - Partial fields to update (UpdateDestinationData type from db-types)
     * @returns The updated destination record
     */
    async updateDestination(
        id: string,
        changes: UpdateDestinationData
    ): Promise<DestinationRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating destination', 'updateDestination', { id, changes: dataToUpdate });
            const rows = castReturning<DestinationRecord>(
                await db
                    .update(destinations)
                    .set(dataToUpdate)
                    .where(eq(destinations.id, id))
                    .returning()
            );
            const updated = assertExists(
                rows[0],
                `updateDestination: no destination found for id ${id}`
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
            log.info('soft deleting destination', 'softDeleteDestination', { id });
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
            log.info('hard deleting destination', 'hardDeleteDestination', { id });
            await db.delete(destinations).where(eq(destinations.id, id));
            log.query('delete', 'destinations', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteDestination failed', 'hardDeleteDestination', error);
            throw error;
        }
    }
};
