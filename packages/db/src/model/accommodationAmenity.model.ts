import { getDb } from '@repo/db/client.js';
import { accommodationAmenities } from '@repo/db/schema/accommodation_amenity.dbschema.js';
import type {
    SelectAccommodationAmenityFilter,
    UpdateAccommodationAmenityData
} from '@repo/db/types/db-types.js';
import {
    assertExists,
    castReturning,
    rawSelect,
    sanitizePartialUpdate
} from '@repo/db/utils/db-utils.js';
import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { and, eq, isNull } from 'drizzle-orm';

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
            dbLogger.info(data, 'creating accommodation amenity relation');
            const db = getDb();
            const rows = castReturning<AccommodationAmenityRecord>(
                await db.insert(accommodationAmenities).values(data).returning()
            );
            const amenityRelation = assertExists(
                rows[0],
                'createAmenityRelation: no relation returned'
            );
            dbLogger.query({
                table: 'accommodation_amenities',
                action: 'insert',
                params: data,
                result: amenityRelation
            });
            return amenityRelation;
        } catch (error) {
            dbLogger.error(error, 'createAmenityRelation failed');
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
            dbLogger.info({ accommodationId, amenityId }, 'fetching amenity relation');
            const db = getDb();
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

            dbLogger.query({
                table: 'accommodation_amenities',
                action: 'select',
                params: { accommodationId, amenityId },
                result: relation
            });
            return relation as AccommodationAmenityRecord | undefined;
        } catch (error) {
            dbLogger.error(error, 'getAmenityRelation failed');
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
            dbLogger.info(filter, 'listing amenity relations');
            const db = getDb();
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

            dbLogger.query({
                table: 'accommodation_amenities',
                action: 'select',
                params: filter,
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listAmenityRelations failed');
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
            dbLogger.info(
                { accommodationId, amenityId, changes: dataToUpdate },
                'updating amenity relation'
            );
            const db = getDb();
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

            dbLogger.query({
                table: 'accommodation_amenities',
                action: 'update',
                params: {
                    accommodationId,
                    amenityId,
                    changes: dataToUpdate
                },
                result: updated
            });

            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateAmenityRelation failed');
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
            dbLogger.info({ accommodationId, amenityId }, 'soft deleting amenity relation');
            const db = getDb();
            await db
                .update(accommodationAmenities)
                .set({ deletedAt: new Date() })
                .where(
                    and(
                        eq(accommodationAmenities.accommodationId, accommodationId),
                        eq(accommodationAmenities.amenityId, amenityId)
                    )
                );

            dbLogger.query({
                table: 'accommodation_amenities',
                action: 'update',
                params: {
                    accommodationId,
                    amenityId
                },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteAmenityRelation failed');
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
            dbLogger.info({ accommodationId, amenityId }, 'restoring amenity relation');
            const db = getDb();
            await db
                .update(accommodationAmenities)
                .set({ deletedAt: null })
                .where(
                    and(
                        eq(accommodationAmenities.accommodationId, accommodationId),
                        eq(accommodationAmenities.amenityId, amenityId)
                    )
                );

            dbLogger.query({
                table: 'accommodation_amenities',
                action: 'update',
                params: {
                    accommodationId,
                    amenityId
                },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreAmenityRelation failed');
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
            dbLogger.info({ accommodationId, amenityId }, 'hard deleting amenity relation');
            const db = getDb();
            await db
                .delete(accommodationAmenities)
                .where(
                    and(
                        eq(accommodationAmenities.accommodationId, accommodationId),
                        eq(accommodationAmenities.amenityId, amenityId)
                    )
                );

            dbLogger.query({
                table: 'accommodation_amenities',
                action: 'delete',
                params: {
                    accommodationId,
                    amenityId
                },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteAmenityRelation failed');
            throw error;
        }
    },

    /**
     * Delete all amenity relations for a specific accommodation.
     * @param accommodationId - UUID of the accommodation
     */
    async deleteAllByAccommodation(accommodationId: string): Promise<void> {
        try {
            dbLogger.info(
                {
                    accommodationId
                },
                'deleting all amenity relations for accommodation'
            );
            const db = getDb();
            await db
                .delete(accommodationAmenities)
                .where(eq(accommodationAmenities.accommodationId, accommodationId));

            dbLogger.query({
                table: 'accommodation_amenities',
                action: 'delete',
                params: {
                    accommodationId
                },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'deleteAllByAccommodation failed');
            throw error;
        }
    }
};
