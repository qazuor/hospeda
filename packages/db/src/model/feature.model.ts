import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { getDb } from '../client.js';
import { features } from '../schema/feature.dbschema.js';
import type { InsertFeature, SelectFeatureFilter, UpdateFeatureData } from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

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
            dbLogger.info(data, 'creating a new feature');
            const db = getDb();
            const rows = castReturning<FeatureRecord>(
                await db.insert(features).values(data).returning()
            );
            const feature = assertExists(rows[0], 'createFeature: no feature returned');
            dbLogger.query({ table: 'features', action: 'insert', params: data, result: feature });
            return feature;
        } catch (error) {
            dbLogger.error(error, 'createFeature failed');
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
            dbLogger.info({ id }, 'fetching feature by id');
            const db = getDb();
            const [feature] = await db.select().from(features).where(eq(features.id, id)).limit(1);

            dbLogger.query({
                table: 'features',
                action: 'select',
                params: { id },
                result: feature
            });
            return feature as FeatureRecord | undefined;
        } catch (error) {
            dbLogger.error(error, 'getFeatureById failed');
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
            dbLogger.info(filter, 'listing features');
            const db = getDb();
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

            dbLogger.query({ table: 'features', action: 'select', params: filter, result: rows });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listFeatures failed');
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
            dbLogger.info({ id, changes: dataToUpdate }, 'updating feature');
            const db = getDb();
            const rows = castReturning<FeatureRecord>(
                await db.update(features).set(dataToUpdate).where(eq(features.id, id)).returning()
            );

            const updated = assertExists(rows[0], `updateFeature: no feature found for id ${id}`);
            dbLogger.query({
                table: 'features',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateFeature failed');
            throw error;
        }
    },

    /**
     * Soft-delete a feature.
     * @param id - The ID of the feature to delete.
     */
    async softDeleteFeature(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'soft deleting feature');
            const db = getDb();
            await db.update(features).set({ deletedAt: new Date() }).where(eq(features.id, id));

            dbLogger.query({
                table: 'features',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteFeature failed');
            throw error;
        }
    },

    /**
     * Restore a soft-deleted feature.
     * @param id - The ID of the feature to restore.
     */
    async restoreFeature(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'restoring feature');
            const db = getDb();
            await db
                .update(features)
                .set({ deletedAt: null, deletedById: null })
                .where(eq(features.id, id));

            dbLogger.query({
                table: 'features',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreFeature failed');
            throw error;
        }
    },

    /**
     * Hard-delete a feature (permanently remove from database).
     * @param id - The ID of the feature to delete permanently.
     */
    async hardDeleteFeature(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'hard deleting feature');
            const db = getDb();
            await db.delete(features).where(eq(features.id, id));
            dbLogger.query({
                table: 'features',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteFeature failed');
            throw error;
        }
    }
};
