import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { getDb } from '../client.js';
import { amenities } from '../schema/amenity.dbschema.js';
import type { InsertAmenity, SelectAmenityFilter, UpdateAmenityData } from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

/**
 * Full amenity record as returned by the database.
 */
export type AmenityRecord = InferSelectModel<typeof amenities>;

/**
 * AmenityModel provides CRUD operations for the amenities table.
 */
export const AmenityModel = {
    /**
     * Create a new amenity.
     * @param data - The data for the new amenity.
     * @returns The created amenity record.
     */
    async createAmenity(data: InsertAmenity): Promise<AmenityRecord> {
        try {
            dbLogger.info(data, 'creating a new amenity');
            const db = getDb();
            const rows = castReturning<AmenityRecord>(
                await db.insert(amenities).values(data).returning()
            );
            const amenity = assertExists(rows[0], 'createAmenity: no amenity returned');
            dbLogger.query({
                table: 'amenities',
                action: 'insert',
                params: data,
                result: amenity
            });
            return amenity;
        } catch (error) {
            dbLogger.error(error, 'createAmenity failed');
            throw error;
        }
    },

    /**
     * Get an amenity by ID.
     * @param id - The ID of the amenity to retrieve.
     * @returns The amenity record or undefined if not found.
     */
    async getAmenityById(id: string): Promise<AmenityRecord | undefined> {
        try {
            dbLogger.info({ id }, 'fetching amenity by id');
            const db = getDb();
            const [amenity] = await db
                .select()
                .from(amenities)
                .where(eq(amenities.id, id))
                .limit(1);

            dbLogger.query({
                table: 'amenities',
                action: 'select',
                params: { id },
                result: amenity
            });
            return amenity as AmenityRecord | undefined;
        } catch (error) {
            dbLogger.error(error, 'getAmenityById failed');
            throw error;
        }
    },

    /**
     * List amenities with filtering, search, and pagination.
     * @param filter - Filter and pagination parameters.
     * @returns A list of amenities matching the criteria.
     */
    async listAmenities(filter: SelectAmenityFilter): Promise<AmenityRecord[]> {
        try {
            dbLogger.info(filter, 'listing amenities');
            const db = getDb();
            let query = db.select().from(amenities).$dynamic();

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                query = query.where(
                    or(
                        ilike(amenities.name, term),
                        ilike(amenities.displayName, term),
                        ilike(amenities.description || '', term)
                    )
                );
            }

            if (filter.type) {
                query = query.where(eq(amenities.type, filter.type));
            }

            if (typeof filter.isBuiltin === 'boolean') {
                query = query.where(eq(amenities.isBuiltin, filter.isBuiltin));
            }

            if (filter.state) {
                query = query.where(eq(amenities.state, filter.state));
            }

            if (filter.createdById) {
                query = query.where(eq(amenities.createdById, filter.createdById));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(amenities.deletedAt));
            }

            // Convert the amenities object to Record<string, PgColumn> to satisfy TypeScript
            // biome-ignore lint/suspicious/noExplicitAny: This type assertion is necessary for the getOrderByColumn function
            const schemaAsRecord = amenities as any;

            const orderByColumn = getOrderByColumn(
                schemaAsRecord,
                filter.orderBy,
                amenities.createdAt
            );

            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as AmenityRecord[];

            dbLogger.query({
                table: 'amenities',
                action: 'select',
                params: filter,
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listAmenities failed');
            throw error;
        }
    },

    /**
     * Update an existing amenity.
     * @param id - The ID of the amenity to update.
     * @param changes - The changes to apply to the amenity.
     * @returns The updated amenity record.
     */
    async updateAmenity(id: string, changes: UpdateAmenityData): Promise<AmenityRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            dbLogger.info({ id, changes: dataToUpdate }, 'updating amenity');
            const db = getDb();
            const rows = castReturning<AmenityRecord>(
                await db.update(amenities).set(dataToUpdate).where(eq(amenities.id, id)).returning()
            );

            const updated = assertExists(rows[0], `updateAmenity: no amenity found for id ${id}`);
            dbLogger.query({
                table: 'amenities',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateAmenity failed');
            throw error;
        }
    },

    /**
     * Soft-delete an amenity.
     * @param id - The ID of the amenity to delete.
     */
    async softDeleteAmenity(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'soft deleting amenity');
            const db = getDb();
            await db.update(amenities).set({ deletedAt: new Date() }).where(eq(amenities.id, id));

            dbLogger.query({
                table: 'amenities',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteAmenity failed');
            throw error;
        }
    },

    /**
     * Restore a soft-deleted amenity.
     * @param id - The ID of the amenity to restore.
     */
    async restoreAmenity(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'restoring amenity');
            const db = getDb();
            await db
                .update(amenities)
                .set({ deletedAt: null, deletedById: null })
                .where(eq(amenities.id, id));

            dbLogger.query({
                table: 'amenities',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreAmenity failed');
            throw error;
        }
    },

    /**
     * Hard-delete an amenity (permanently remove from database).
     * @param id - The ID of the amenity to delete permanently.
     */
    async hardDeleteAmenity(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'hard deleting amenity');
            const db = getDb();
            await db.delete(amenities).where(eq(amenities.id, id));
            dbLogger.query({
                table: 'amenities',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteAmenity failed');
            throw error;
        }
    }
};
