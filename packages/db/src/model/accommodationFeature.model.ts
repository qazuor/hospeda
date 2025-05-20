import { logger } from '@repo/logger';
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
 * Scoped logger for AccommodationFeatureModel operations.
 */
const log = logger.createLogger('AccommodationFeatureModel');

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
            log.info('creating accommodation feature relation', 'createFeatureRelation', data);
            const db = getDb();
            const rows = castReturning<AccommodationFeatureRecord>(
                await db.insert(accommodationFeatures).values(data).returning()
            );
            const featureRelation = assertExists(
                rows[0],
                'createFeatureRelation: no relation returned'
            );
            log.query('insert', 'accommodation_features', data, featureRelation);
            return featureRelation;
        } catch (error) {
            log.error('createFeatureRelation failed', 'createFeatureRelation', error);
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
            log.info('fetching feature relation', 'getFeatureRelation', {
                accommodationId,
                featureId
            });
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

            log.query('select', 'accommodation_features', { accommodationId, featureId }, relation);
            return relation as AccommodationFeatureRecord | undefined;
        } catch (error) {
            log.error('getFeatureRelation failed', 'getFeatureRelation', error);
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
            log.info('listing feature relations', 'listFeatureRelations', filter);
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

            log.query('select', 'accommodation_features', filter, rows);
            return rows;
        } catch (error) {
            log.error('listFeatureRelations failed', 'listFeatureRelations', error);
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
            log.info('updating feature relation', 'updateFeatureRelation', {
                accommodationId,
                featureId,
                changes: dataToUpdate
            });
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

            log.query(
                'update',
                'accommodation_features',
                {
                    accommodationId,
                    featureId,
                    changes: dataToUpdate
                },
                updated
            );

            return updated;
        } catch (error) {
            log.error('updateFeatureRelation failed', 'updateFeatureRelation', error);
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
            log.info('soft deleting feature relation', 'softDeleteFeatureRelation', {
                accommodationId,
                featureId
            });
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

            log.query(
                'update',
                'accommodation_features',
                {
                    accommodationId,
                    featureId
                },
                { deleted: true }
            );
        } catch (error) {
            log.error('softDeleteFeatureRelation failed', 'softDeleteFeatureRelation', error);
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
            log.info('restoring feature relation', 'restoreFeatureRelation', {
                accommodationId,
                featureId
            });
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

            log.query(
                'update',
                'accommodation_features',
                {
                    accommodationId,
                    featureId
                },
                { restored: true }
            );
        } catch (error) {
            log.error('restoreFeatureRelation failed', 'restoreFeatureRelation', error);
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
            log.info('hard deleting feature relation', 'hardDeleteFeatureRelation', {
                accommodationId,
                featureId
            });
            const db = getDb();
            await db
                .delete(accommodationFeatures)
                .where(
                    and(
                        eq(accommodationFeatures.accommodationId, accommodationId),
                        eq(accommodationFeatures.featureId, featureId)
                    )
                );

            log.query(
                'delete',
                'accommodation_features',
                {
                    accommodationId,
                    featureId
                },
                { deleted: true }
            );
        } catch (error) {
            log.error('hardDeleteFeatureRelation failed', 'hardDeleteFeatureRelation', error);
            throw error;
        }
    },

    /**
     * Delete all feature relations for a specific accommodation.
     * @param accommodationId - UUID of the accommodation
     */
    async deleteAllByAccommodation(accommodationId: string): Promise<void> {
        try {
            log.info(
                'deleting all feature relations for accommodation',
                'deleteAllByAccommodation',
                {
                    accommodationId
                }
            );
            const db = getDb();
            await db
                .delete(accommodationFeatures)
                .where(eq(accommodationFeatures.accommodationId, accommodationId));

            log.query(
                'delete',
                'accommodation_features',
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
