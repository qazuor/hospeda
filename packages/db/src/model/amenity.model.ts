import { logger } from '@repo/logger';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../client';
import { amenities } from '../schema/amenity.dbschema';
import type { InsertAmenity, SelectAmenityFilter, UpdateAmenityData } from '../types/db-types';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils';

/**
 * Scoped logger for amenity model operations.
 */
const log = logger.createLogger('AmenityModel');

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
            log.info('creating a new amenity', 'createAmenity', data);
            const rows = castReturning<AmenityRecord>(
                await db.insert(amenities).values(data).returning()
            );
            const amenity = assertExists(rows[0], 'createAmenity: no amenity returned');
            log.query('insert', 'amenities', data, amenity);
            return amenity;
        } catch (error) {
            log.error('createAmenity failed', 'createAmenity', error);
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
            log.info('fetching amenity by id', 'getAmenityById', { id });
            const [amenity] = await db
                .select()
                .from(amenities)
                .where(eq(amenities.id, id))
                .limit(1);

            log.query('select', 'amenities', { id }, amenity);
            return amenity as AmenityRecord | undefined;
        } catch (error) {
            log.error('getAmenityById failed', 'getAmenityById', error);
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
            log.info('listing amenities', 'listAmenities', filter);
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

            log.query('select', 'amenities', filter, rows);
            return rows;
        } catch (error) {
            log.error('listAmenities failed', 'listAmenities', error);
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
            log.info('updating amenity', 'updateAmenity', { id, changes: dataToUpdate });

            const rows = castReturning<AmenityRecord>(
                await db.update(amenities).set(dataToUpdate).where(eq(amenities.id, id)).returning()
            );

            const updated = assertExists(rows[0], `updateAmenity: no amenity found for id ${id}`);
            log.query('update', 'amenities', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateAmenity failed', 'updateAmenity', error);
            throw error;
        }
    },

    /**
     * Soft-delete an amenity.
     * @param id - The ID of the amenity to delete.
     */
    async softDeleteAmenity(id: string): Promise<void> {
        try {
            log.info('soft deleting amenity', 'softDeleteAmenity', { id });
            await db.update(amenities).set({ deletedAt: new Date() }).where(eq(amenities.id, id));

            log.query('update', 'amenities', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteAmenity failed', 'softDeleteAmenity', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted amenity.
     * @param id - The ID of the amenity to restore.
     */
    async restoreAmenity(id: string): Promise<void> {
        try {
            log.info('restoring amenity', 'restoreAmenity', { id });
            await db
                .update(amenities)
                .set({ deletedAt: null, deletedById: null })
                .where(eq(amenities.id, id));

            log.query('update', 'amenities', { id }, { restored: true });
        } catch (error) {
            log.error('restoreAmenity failed', 'restoreAmenity', error);
            throw error;
        }
    },

    /**
     * Hard-delete an amenity (permanently remove from database).
     * @param id - The ID of the amenity to delete permanently.
     */
    async hardDeleteAmenity(id: string): Promise<void> {
        try {
            log.info('hard deleting amenity', 'hardDeleteAmenity', { id });
            await db.delete(amenities).where(eq(amenities.id, id));
            log.query('delete', 'amenities', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteAmenity failed', 'hardDeleteAmenity', error);
            throw error;
        }
    }
};
