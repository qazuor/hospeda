import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { getDb } from '../client.js';
import { accommodations } from '../schema/accommodation.dbschema.js';
import type {
    InsertAccommodation,
    SelectAccommodationFilter,
    UpdateAccommodationData
} from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils.js';
import { dbLogger } from '../utils/logger.js';

/**
 * Full accommodation record as returned by the database.
 */
export type AccommodationRecord = InferSelectModel<typeof accommodations>;

/**
 * AccommodationModel provides CRUD operations for the accommodations table.
 */
export const AccommodationModel = {
    /**
     * Create a new accommodation record.
     *
     * @param data - Fields required to create the accommodation (InsertAccommodation type from db-types)
            typedDbLogger.query('insert', 'accommodations', data, acc);
     */
    async createAccommodation(data: InsertAccommodation): Promise<AccommodationRecord> {
        try {
            dbLogger.info(data, 'creating a new accommodation');
            const db = getDb();
            const rows = castReturning<AccommodationRecord>(
                await db.insert(accommodations).values(data).returning()
            );
            const acc = assertExists(rows[0], 'createAccommodation: no accommodation returned');
            dbLogger.query({
                table: 'accommodations',
                action: 'insert',
                params: data,
                result: acc
            });
            return acc;
        } catch (error) {
            dbLogger.error(error, 'createAccommodation failed');
            throw error;
        }
    },

    /**
     * Fetch a single accommodation by ID.
     *
     * @param id - UUID of the accommodation
     * @returns The accommodation record or undefined if not found
     */
    async getAccommodationById(id: string): Promise<AccommodationRecord | undefined> {
        try {
            dbLogger.info({ id }, 'fetching accommodation by id');
            const db = getDb();
            const [acc] = await db
                .select()
                .from(accommodations)
                .where(eq(accommodations.id, id))
                .limit(1);
            dbLogger.query({
                table: 'accommodations',
                action: 'select',
                params: { id },
                result: acc
            });
            return acc ? (acc as AccommodationRecord) : undefined;
        } catch (error) {
            dbLogger.error(error, 'getAccommodationById failed');
            throw error;
        }
    },

    /**
     * List accommodations with optional filters, pagination, and search.
     *
     * @param filter - Filtering and pagination options (SelectAccommodationFilter type from db-types)
     * @returns Array of accommodation records
     */
    async listAccommodations(filter: SelectAccommodationFilter): Promise<AccommodationRecord[]> {
        try {
            dbLogger.info(filter, 'listing accommodations');
            const db = getDb();
            let query = db.select().from(accommodations).$dynamic();

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                query = query.where(
                    or(
                        ilike(accommodations.name, term),
                        ilike(accommodations.displayName, term),
                        ilike(accommodations.description, term),
                        ilike(accommodations.slug, term)
                    )
                );
            }

            if (filter.type) {
                query = query.where(eq(accommodations.type, filter.type));
            }

            if (filter.destinationId) {
                query = query.where(eq(accommodations.destinationId, filter.destinationId));
            }

            if (filter.ownerId) {
                query = query.where(eq(accommodations.ownerId, filter.ownerId));
            }

            if (typeof filter.isFeatured === 'boolean') {
                query = query.where(eq(accommodations.isFeatured, filter.isFeatured));
            }

            if (filter.state) {
                query = query.where(eq(accommodations.state, filter.state));
            }

            if (filter.createdById) {
                query = query.where(eq(accommodations.createdById, filter.createdById));
            }
            if (filter.updatedById) {
                query = query.where(eq(accommodations.updatedById, filter.updatedById));
            }
            if (filter.deletedById) {
                query = query.where(eq(accommodations.deletedById, filter.deletedById));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(accommodations.deletedAt));
            }

            // Cast to a Record<string, PgColumn> to satisfy TypeScript
            // biome-ignore lint/suspicious/noExplicitAny: This type assertion is necessary for the getOrderByColumn function
            const schemaAsRecord = accommodations as any;

            // Use the getOrderByColumn utility
            const orderByColumn = getOrderByColumn(
                schemaAsRecord,
                filter.orderBy,
                accommodations.createdAt
            );
            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as AccommodationRecord[];

            dbLogger.query({
                table: 'accommodations',
                action: 'select',
                params: filter,
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listAccommodations failed');
            throw error;
        }
    },

    /**
     * Update fields on an existing accommodation.
     *
     * @param id - UUID of the accommodation to update
     * @param changes - Partial fields to update (UpdateAccommodationData type from db-types)
     * @returns The updated accommodation record
     */
    async updateAccommodation(
        id: string,
        changes: UpdateAccommodationData
    ): Promise<AccommodationRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            dbLogger.info(
                {
                    id,
                    changes: dataToUpdate
                },
                'updating accommodation'
            );
            const db = getDb();
            const rows = castReturning<AccommodationRecord>(
                await db
                    .update(accommodations)
                    .set(dataToUpdate)
                    .where(eq(accommodations.id, id))
                    .returning()
            );
            const updated = assertExists(
                rows[0],
                `updateAccommodation: no accommodation found for id ${id}`
            );
            dbLogger.query({
                table: 'accommodations',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateAccommodation failed');
            throw error;
        }
    },

    /**
     * Soft-delete an accommodation by setting the deletedAt timestamp.
     *
     * @param id - UUID of the accommodation
     */
    async softDeleteAccommodation(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'soft deleting accommodation');
            const db = getDb();
            await db
                .update(accommodations)
                .set({ deletedAt: new Date() })
                .where(eq(accommodations.id, id));
            dbLogger.query({
                table: 'accommodations',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteAccommodation failed');
            throw error;
        }
    },

    /**
     * Restore a soft-deleted accommodation by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the accommodation
     */
    async restoreAccommodation(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'restoring accommodation');
            const db = getDb();
            await db
                .update(accommodations)
                .set({ deletedAt: null })
                .where(eq(accommodations.id, id));
            dbLogger.query({
                table: 'accommodations',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreAccommodation failed');
            throw error;
        }
    },

    /**
     * Permanently delete an accommodation record from the database.
     *
     * @param id - UUID of the accommodation
     */
    async hardDeleteAccommodation(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'hard deleting accommodation');
            const db = getDb();
            await db.delete(accommodations).where(eq(accommodations.id, id));
            dbLogger.query({
                table: 'accommodations',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteAccommodation failed');
            throw error;
        }
    }
};
