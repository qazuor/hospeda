import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { getDb } from '../client.js';
import { destinations } from '../schema/destination.dbschema.js';
import type {
    InsertDestination,
    SelectDestinationFilter,
    UpdateDestinationData
} from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

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
            dbLogger.info(data, 'creating a new destination');
            const db = getDb();
            const rows = castReturning<DestinationRecord>(
                await db.insert(destinations).values(data).returning()
            );
            const dest = assertExists(rows[0], 'createDestination: no destination returned');
            dbLogger.query({
                table: 'destinations',
                action: 'insert',
                params: data,
                result: dest
            });
            return dest;
        } catch (error) {
            dbLogger.error(error, 'createDestination failed');
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
            dbLogger.info({ id }, 'fetching destination by id');
            const db = getDb();
            const [dest] = await db
                .select()
                .from(destinations)
                .where(eq(destinations.id, id))
                .limit(1);
            dbLogger.query({
                table: 'destinations',
                action: 'select',
                params: { id },
                result: dest
            });
            return dest ? (dest as DestinationRecord) : undefined;
        } catch (error) {
            dbLogger.error(error, 'getDestinationById failed');
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
            dbLogger.info(filter, 'listing destinations');
            const db = getDb();
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

            dbLogger.query({
                table: 'destinations',
                action: 'select',
                params: filter,
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listDestinations failed');
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
            dbLogger.info(
                {
                    id,
                    changes: dataToUpdate
                },
                'updating destination'
            );
            const db = getDb();
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
            dbLogger.query({
                table: 'destinations',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateDestination failed');
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
            dbLogger.info({ id }, 'soft deleting destination');
            const db = getDb();
            await db
                .update(destinations)
                .set({ deletedAt: new Date() })
                .where(eq(destinations.id, id));
            dbLogger.query({
                table: 'destinations',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteDestination failed');
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
            dbLogger.info({ id }, 'restoring destination');
            const db = getDb();
            await db.update(destinations).set({ deletedAt: null }).where(eq(destinations.id, id));
            dbLogger.query({
                table: 'destinations',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreDestination failed');
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
            dbLogger.info({ id }, 'hard deleting destination');
            const db = getDb();
            await db.delete(destinations).where(eq(destinations.id, id));
            dbLogger.query({
                table: 'destinations',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteDestination failed');
            throw error;
        }
    }
};
