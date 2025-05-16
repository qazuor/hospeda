import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../client';
import { accommodationAmenities } from '../schema/accommodation_amenity.dbschema';
import type {
    SelectAccommodationAmenityFilter,
    UpdateAccommodationAmenityData
} from '../types/db-types';
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
 * AccommodationAmenityModel provides CRUD operations for the accommodation_amenities table.
 */
export const AccommodationAmenityModel = {
    /**
     * Create a new accommodation amenity relation.
     * @param data - Fields required to create the amenity relation
     * @returns The created amenity relation record
     */
    async createAmenityRelation(
        data: CreateAccommodationAmenityData
    ): Promise<AccommodationAmenityRecord> {
        try {
            log.info('creating accommodation amenity relation', 'createAmenityRelation', data);
            const rows = castReturning<AccommodationAmenityRecord>(
                await db.insert(accommodationAmenities).values(data).returning()
            );
            const amenityRelation = assertExists(
                rows[0],
                'createAmenityRelation: no relation returned'
            );
            log.query('insert', 'accommodation_amenities', data, amenityRelation);
            return amenityRelation;
        } catch (error) {
            log.error('createAmenityRelation failed', 'createAmenityRelation', error);
            throw error;
        }
    },

    /**
     * Fetch a single amenity relation by accommodation ID and amenity ID.
     * @param accommodationId - UUID of the accommodation
     * @param amenityId - UUID of the amenity
     * @returns The amenity relation record or undefined if not found
     */
    async getAmenityRelation(
        accommodationId: string,
        amenityId: string
    ): Promise<AccommodationAmenityRecord | undefined> {
        try {
            log.info('fetching amenity relation', 'getAmenityRelation', {
                accommodationId,
                amenityId
            });
            const [relation] = await db
                .select()
                .from(accommodationAmenities)
                .where(
                    and(
                        eq(accommodationAmenities.accommodationId, accommodationId),
                        eq(accommodationAmenities.amenityId, amenityId)
                    )
                )
                .limit(1);

            log.query(
                'select',
                'accommodation_amenities',
                { accommodationId, amenityId },
                relation
            );
            return relation as AccommodationAmenityRecord | undefined;
        } catch (error) {
            log.error('getAmenityRelation failed', 'getAmenityRelation', error);
            throw error;
        }
    },

    /**
     * List amenities for a given accommodation.
     * @param filter - Filtering and pagination options
     * @returns Array of amenity relation records
     */
    async listAmenityRelations(
        filter: SelectAccommodationAmenityFilter
    ): Promise<AccommodationAmenityRecord[]> {
        try {
            log.info('listing amenity relations', 'listAmenityRelations', filter);

            let query = rawSelect(db.select().from(accommodationAmenities));

            if (filter.accommodationId) {
                query = query.where(
                    eq(accommodationAmenities.accommodationId, filter.accommodationId)
                );
            }

            if (filter.amenityId) {
                query = query.where(eq(accommodationAmenities.amenityId, filter.amenityId));
            }

            if (typeof filter.isOptional === 'boolean') {
                query = query.where(eq(accommodationAmenities.isOptional, filter.isOptional));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(accommodationAmenities.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as AccommodationAmenityRecord[];

            log.query('select', 'accommodation_amenities', filter, rows);
            return rows;
        } catch (error) {
            log.error('listAmenityRelations failed', 'listAmenityRelations', error);
            throw error;
        }
    },

    /**
     * Update fields on an existing amenity relation.
     * @param accommodationId - UUID of the accommodation
     * @param amenityId - UUID of the amenity
     * @param changes - Partial fields to update
     * @returns The updated amenity relation record
     */
    async updateAmenityRelation(
        accommodationId: string,
        amenityId: string,
        changes: UpdateAccommodationAmenityData
    ): Promise<AccommodationAmenityRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating amenity relation', 'updateAmenityRelation', {
                accommodationId,
                amenityId,
                changes: dataToUpdate
            });

            const rows = castReturning<AccommodationAmenityRecord>(
                await db
                    .update(accommodationAmenities)
                    .set(dataToUpdate)
                    .where(
                        and(
                            eq(accommodationAmenities.accommodationId, accommodationId),
                            eq(accommodationAmenities.amenityId, amenityId)
                        )
                    )
                    .returning()
            );

            const updated = assertExists(
                rows[0],
                `updateAmenityRelation: no relation found for accommodationId ${accommodationId} and amenityId ${amenityId}`
            );

            log.query(
                'update',
                'accommodation_amenities',
                {
                    accommodationId,
                    amenityId,
                    changes: dataToUpdate
                },
                updated
            );

            return updated;
        } catch (error) {
            log.error('updateAmenityRelation failed', 'updateAmenityRelation', error);
            throw error;
        }
    },

    /**
     * Soft-delete an amenity relation by setting the deletedAt timestamp.
     * @param accommodationId - UUID of the accommodation
     * @param amenityId - UUID of the amenity
     */
    async softDeleteAmenityRelation(accommodationId: string, amenityId: string): Promise<void> {
        try {
            log.info('soft deleting amenity relation', 'softDeleteAmenityRelation', {
                accommodationId,
                amenityId
            });

            await db
                .update(accommodationAmenities)
                .set({ deletedAt: new Date() })
                .where(
                    and(
                        eq(accommodationAmenities.accommodationId, accommodationId),
                        eq(accommodationAmenities.amenityId, amenityId)
                    )
                );

            log.query(
                'update',
                'accommodation_amenities',
                {
                    accommodationId,
                    amenityId
                },
                { deleted: true }
            );
        } catch (error) {
            log.error('softDeleteAmenityRelation failed', 'softDeleteAmenityRelation', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted amenity relation by clearing the deletedAt timestamp.
     * @param accommodationId - UUID of the accommodation
     * @param amenityId - UUID of the amenity
     */
    async restoreAmenityRelation(accommodationId: string, amenityId: string): Promise<void> {
        try {
            log.info('restoring amenity relation', 'restoreAmenityRelation', {
                accommodationId,
                amenityId
            });

            await db
                .update(accommodationAmenities)
                .set({ deletedAt: null })
                .where(
                    and(
                        eq(accommodationAmenities.accommodationId, accommodationId),
                        eq(accommodationAmenities.amenityId, amenityId)
                    )
                );

            log.query(
                'update',
                'accommodation_amenities',
                {
                    accommodationId,
                    amenityId
                },
                { restored: true }
            );
        } catch (error) {
            log.error('restoreAmenityRelation failed', 'restoreAmenityRelation', error);
            throw error;
        }
    },

    /**
     * Permanently delete an amenity relation record from the database.
     * @param accommodationId - UUID of the accommodation
     * @param amenityId - UUID of the amenity
     */
    async hardDeleteAmenityRelation(accommodationId: string, amenityId: string): Promise<void> {
        try {
            log.info('hard deleting amenity relation', 'hardDeleteAmenityRelation', {
                accommodationId,
                amenityId
            });

            await db
                .delete(accommodationAmenities)
                .where(
                    and(
                        eq(accommodationAmenities.accommodationId, accommodationId),
                        eq(accommodationAmenities.amenityId, amenityId)
                    )
                );

            log.query(
                'delete',
                'accommodation_amenities',
                {
                    accommodationId,
                    amenityId
                },
                { deleted: true }
            );
        } catch (error) {
            log.error('hardDeleteAmenityRelation failed', 'hardDeleteAmenityRelation', error);
            throw error;
        }
    },

    /**
     * Delete all amenity relations for a specific accommodation.
     * @param accommodationId - UUID of the accommodation
     */
    async deleteAllByAccommodation(accommodationId: string): Promise<void> {
        try {
            log.info(
                'deleting all amenity relations for accommodation',
                'deleteAllByAccommodation',
                {
                    accommodationId
                }
            );

            await db
                .delete(accommodationAmenities)
                .where(eq(accommodationAmenities.accommodationId, accommodationId));

            log.query(
                'delete',
                'accommodation_amenities',
                {
                    accommodationId
                },
                { deleted: true }
            );
        } catch (error) {
            log.error('deleteAllByAccommodation failed', 'deleteAllByAccommodation', error);
            throw error;
        }
    }
};
