import type {
    AccommodationType,
    FeatureType,
    NewFeatureInputType,
    UpdateFeatureInputType
} from '@repo/types';
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { features } from '../../dbschemas/accommodation/feature.dbschema.ts';
import { rAccommodationFeature } from '../../dbschemas/accommodation/r_accommodation_feature.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for FeatureModel
 */
const featureOrderable = createOrderableColumnsAndMapping(['name', 'isBuiltin'] as const, features);

export const FEATURE_ORDERABLE_COLUMNS = featureOrderable.columns;
export type FeatureOrderByColumn = typeof featureOrderable.type;
const featureOrderableColumns = featureOrderable.mapping;

export type FeaturePaginationParams = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: FeatureOrderByColumn;
};

export type FeatureSearchParams = FeaturePaginationParams & {
    q?: string;
    name?: string;
    isBuiltin?: boolean;
    lifecycle?: string;
};

export type FeatureRelations = {
    accommodations?: true;
};

export type FeatureRelationResult<T extends FeatureRelations> = {
    accommodations: T['accommodations'] extends true ? AccommodationType[] : never;
};

export type FeatureWithRelationsType = FeatureType & {
    accommodations?: AccommodationType[];
};

export const FeatureModel = {
    /**
     * Get a feature by its unique ID.
     *
     * @param id - Feature ID
     * @returns FeatureType if found, otherwise undefined
     * @throws Error if the query fails
     */
    async getById(id: string): Promise<FeatureType | undefined> {
        const db = getDb();
        try {
            const result = await db.select().from(features).where(eq(features.id, id)).limit(1);
            dbLogger.query({ table: 'features', action: 'getById', params: { id }, result });
            return result[0] as FeatureType | undefined;
        } catch (error) {
            dbLogger.error(error, 'FeatureModel.getById');
            throw new Error(`Failed to get feature by id: ${(error as Error).message}`);
        }
    },
    /**
     * Get a feature by its unique name.
     *
     * @param name - Feature name
     * @returns FeatureType if found, otherwise undefined
     * @throws Error if the query fails
     */
    async getByName(name: string): Promise<FeatureType | undefined> {
        const db = getDb();
        try {
            const result = await db.select().from(features).where(eq(features.name, name)).limit(1);
            dbLogger.query({ table: 'features', action: 'getByName', params: { name }, result });
            return result[0] as FeatureType | undefined;
        } catch (error) {
            dbLogger.error(error, 'FeatureModel.getByName');
            throw new Error(`Failed to get feature by name: ${(error as Error).message}`);
        }
    },
    /**
     * Get all features by type. (Currently returns an empty array; extend as needed.)
     *
     * @returns Array of FeatureType
     * @throws Error if the query fails
     */
    async getByType(): Promise<FeatureType[]> {
        try {
            dbLogger.query({
                table: 'features',
                action: 'getByType',
                params: {},
                result: []
            });
            return [];
        } catch (error) {
            dbLogger.error(error, 'FeatureModel.getByType');
            throw new Error(`Failed to get features by type: ${(error as Error).message}`);
        }
    },
    /**
     * Get all features for a given accommodation.
     *
     * @param accommodationId - Accommodation ID
     * @returns Array of FeatureType
     * @throws Error if the query fails
     */
    async getByAccommodation(accommodationId: string): Promise<FeatureType[]> {
        const db = getDb();
        try {
            const result = await db
                .select({ features, rAccommodationFeature })
                .from(features)
                .innerJoin(
                    rAccommodationFeature,
                    and(
                        eq(rAccommodationFeature.featureId, features.id),
                        eq(rAccommodationFeature.accommodationId, accommodationId)
                    )
                );
            dbLogger.query({
                table: 'features',
                action: 'getByAccommodation',
                params: { accommodationId },
                result
            });
            if (!Array.isArray(result)) return [];
            return result.map((row) => row.features as FeatureType);
        } catch (error) {
            dbLogger.error(error, 'FeatureModel.getByAccommodation');
            throw new Error(`Failed to get features by accommodation: ${(error as Error).message}`);
        }
    },
    /**
     * Create a new feature.
     *
     * @param input - New feature input
     * @returns The created FeatureType
     * @throws Error if the insert fails
     */
    async create(input: NewFeatureInputType): Promise<FeatureType> {
        const db = getDb();
        try {
            const result = await db.insert(features).values(input).returning();
            const created = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'features',
                action: 'create',
                params: { input },
                result: created
            });
            if (!created) throw new Error('Insert failed');
            return created as FeatureType;
        } catch (error) {
            dbLogger.error(error, 'FeatureModel.create');
            throw new Error(`Failed to create feature: ${(error as Error).message}`);
        }
    },
    /**
     * Update a feature by ID.
     *
     * @param id - Feature ID
     * @param input - Update input
     * @returns Updated FeatureType if found, otherwise undefined
     * @throws Error if the update fails
     */
    async update(id: string, input: UpdateFeatureInputType): Promise<FeatureType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .update(features)
                .set(input)
                .where(eq(features.id, id))
                .returning();
            const updated = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'features',
                action: 'update',
                params: { id, input },
                result: updated
            });
            return updated as FeatureType | undefined;
        } catch (error) {
            dbLogger.error(error, 'FeatureModel.update');
            throw new Error(`Failed to update feature: ${(error as Error).message}`);
        }
    },
    /**
     * Soft delete a feature by ID.
     *
     * @param id - Feature ID
     * @param deletedById - User ID who deletes
     * @returns Object with deleted feature id if found, otherwise undefined
     * @throws Error if the delete fails
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .update(features)
                .set({ deletedAt: now, deletedById })
                .where(eq(features.id, id))
                .returning({ id: features.id });
            const deleted = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'features',
                action: 'delete',
                params: { id, deletedById },
                result: deleted
            });
            return deleted as { id: string } | undefined;
        } catch (error) {
            dbLogger.error(error, 'FeatureModel.delete');
            throw new Error(`Failed to delete feature: ${(error as Error).message}`);
        }
    },
    /**
     * Hard delete a feature by ID.
     *
     * @param id - Feature ID
     * @returns True if deleted, false otherwise
     * @throws Error if the delete fails
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db.delete(features).where(eq(features.id, id)).returning();
            const deleted = Array.isArray(result) ? result.length > 0 : false;
            dbLogger.query({
                table: 'features',
                action: 'hardDelete',
                params: { id },
                result: deleted
            });
            return deleted;
        } catch (error) {
            dbLogger.error(error, 'FeatureModel.hardDelete');
            throw new Error(`Failed to hard delete feature: ${(error as Error).message}`);
        }
    },
    /**
     * List features with pagination and optional ordering.
     *
     * @param params - Pagination and ordering parameters
     * @returns Array of FeatureType
     * @throws Error if the query fails
     */
    async list(params: FeaturePaginationParams): Promise<FeatureType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(featureOrderableColumns, orderBy, features.name);
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(features)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'features', action: 'list', params, result });
            return result as FeatureType[];
        } catch (error) {
            dbLogger.error(error, 'FeatureModel.list');
            throw new Error(`Failed to list features: ${(error as Error).message}`);
        }
    },
    /**
     * Search features by name, isBuiltin, lifecycle, etc.
     *
     * @param params - Search and pagination parameters
     * @returns Array of FeatureType
     * @throws Error if the query fails
     */
    async search(params: FeatureSearchParams): Promise<FeatureType[]> {
        const db = getDb();
        const { q, name, isBuiltin, lifecycle, limit, offset, order, orderBy } = params;
        try {
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(features.name, prepareLikeQuery(q)));
            }
            if (name) {
                whereClauses.push(ilike(features.name, prepareLikeQuery(name)));
            }
            if (typeof isBuiltin === 'boolean') {
                whereClauses.push(eq(features.isBuiltin, isBuiltin));
            }
            if (lifecycle) {
                whereClauses.push(eq(features.lifecycle, lifecycle));
            }
            const col = getOrderableColumn(featureOrderableColumns, orderBy, features.name);
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const queryBuilder = db.select().from(features);
            const queryWithWhere =
                whereClauses.length > 0 ? queryBuilder.where(and(...whereClauses)) : queryBuilder;
            const finalQuery = queryWithWhere.orderBy(orderExpr).limit(limit).offset(offset);
            const result = await finalQuery;
            dbLogger.query({ table: 'features', action: 'search', params, result });
            return result as FeatureType[];
        } catch (error) {
            dbLogger.error(error, 'FeatureModel.search');
            throw new Error(`Failed to search features: ${(error as Error).message}`);
        }
    },
    /**
     * Count features with optional filters.
     *
     * @param params - Search parameters
     * @returns Number of features matching the query
     * @throws Error if the query fails
     */
    async count(params?: FeatureSearchParams): Promise<number> {
        const db = getDb();
        try {
            const { name, isBuiltin, lifecycle, q } = params || {};
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(features.name, prepareLikeQuery(q)));
            }
            if (name) {
                whereClauses.push(ilike(features.name, prepareLikeQuery(name)));
            }
            if (typeof isBuiltin === 'boolean') {
                whereClauses.push(eq(features.isBuiltin, isBuiltin));
            }
            if (lifecycle) {
                whereClauses.push(eq(features.lifecycle, lifecycle));
            }
            const query = db.select({ count: count().as('count') }).from(features);
            const finalQuery = whereClauses.length > 0 ? query.where(and(...whereClauses)) : query;
            const result = await finalQuery;
            dbLogger.query({ table: 'features', action: 'count', params, result });
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            dbLogger.error(error, 'FeatureModel.count');
            throw new Error(`Failed to count features: ${(error as Error).message}`);
        }
    },
    /**
     * Get a feature by ID, including specified relations.
     *
     * @param id - Feature ID
     * @param withRelations - Relations to include (accommodations)
     * @returns FeatureType with relations if found, otherwise undefined
     * @throws Error if the query fails
     */
    async getWithRelations<T extends FeatureRelations>(
        id: string,
        withRelations: T
    ): Promise<(FeatureWithRelationsType & FeatureRelationResult<T>) | undefined> {
        const db = getDb();
        try {
            const result = await db.query.features.findFirst({
                where: (f, { eq }) => eq(f.id, id),
                with: withRelations as Record<string, true>
            });
            dbLogger.query({
                table: 'features',
                action: 'getWithRelations',
                params: { id, with: withRelations },
                result
            });
            return result as (FeatureWithRelationsType & FeatureRelationResult<T>) | undefined;
        } catch (error) {
            dbLogger.error(error, 'FeatureModel.getWithRelations');
            throw new Error(`Failed to get feature with relations: ${(error as Error).message}`);
        }
    }
};
