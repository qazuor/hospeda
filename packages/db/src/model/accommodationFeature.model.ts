import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../client.js';
import { accommodationFeatures } from '../schema/accommodation_feature.dbschema.js';
import type { SelectAccommodationFeatureFilter } from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    rawSelect,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

/**
 * Full accommodation feature record as returned by the database.
 */
export type AccommodationFeatureRecord = InferSelectModel<typeof accommodationFeatures>;

/**
 * Data required to create a new accommodation feature.
 */
export type CreateAccommodationFeatureData = InferInsertModel<typeof accommodationFeatures>;

/**
 * AccommodationFeatureModel provides CRUD operations for the accommodation_features table.
 */
export const AccommodationFeatureModel = {
    /**
     * Create a new accommodation feature relation.
     * @param data - Fields required to create the feature relation
     * @returns The created feature relation record
     */
    async createFeatureRelation(
        data: CreateAccommodationFeatureData
    ): Promise<AccommodationFeatureRecord> {
        try {
            dbLogger.info(data, 'creating accommodation feature relation');
            const db = getDb();
            const rows = castReturning<AccommodationFeatureRecord>(
                await db.insert(accommodationFeatures).values(data).returning()
            );
            const featureRelation = assertExists(
                rows[0],
                'createFeatureRelation: no relation returned'
            );
            dbLogger.query({
                table: 'accommodation_features',
                action: 'insert',
                params: data,
                result: featureRelation
            });
            return featureRelation;
        } catch (error) {
            dbLogger.error(error, 'createFeatureRelation failed');
            throw error;
        }
    },

    /**
     * Fetch a single feature relation by accommodation ID and feature ID.
     * @param accommodationId - UUID of the accommodation
     * @param featureId - UUID of the feature
     * @returns The feature relation record or undefined if not found
     */
    async getFeatureRelation(
        accommodationId: string,
        featureId: string
    ): Promise<AccommodationFeatureRecord | undefined> {
        try {
            dbLogger.info({ accommodationId, featureId }, 'fetching feature relation');
            const db = getDb();
            const [relation] = await db
                .select()
                .from(accommodationFeatures)
                .where(
                    and(
                        eq(accommodationFeatures.accommodationId, accommodationId),
                        eq(accommodationFeatures.featureId, featureId)
                    )
                )
                .limit(1);

            dbLogger.query({
                table: 'accommodation_features',
                action: 'select',
                params: { accommodationId, featureId },
                result: relation
            });
            return relation as AccommodationFeatureRecord | undefined;
        } catch (error) {
            dbLogger.error(error, 'getFeatureRelation failed');
            throw error;
        }
    },

    /**
     * List features for a given accommodation.
     * @param filter - Filtering and pagination options
     * @returns Array of feature relation records
     */
    async listFeatureRelations(
        filter: SelectAccommodationFeatureFilter
    ): Promise<AccommodationFeatureRecord[]> {
        try {
            dbLogger.info(filter, 'listing feature relations');
            const db = getDb();
            let query = rawSelect(db.select().from(accommodationFeatures));

            if (filter.accommodationId) {
                query = query.where(
                    eq(accommodationFeatures.accommodationId, filter.accommodationId)
                );
            }

            if (filter.featureId) {
                query = query.where(eq(accommodationFeatures.featureId, filter.featureId));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(accommodationFeatures.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as AccommodationFeatureRecord[];

            dbLogger.query({
                table: 'accommodation_features',
                action: 'select',
                params: filter,
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listFeatureRelations failed');
            throw error;
        }
    },

    /**
     * Update fields on an existing feature relation.
     * @param accommodationId - UUID of the accommodation
     * @param featureId - UUID of the feature
     * @param changes - Partial fields to update
     * @returns The updated feature relation record
     */
    async updateFeatureRelation(
        accommodationId: string,
        featureId: string,
        changes: Partial<CreateAccommodationFeatureData>
    ): Promise<AccommodationFeatureRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            dbLogger.info(
                { accommodationId, featureId, changes: dataToUpdate },
                'updating feature relation'
            );
            const db = getDb();
            const rows = castReturning<AccommodationFeatureRecord>(
                await db
                    .update(accommodationFeatures)
                    .set(dataToUpdate)
                    .where(
                        and(
                            eq(accommodationFeatures.accommodationId, accommodationId),
                            eq(accommodationFeatures.featureId, featureId)
                        )
                    )
                    .returning()
            );

            const updated = assertExists(
                rows[0],
                `updateFeatureRelation: no relation found for accommodationId ${accommodationId} and featureId ${featureId}`
            );

            dbLogger.query({
                table: 'accommodation_features',
                action: 'update',
                params: { accommodationId, featureId, changes: dataToUpdate },
                result: updated
            });

            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateFeatureRelation failed');
            throw error;
        }
    },

    /**
     * Soft-delete a feature relation by setting the deletedAt timestamp.
     * @param accommodationId - UUID of the accommodation
     * @param featureId - UUID of the feature
     */
    async softDeleteFeatureRelation(accommodationId: string, featureId: string): Promise<void> {
        try {
            dbLogger.info({ accommodationId, featureId }, 'soft deleting feature relation');
            const db = getDb();
            await db
                .update(accommodationFeatures)
                .set({ deletedAt: new Date() })
                .where(
                    and(
                        eq(accommodationFeatures.accommodationId, accommodationId),
                        eq(accommodationFeatures.featureId, featureId)
                    )
                );

            dbLogger.query({
                table: 'accommodation_features',
                action: 'update',
                params: { accommodationId, featureId },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteFeatureRelation failed');
            throw error;
        }
    },

    /**
     * Restore a soft-deleted feature relation by clearing the deletedAt timestamp.
     * @param accommodationId - UUID of the accommodation
     * @param featureId - UUID of the feature
     */
    async restoreFeatureRelation(accommodationId: string, featureId: string): Promise<void> {
        try {
            dbLogger.info({ accommodationId, featureId }, 'restoring feature relation');
            const db = getDb();
            await db
                .update(accommodationFeatures)
                .set({ deletedAt: null })
                .where(
                    and(
                        eq(accommodationFeatures.accommodationId, accommodationId),
                        eq(accommodationFeatures.featureId, featureId)
                    )
                );

            dbLogger.query({
                table: 'accommodation_features',
                action: 'update',
                params: { accommodationId, featureId },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreFeatureRelation failed');
            throw error;
        }
    },

    /**
     * Permanently delete a feature relation record from the database.
     * @param accommodationId - UUID of the accommodation
     * @param featureId - UUID of the feature
     */
    async hardDeleteFeatureRelation(accommodationId: string, featureId: string): Promise<void> {
        try {
            dbLogger.info({ accommodationId, featureId }, 'hard deleting feature relation');
            const db = getDb();
            await db
                .delete(accommodationFeatures)
                .where(
                    and(
                        eq(accommodationFeatures.accommodationId, accommodationId),
                        eq(accommodationFeatures.featureId, featureId)
                    )
                );

            dbLogger.query({
                table: 'accommodation_features',
                action: 'delete',
                params: { accommodationId, featureId },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteFeatureRelation failed');
            throw error;
        }
    },

    /**
     * Delete all feature relations for a specific accommodation.
     * @param accommodationId - UUID of the accommodation
     */
    async deleteAllByAccommodation(accommodationId: string): Promise<void> {
        try {
            dbLogger.info({ accommodationId }, 'deleting all feature relations for accommodation');
            const db = getDb();
            await db
                .delete(accommodationFeatures)
                .where(eq(accommodationFeatures.accommodationId, accommodationId));

            dbLogger.query({
                table: 'accommodation_features',
                action: 'delete',
                params: { accommodationId },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'deleteAllByAccommodation failed');
            throw error;
        }
    }
};
