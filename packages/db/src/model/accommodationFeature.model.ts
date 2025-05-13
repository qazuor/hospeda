import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, ilike, isNull } from 'drizzle-orm';
import type { BaseSelectFilter, UpdateData } from 'src/types/db.types';
import { db } from '../client';
import { accommodationFeatures } from '../schema/accommodation_feature.dbschema';
import { assertExists, castReturning, rawSelect, sanitizePartialUpdate } from '../utils/db-utils';

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
 * Fields allowed for updating an accommodation feature.
 */
export type UpdateAccommodationFeatureData = UpdateData<CreateAccommodationFeatureData>;

/**
 * Filter options for listing features.
 */
export interface SelectAccommodationFeatureFilter extends BaseSelectFilter {
    /** ID of the accommodation */
    accommodationId: string;
    /** Optional fuzzy search on description */
    query?: string;
    /** Include soft-deleted if true */
    includeDeleted?: boolean;
}

/**
 * AccommodationFeatureModel provides CRUD operations for the accommodation_features table.
 */
export const AccommodationFeatureModel = {
    /**
     * Create a new accommodation feature.
     *
     * @param data - Fields required to create the feature
     * @returns The created feature record
     */
    async createFeature(data: CreateAccommodationFeatureData): Promise<AccommodationFeatureRecord> {
        try {
            log.info('creating accommodation feature', 'createFeature', data);
            const rows = castReturning<AccommodationFeatureRecord>(
                await db.insert(accommodationFeatures).values(data).returning()
            );
            const feature = assertExists(rows[0], 'createFeature: no feature returned');
            log.query('insert', 'accommodation_features', data, feature);
            return feature;
        } catch (error) {
            log.error('createFeature failed', 'createFeature', error);
            throw error;
        }
    },

    /**
     * Fetch a single feature by ID.
     *
     * @param id - UUID of the feature
     * @returns The feature record or undefined if not found
     */
    async getFeatureById(id: string): Promise<AccommodationFeatureRecord | undefined> {
        try {
            log.info('fetching feature by id', 'getFeatureById', { id });
            const [feature] = (await db
                .select()
                .from(accommodationFeatures)
                .where(eq(accommodationFeatures.id, id))
                .limit(1)) as AccommodationFeatureRecord[];
            log.query('select', 'accommodation_features', { id }, feature);
            return feature;
        } catch (error) {
            log.error('getFeatureById failed', 'getFeatureById', error);
            throw error;
        }
    },

    /**
     * List features for a given accommodation.
     *
     * @param filter - Filtering and pagination options
     * @returns Array of feature records
     */
    async listFeatures(
        filter: SelectAccommodationFeatureFilter
    ): Promise<AccommodationFeatureRecord[]> {
        try {
            log.info('listing features', 'listFeatures', filter);

            let query = rawSelect(
                db
                    .select()
                    .from(accommodationFeatures)
                    .where(eq(accommodationFeatures.accommodationId, filter.accommodationId))
            );

            if (filter.query) {
                const term = `%${filter.query}%`;
                query = query.where(ilike(accommodationFeatures.description, term));
            }
            if (!filter.includeDeleted) {
                query = query.where(isNull(accommodationFeatures.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(accommodationFeatures.createdAt, 'desc')) as AccommodationFeatureRecord[];

            log.query('select', 'accommodation_features', filter, rows);
            return rows;
        } catch (error) {
            log.error('listFeatures failed', 'listFeatures', error);
            throw error;
        }
    },

    /**
     * Update fields on an existing feature.
     *
     * @param id - UUID of the feature to update
     * @param changes - Partial fields to update
     * @returns The updated feature record
     */
    async updateFeature(
        id: string,
        changes: UpdateAccommodationFeatureData
    ): Promise<AccommodationFeatureRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating feature', 'updateFeature', { id, changes: dataToUpdate });
            const rows = castReturning<AccommodationFeatureRecord>(
                await db
                    .update(accommodationFeatures)
                    .set(dataToUpdate)
                    .where(eq(accommodationFeatures.id, id))
                    .returning()
            );
            const updated = assertExists(rows[0], `updateFeature: no feature found for id ${id}`);
            log.query('update', 'accommodation_features', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateFeature failed', 'updateFeature', error);
            throw error;
        }
    },

    /**
     * Soft-delete a feature by setting the deletedAt timestamp.
     *
     * @param id - UUID of the feature
     */
    async softDeleteFeature(id: string): Promise<void> {
        try {
            log.info('soft deleting feature', 'softDeleteFeature', { id });
            await db
                .update(accommodationFeatures)
                .set({ deletedAt: new Date() })
                .where(eq(accommodationFeatures.id, id));
            log.query('update', 'accommodation_features', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteFeature failed', 'softDeleteFeature', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted feature by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the feature
     */
    async restoreFeature(id: string): Promise<void> {
        try {
            log.info('restoring feature', 'restoreFeature', { id });
            await db
                .update(accommodationFeatures)
                .set({ deletedAt: null })
                .where(eq(accommodationFeatures.id, id));
            log.query('update', 'accommodation_features', { id }, { restored: true });
        } catch (error) {
            log.error('restoreFeature failed', 'restoreFeature', error);
            throw error;
        }
    },

    /**
     * Permanently delete a feature record from the database.
     *
     * @param id - UUID of the feature
     */
    async hardDeleteFeature(id: string): Promise<void> {
        try {
            log.info('hard deleting feature', 'hardDeleteFeature', { id });
            await db.delete(accommodationFeatures).where(eq(accommodationFeatures.id, id));
            log.query('delete', 'accommodation_features', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteFeature failed', 'hardDeleteFeature', error);
            throw error;
        }
    }
};
