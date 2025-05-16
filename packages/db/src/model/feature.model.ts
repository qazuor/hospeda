import { logger } from '@repo/logger';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../client';
import { features } from '../schema/feature.dbschema';
import type { InsertFeature, SelectFeatureFilter, UpdateFeatureData } from '../types/db-types';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils';

/**
 * Scoped logger for feature model operations.
 */
const log = logger.createLogger('FeatureModel');

/**
 * Full feature record as returned by the database.
 */
export type FeatureRecord = InferSelectModel<typeof features>;

/**
 * FeatureModel provides CRUD operations for the features table.
 */
export const FeatureModel = {
    /**
     * Create a new feature.
     * @param data - The data for the new feature.
     * @returns The created feature record.
     */
    async createFeature(data: InsertFeature): Promise<FeatureRecord> {
        try {
            log.info('creating a new feature', 'createFeature', data);
            const rows = castReturning<FeatureRecord>(
                await db.insert(features).values(data).returning()
            );
            const feature = assertExists(rows[0], 'createFeature: no feature returned');
            log.query('insert', 'features', data, feature);
            return feature;
        } catch (error) {
            log.error('createFeature failed', 'createFeature', error);
            throw error;
        }
    },

    /**
     * Get a feature by ID.
     * @param id - The ID of the feature to retrieve.
     * @returns The feature record or undefined if not found.
     */
    async getFeatureById(id: string): Promise<FeatureRecord | undefined> {
        try {
            log.info('fetching feature by id', 'getFeatureById', { id });
            const [feature] = await db.select().from(features).where(eq(features.id, id)).limit(1);

            log.query('select', 'features', { id }, feature);
            return feature as FeatureRecord | undefined;
        } catch (error) {
            log.error('getFeatureById failed', 'getFeatureById', error);
            throw error;
        }
    },

    /**
     * List features with filtering, search, and pagination.
     * @param filter - Filter and pagination parameters.
     * @returns A list of features matching the criteria.
     */
    async listFeatures(filter: SelectFeatureFilter): Promise<FeatureRecord[]> {
        try {
            log.info('listing features', 'listFeatures', filter);
            let query = db.select().from(features).$dynamic();

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                query = query.where(
                    or(
                        ilike(features.name, term),
                        ilike(features.displayName, term),
                        ilike(features.description || '', term)
                    )
                );
            }

            if (typeof filter.isBuiltin === 'boolean') {
                query = query.where(eq(features.isBuiltin, filter.isBuiltin));
            }

            if (filter.state) {
                query = query.where(eq(features.state, filter.state));
            }

            if (filter.createdById) {
                query = query.where(eq(features.createdById, filter.createdById));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(features.deletedAt));
            }

            // Convert the features object to Record<string, PgColumn> to satisfy TypeScript
            // biome-ignore lint/suspicious/noExplicitAny: This type assertion is necessary for the getOrderByColumn function
            const schemaAsRecord = features as any;

            const orderByColumn = getOrderByColumn(
                schemaAsRecord,
                filter.orderBy,
                features.createdAt
            );

            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as FeatureRecord[];

            log.query('select', 'features', filter, rows);
            return rows;
        } catch (error) {
            log.error('listFeatures failed', 'listFeatures', error);
            throw error;
        }
    },

    /**
     * Update an existing feature.
     * @param id - The ID of the feature to update.
     * @param changes - The changes to apply to the feature.
     * @returns The updated feature record.
     */
    async updateFeature(id: string, changes: UpdateFeatureData): Promise<FeatureRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating feature', 'updateFeature', { id, changes: dataToUpdate });

            const rows = castReturning<FeatureRecord>(
                await db.update(features).set(dataToUpdate).where(eq(features.id, id)).returning()
            );

            const updated = assertExists(rows[0], `updateFeature: no feature found for id ${id}`);
            log.query('update', 'features', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateFeature failed', 'updateFeature', error);
            throw error;
        }
    },

    /**
     * Soft-delete a feature.
     * @param id - The ID of the feature to delete.
     */
    async softDeleteFeature(id: string): Promise<void> {
        try {
            log.info('soft deleting feature', 'softDeleteFeature', { id });
            await db.update(features).set({ deletedAt: new Date() }).where(eq(features.id, id));

            log.query('update', 'features', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteFeature failed', 'softDeleteFeature', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted feature.
     * @param id - The ID of the feature to restore.
     */
    async restoreFeature(id: string): Promise<void> {
        try {
            log.info('restoring feature', 'restoreFeature', { id });
            await db
                .update(features)
                .set({ deletedAt: null, deletedById: null })
                .where(eq(features.id, id));

            log.query('update', 'features', { id }, { restored: true });
        } catch (error) {
            log.error('restoreFeature failed', 'restoreFeature', error);
            throw error;
        }
    },

    /**
     * Hard-delete a feature (permanently remove from database).
     * @param id - The ID of the feature to delete permanently.
     */
    async hardDeleteFeature(id: string): Promise<void> {
        try {
            log.info('hard deleting feature', 'hardDeleteFeature', { id });
            await db.delete(features).where(eq(features.id, id));
            log.query('delete', 'features', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteFeature failed', 'hardDeleteFeature', error);
            throw error;
        }
    }
};
