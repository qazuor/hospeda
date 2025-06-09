import type {
    AttractionType,
    DestinationAttractionType,
    NewAttractionInputType,
    UpdateAttractionInputType
} from '@repo/types';
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { attractions } from '../../dbschemas/destination/attraction.dbschema.ts';
import { rDestinationAttraction } from '../../dbschemas/destination/r_destination_attraction.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for AttractionModel
 * Columns: name, isBuiltin, lifecycle, createdAt
 */
const attractionOrderable = createOrderableColumnsAndMapping(
    ['name', 'isBuiltin', 'lifecycle', 'createdAt'] as const,
    attractions
);

export const ATTRACTION_ORDERABLE_COLUMNS = attractionOrderable.columns;
export type AttractionOrderByColumn = typeof attractionOrderable.type;
const attractionOrderableColumns = attractionOrderable.mapping;

export type AttractionPaginationParams = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: AttractionOrderByColumn;
};

export type AttractionSearchParams = AttractionPaginationParams & {
    q?: string;
    name?: string;
    isBuiltin?: boolean;
    lifecycle?: string;
};

export type AttractionRelations = {
    destinations?: true;
};

export type AttractionRelationResult<T extends AttractionRelations> = {
    destinations: T['destinations'] extends true ? DestinationAttractionType[] : never;
};

export type AttractionWithRelationsType = AttractionType & {
    destinations?: DestinationAttractionType[];
};

export const AttractionModel = {
    /**
     * Get an attraction by its unique ID.
     *
     * @param id - Attraction ID
     * @returns AttractionType if found, otherwise undefined
     * @throws Error if the query fails
     */
    async getById(id: string): Promise<AttractionType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(attractions)
                .where(eq(attractions.id, id))
                .limit(1);
            dbLogger.query({ table: 'attractions', action: 'getById', params: { id }, result });
            return result[0] as AttractionType | undefined;
        } catch (error) {
            dbLogger.error(error, 'AttractionModel.getById');
            throw new Error(`Failed to get attraction by id: ${(error as Error).message}`);
        }
    },

    /**
     * Get an attraction by its unique name.
     *
     * @param name - Attraction name
     * @returns AttractionType if found, otherwise undefined
     * @throws Error if the query fails
     */
    async getByName(name: string): Promise<AttractionType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(attractions)
                .where(eq(attractions.name, name))
                .limit(1);
            dbLogger.query({
                table: 'attractions',
                action: 'getByName',
                params: { name },
                result
            });
            return result[0] as AttractionType | undefined;
        } catch (error) {
            dbLogger.error(error, 'AttractionModel.getByName');
            throw new Error(`Failed to get attraction by name: ${(error as Error).message}`);
        }
    },

    /**
     * Get an attraction by its unique slug.
     *
     * @param slug - Attraction slug
     * @returns AttractionType if found, otherwise undefined
     * @throws Error if the query fails
     */
    async getBySlug(slug: string): Promise<AttractionType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(attractions)
                .where(eq(attractions.slug, slug))
                .limit(1);
            dbLogger.query({
                table: 'attractions',
                action: 'getBySlug',
                params: { slug },
                result
            });
            return result[0] as AttractionType | undefined;
        } catch (error) {
            dbLogger.error(error, 'AttractionModel.getBySlug');
            throw new Error(`Failed to get attraction by slug: ${(error as Error).message}`);
        }
    },

    /**
     * Get attractions by isBuiltin flag.
     *
     * @param isBuiltin - Whether the attraction is builtin
     * @returns Array of AttractionType
     * @throws Error if the query fails
     */
    async getByType(isBuiltin: boolean): Promise<AttractionType[]> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(attractions)
                .where(eq(attractions.isBuiltin, isBuiltin));
            dbLogger.query({
                table: 'attractions',
                action: 'getByType',
                params: { isBuiltin },
                result
            });
            return result as AttractionType[];
        } catch (error) {
            dbLogger.error(error, 'AttractionModel.getByType');
            throw new Error(`Failed to get attractions by type: ${(error as Error).message}`);
        }
    },

    /**
     * Create a new attraction.
     *
     * @param input - New attraction input
     * @returns The created AttractionType
     * @throws Error if the insert fails
     */
    async create(input: NewAttractionInputType): Promise<AttractionType> {
        const db = getDb();
        try {
            const result = await db.insert(attractions).values(input).returning();
            const created = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'attractions',
                action: 'create',
                params: { input },
                result: created
            });
            if (!created) throw new Error('Insert failed');
            return created as AttractionType;
        } catch (error) {
            dbLogger.error(error, 'AttractionModel.create');
            throw new Error(`Failed to create attraction: ${(error as Error).message}`);
        }
    },

    /**
     * Update an attraction by ID.
     *
     * @param id - Attraction ID
     * @param input - Update input
     * @returns Updated AttractionType if found, otherwise undefined
     * @throws Error if the update fails
     */
    async update(
        id: string,
        input: UpdateAttractionInputType
    ): Promise<AttractionType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .update(attractions)
                .set(input)
                .where(eq(attractions.id, id))
                .returning();
            const updated = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'attractions',
                action: 'update',
                params: { id, input },
                result: updated
            });
            return updated as AttractionType | undefined;
        } catch (error) {
            dbLogger.error(error, 'AttractionModel.update');
            throw new Error(`Failed to update attraction: ${(error as Error).message}`);
        }
    },

    /**
     * Soft delete an attraction by ID.
     *
     * @param id - Attraction ID
     * @param deletedById - User ID who deletes
     * @returns Object with deleted attraction id if found, otherwise undefined
     * @throws Error if the delete fails
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .update(attractions)
                .set({ deletedAt: now, deletedById })
                .where(eq(attractions.id, id))
                .returning({ id: attractions.id });
            const deleted = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'attractions',
                action: 'delete',
                params: { id, deletedById },
                result: deleted
            });
            return deleted as { id: string } | undefined;
        } catch (error) {
            dbLogger.error(error, 'AttractionModel.delete');
            throw new Error(`Failed to delete attraction: ${(error as Error).message}`);
        }
    },

    /**
     * Hard delete an attraction by ID.
     *
     * @param id - Attraction ID
     * @returns True if deleted, false otherwise
     * @throws Error if the delete fails
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db.delete(attractions).where(eq(attractions.id, id)).returning();
            const deleted = Array.isArray(result) ? result.length > 0 : false;
            dbLogger.query({
                table: 'attractions',
                action: 'hardDelete',
                params: { id },
                result: deleted
            });
            return deleted;
        } catch (error) {
            dbLogger.error(error, 'AttractionModel.hardDelete');
            throw new Error(`Failed to hard delete attraction: ${(error as Error).message}`);
        }
    },

    /**
     * List attractions with pagination and optional ordering.
     *
     * @param params - Pagination and ordering parameters
     * @returns Array of AttractionType
     * @throws Error if the query fails
     */
    async list(params: AttractionPaginationParams): Promise<AttractionType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(
                attractionOrderableColumns,
                orderBy,
                attractions.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(attractions)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'attractions', action: 'list', params, result });
            return result as AttractionType[];
        } catch (error) {
            dbLogger.error(error, 'AttractionModel.list');
            throw new Error(`Failed to list attractions: ${(error as Error).message}`);
        }
    },

    /**
     * Search attractions by name, isBuiltin, lifecycle, etc.
     *
     * @param params - Search and pagination parameters
     * @returns Array of AttractionType
     * @throws Error if the query fails
     */
    async search(params: AttractionSearchParams): Promise<AttractionType[]> {
        const db = getDb();
        const { q, name, isBuiltin, lifecycle, limit, offset, order, orderBy } = params;
        try {
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(attractions.name, prepareLikeQuery(q)));
            }
            if (name) {
                whereClauses.push(ilike(attractions.name, prepareLikeQuery(name)));
            }
            if (typeof isBuiltin === 'boolean') {
                whereClauses.push(eq(attractions.isBuiltin, isBuiltin));
            }
            if (lifecycle) {
                whereClauses.push(eq(attractions.lifecycle, lifecycle));
            }
            const col = getOrderableColumn(
                attractionOrderableColumns,
                orderBy,
                attractions.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(attractions)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'attractions', action: 'search', params, result });
            return result as AttractionType[];
        } catch (error) {
            dbLogger.error(error, 'AttractionModel.search');
            throw new Error(`Failed to search attractions: ${(error as Error).message}`);
        }
    },

    /**
     * Count attractions with optional filters.
     *
     * @param params - Search parameters
     * @returns Number of attractions matching the query
     * @throws Error if the query fails
     */
    async count(params?: AttractionSearchParams): Promise<number> {
        const db = getDb();
        try {
            const { name, isBuiltin, lifecycle, q } = params || {};
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(attractions.name, prepareLikeQuery(q)));
            }
            if (name) {
                whereClauses.push(ilike(attractions.name, prepareLikeQuery(name)));
            }
            if (typeof isBuiltin === 'boolean') {
                whereClauses.push(eq(attractions.isBuiltin, isBuiltin));
            }
            if (lifecycle) {
                whereClauses.push(eq(attractions.lifecycle, lifecycle));
            }
            const result = await db
                .select({ count: count().as('count') })
                .from(attractions)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);
            dbLogger.query({ table: 'attractions', action: 'count', params, result });
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            dbLogger.error(error, 'AttractionModel.count');
            throw new Error(`Failed to count attractions: ${(error as Error).message}`);
        }
    },

    /**
     * Get an attraction by ID, including specified relations.
     *
     * @template T
     * @param id - Attraction ID
     * @param withRelations - Relations to include (destinations)
     * @returns AttractionType with relations if found, otherwise undefined
     * @throws Error if the query fails
     */
    async getWithRelations<T extends AttractionRelations>(
        id: string,
        withRelations: T
    ): Promise<(AttractionWithRelationsType & AttractionRelationResult<T>) | undefined> {
        const db = getDb();
        try {
            const result = await db.query.attractions.findFirst({
                where: (a, { eq }) => eq(a.id, id),
                with: withRelations as Record<string, true>
            });
            dbLogger.query({
                table: 'attractions',
                action: 'getWithRelations',
                params: { id, with: withRelations },
                result
            });
            return result as
                | (AttractionWithRelationsType & AttractionRelationResult<T>)
                | undefined;
        } catch (error) {
            dbLogger.error(error, 'AttractionModel.getWithRelations');
            throw new Error(`Failed to get attraction with relations: ${(error as Error).message}`);
        }
    },

    /**
     * Get attractions by destination.
     *
     * @param destinationId - Destination ID
     * @returns Array of AttractionType
     * @throws Error if the query fails
     */
    async getByDestination(destinationId: string): Promise<AttractionType[]> {
        const db = getDb();
        try {
            const result = await db
                .select({ attractions, rDestinationAttraction })
                .from(attractions)
                .innerJoin(
                    rDestinationAttraction,
                    and(
                        eq(rDestinationAttraction.attractionId, attractions.id),
                        eq(rDestinationAttraction.destinationId, destinationId)
                    )
                );
            dbLogger.query({
                table: 'attractions',
                action: 'getByDestination',
                params: { destinationId },
                result
            });
            return result.map((row) => row.attractions as AttractionType);
        } catch (error) {
            dbLogger.error(error, 'AttractionModel.getByDestination');
            throw new Error(
                `Failed to get attractions by destination: ${(error as Error).message}`
            );
        }
    }
};
