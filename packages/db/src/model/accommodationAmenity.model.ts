import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, ilike, isNull } from 'drizzle-orm';
import type { BaseSelectFilter, UpdateData } from 'src/types/db.types';
import { db } from '../client';
import { accommodationAmenities } from '../schema/accommodation_amenity.dbschema';
import { assertExists, castReturning, rawSelect, sanitizePartialUpdate } from '../utils/db-utils';

/**
 * Scoped logger for AccommodationAmenityModel operations.
 */
const log = logger.createLogger('AccommodationAmenityModel');

/**
 * Full accommodation amenity record as returned by the database.
 */
export type AccommodationAmenityRecord = InferSelectModel<typeof accommodationAmenities>;

/**
 * Data required to create a new accommodation amenity.
 */
export type CreateAccommodationAmenityData = InferInsertModel<typeof accommodationAmenities>;

/**
 * Fields allowed for updating an accommodation amenity.
 */
export type UpdateAccommodationAmenityData = UpdateData<CreateAccommodationAmenityData>;

/**
 * Filter options for listing amenities.
 */
export interface SelectAccommodationAmenityFilter extends BaseSelectFilter {
    /** ID of the accommodation */
    accommodationId: string;
    /** Optional fuzzy search on description */
    query?: string;
    /** Include soft-deleted if true */
    includeDeleted?: boolean;
}

/**
 * AccommodationAmenityModel provides CRUD operations for the accommodation_amenities table.
 */
export const AccommodationAmenityModel = {
    /**
     * Create a new accommodation amenity.
     *
     * @param data - Fields required to create the amenity
     * @returns The created amenity record
     */
    async createAmenity(data: CreateAccommodationAmenityData): Promise<AccommodationAmenityRecord> {
        try {
            log.info('creating accommodation amenity', 'createAmenity', data);
            const rows = castReturning<AccommodationAmenityRecord>(
                await db.insert(accommodationAmenities).values(data).returning()
            );
            const amenity = assertExists(rows[0], 'createAmenity: no amenity returned');
            log.query('insert', 'accommodation_amenities', data, amenity);
            return amenity;
        } catch (error) {
            log.error('createAmenity failed', 'createAmenity', error);
            throw error;
        }
    },

    /**
     * Fetch a single amenity by ID.
     *
     * @param id - UUID of the amenity
     * @returns The amenity record or undefined if not found
     */
    async getAmenityById(id: string): Promise<AccommodationAmenityRecord | undefined> {
        try {
            log.info('fetching amenity by id', 'getAmenityById', { id });
            const [amenity] = (await db
                .select()
                .from(accommodationAmenities)
                .where(eq(accommodationAmenities.id, id))
                .limit(1)) as AccommodationAmenityRecord[];
            log.query('select', 'accommodation_amenities', { id }, amenity);
            return amenity;
        } catch (error) {
            log.error('getAmenityById failed', 'getAmenityById', error);
            throw error;
        }
    },

    /**
     * List amenities for a given accommodation.
     *
     * @param filter - Filtering and pagination options
     * @returns Array of amenity records
     */
    async listAmenities(
        filter: SelectAccommodationAmenityFilter
    ): Promise<AccommodationAmenityRecord[]> {
        try {
            log.info('listing amenities', 'listAmenities', filter);

            let query = rawSelect(
                db
                    .select()
                    .from(accommodationAmenities)
                    .where(eq(accommodationAmenities.accommodationId, filter.accommodationId))
            );

            if (filter.query) {
                const term = `%${filter.query}%`;
                query = query.where(ilike(accommodationAmenities.description, term));
            }
            if (!filter.includeDeleted) {
                query = query.where(isNull(accommodationAmenities.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(accommodationAmenities.createdAt, 'desc')) as AccommodationAmenityRecord[];

            log.query('select', 'accommodation_amenities', filter, rows);
            return rows;
        } catch (error) {
            log.error('listAmenities failed', 'listAmenities', error);
            throw error;
        }
    },

    /**
     * Update fields on an existing amenity.
     *
     * @param id - UUID of the amenity to update
     * @param changes - Partial fields to update
     * @returns The updated amenity record
     */
    async updateAmenity(
        id: string,
        changes: UpdateAccommodationAmenityData
    ): Promise<AccommodationAmenityRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating amenity', 'updateAmenity', { id, changes: dataToUpdate });
            const rows = castReturning<AccommodationAmenityRecord>(
                await db
                    .update(accommodationAmenities)
                    .set(dataToUpdate)
                    .where(eq(accommodationAmenities.id, id))
                    .returning()
            );
            const updated = assertExists(rows[0], `updateAmenity: no amenity found for id ${id}`);
            log.query('update', 'accommodation_amenities', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateAmenity failed', 'updateAmenity', error);
            throw error;
        }
    },

    /**
     * Soft-delete an amenity by setting the deletedAt timestamp.
     *
     * @param id - UUID of the amenity
     */
    async softDeleteAmenity(id: string): Promise<void> {
        try {
            log.info('soft deleting amenity', 'softDeleteAmenity', { id });
            await db
                .update(accommodationAmenities)
                .set({ deletedAt: new Date() })
                .where(eq(accommodationAmenities.id, id));
            log.query('update', 'accommodation_amenities', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteAmenity failed', 'softDeleteAmenity', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted amenity by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the amenity
     */
    async restoreAmenity(id: string): Promise<void> {
        try {
            log.info('restoring amenity', 'restoreAmenity', { id });
            await db
                .update(accommodationAmenities)
                .set({ deletedAt: null })
                .where(eq(accommodationAmenities.id, id));
            log.query('update', 'accommodation_amenities', { id }, { restored: true });
        } catch (error) {
            log.error('restoreAmenity failed', 'restoreAmenity', error);
            throw error;
        }
    },

    /**
     * Permanently delete an amenity record from the database.
     *
     * @param id - UUID of the amenity
     */
    async hardDeleteAmenity(id: string): Promise<void> {
        try {
            log.info('hard deleting amenity', 'hardDeleteAmenity', { id });
            await db.delete(accommodationAmenities).where(eq(accommodationAmenities.id, id));
            log.query('delete', 'accommodation_amenities', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteAmenity failed', 'hardDeleteAmenity', error);
            throw error;
        }
    }
};
