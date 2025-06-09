import type {
    AccommodationIaDataType,
    NewAccommodationIaDataInputType,
    UpdateAccommodationIaDataInputType
} from '@repo/types';
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { accommodationIaData } from '../../dbschemas/accommodation/accommodation_iaData.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for AccommodationIaDataModel
 * Columns: title, createdAt
 */
const iaDataOrderable = createOrderableColumnsAndMapping(
    ['title', 'createdAt'] as const,
    accommodationIaData
);

export const IA_DATA_ORDERABLE_COLUMNS = iaDataOrderable.columns;
export type IaDataOrderByColumn = typeof iaDataOrderable.type;
const iaDataOrderableColumns = iaDataOrderable.mapping;

export type IaDataPaginationParams = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: IaDataOrderByColumn;
};

export type IaDataSearchParams = IaDataPaginationParams & {
    q?: string;
    title?: string;
    category?: string;
    lifecycle?: string;
};

export const AccommodationIaDataModel = {
    /**
     * Get IA data by its unique ID.
     *
     * @param id - IA data ID
     * @returns AccommodationIaDataType if found, otherwise undefined
     * @throws Error if the query fails
     */
    async getById(id: string): Promise<AccommodationIaDataType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(accommodationIaData)
                .where(eq(accommodationIaData.id, id))
                .limit(1);
            dbLogger.query({
                table: 'accommodation_ia_data',
                action: 'getById',
                params: { id },
                result
            });
            return result[0] as AccommodationIaDataType | undefined;
        } catch (error) {
            dbLogger.error(error, 'AccommodationIaDataModel.getById');
            throw new Error(
                `Failed to get accommodation IA data by id: ${(error as Error).message}`
            );
        }
    },

    /**
     * Get IA data by accommodation ID.
     *
     * @param accommodationId - Accommodation ID
     * @returns Array of AccommodationIaDataType
     * @throws Error if the query fails
     */
    async getByAccommodation(accommodationId: string): Promise<AccommodationIaDataType[]> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(accommodationIaData)
                .where(eq(accommodationIaData.accommodationId, accommodationId));
            dbLogger.query({
                table: 'accommodation_ia_data',
                action: 'getByAccommodation',
                params: { accommodationId },
                result
            });
            return result as AccommodationIaDataType[];
        } catch (error) {
            dbLogger.error(error, 'AccommodationIaDataModel.getByAccommodation');
            throw new Error(
                `Failed to get accommodation IA data by accommodation: ${(error as Error).message}`
            );
        }
    },

    /**
     * Create a new IA data entry.
     *
     * @param input - New IA data input
     * @returns The created AccommodationIaDataType
     * @throws Error if the insert fails
     */
    async create(input: NewAccommodationIaDataInputType): Promise<AccommodationIaDataType> {
        const db = getDb();
        try {
            const result = await db.insert(accommodationIaData).values(input).returning();
            const created = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'accommodation_ia_data',
                action: 'create',
                params: { input },
                result: created
            });
            if (!created) throw new Error('Insert failed');
            return created as AccommodationIaDataType;
        } catch (error) {
            dbLogger.error(error, 'AccommodationIaDataModel.create');
            throw new Error(`Failed to create accommodation IA data: ${(error as Error).message}`);
        }
    },

    /**
     * Update an IA data entry by ID.
     *
     * @param id - IA data ID
     * @param input - Update input
     * @returns Updated AccommodationIaDataType if found, otherwise undefined
     * @throws Error if the update fails
     */
    async update(
        id: string,
        input: UpdateAccommodationIaDataInputType
    ): Promise<AccommodationIaDataType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .update(accommodationIaData)
                .set(input)
                .where(eq(accommodationIaData.id, id))
                .returning();
            const updated = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'accommodation_ia_data',
                action: 'update',
                params: { id, input },
                result: updated
            });
            return updated as AccommodationIaDataType | undefined;
        } catch (error) {
            dbLogger.error(error, 'AccommodationIaDataModel.update');
            throw new Error(`Failed to update accommodation IA data: ${(error as Error).message}`);
        }
    },

    /**
     * Soft delete an IA data entry by ID.
     *
     * @param id - IA data ID
     * @param deletedById - User ID who deletes
     * @returns Object with deleted IA data id if found, otherwise undefined
     * @throws Error if the delete fails
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .update(accommodationIaData)
                .set({ deletedAt: now, deletedById })
                .where(eq(accommodationIaData.id, id))
                .returning({ id: accommodationIaData.id });
            const deleted = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'accommodation_ia_data',
                action: 'delete',
                params: { id, deletedById },
                result: deleted
            });
            return deleted as { id: string } | undefined;
        } catch (error) {
            dbLogger.error(error, 'AccommodationIaDataModel.delete');
            throw new Error(`Failed to delete accommodation IA data: ${(error as Error).message}`);
        }
    },

    /**
     * Hard delete an IA data entry by ID.
     *
     * @param id - IA data ID
     * @returns True if deleted, false otherwise
     * @throws Error if the delete fails
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db
                .delete(accommodationIaData)
                .where(eq(accommodationIaData.id, id))
                .returning();
            const deleted = Array.isArray(result) ? result.length > 0 : false;
            dbLogger.query({
                table: 'accommodation_ia_data',
                action: 'hardDelete',
                params: { id },
                result: deleted
            });
            return deleted;
        } catch (error) {
            dbLogger.error(error, 'AccommodationIaDataModel.hardDelete');
            throw new Error(
                `Failed to hard delete accommodation IA data: ${(error as Error).message}`
            );
        }
    },

    /**
     * List IA data entries with pagination and optional ordering.
     *
     * @param params - Pagination and ordering parameters
     * @returns Array of AccommodationIaDataType
     * @throws Error if the query fails
     */
    async list(params: IaDataPaginationParams): Promise<AccommodationIaDataType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(
                iaDataOrderableColumns,
                orderBy,
                accommodationIaData.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(accommodationIaData)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'accommodation_ia_data', action: 'list', params, result });
            return result as AccommodationIaDataType[];
        } catch (error) {
            dbLogger.error(error, 'AccommodationIaDataModel.list');
            throw new Error(`Failed to list accommodation IA data: ${(error as Error).message}`);
        }
    },

    /**
     * Search IA data entries by title, category, etc.
     *
     * @param params - Search and pagination parameters
     * @returns Array of AccommodationIaDataType
     * @throws Error if the query fails
     */
    async search(params: IaDataSearchParams): Promise<AccommodationIaDataType[]> {
        const db = getDb();
        const { q, title, category, lifecycle, limit, offset, order, orderBy } = params;
        try {
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(accommodationIaData.title, prepareLikeQuery(q)));
            }
            if (title) {
                whereClauses.push(ilike(accommodationIaData.title, prepareLikeQuery(title)));
            }
            if (category) {
                whereClauses.push(eq(accommodationIaData.category, category));
            }
            if (lifecycle) {
                whereClauses.push(eq(accommodationIaData.lifecycle, lifecycle));
            }
            const col = getOrderableColumn(
                iaDataOrderableColumns,
                orderBy,
                accommodationIaData.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(accommodationIaData)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'accommodation_ia_data', action: 'search', params, result });
            return result as AccommodationIaDataType[];
        } catch (error) {
            dbLogger.error(error, 'AccommodationIaDataModel.search');
            throw new Error(`Failed to search accommodation IA data: ${(error as Error).message}`);
        }
    },

    /**
     * Count IA data entries with optional filters.
     *
     * @param params - Search parameters
     * @returns Number of IA data entries matching the query
     * @throws Error if the query fails
     */
    async count(params?: IaDataSearchParams): Promise<number> {
        const db = getDb();
        try {
            const { q, title, category, lifecycle } = params || {};
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(accommodationIaData.title, prepareLikeQuery(q)));
            }
            if (title) {
                whereClauses.push(ilike(accommodationIaData.title, prepareLikeQuery(title)));
            }
            if (category) {
                whereClauses.push(eq(accommodationIaData.category, category));
            }
            if (lifecycle) {
                whereClauses.push(eq(accommodationIaData.lifecycle, lifecycle));
            }
            const result = await db
                .select({ count: count().as('count') })
                .from(accommodationIaData)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);
            dbLogger.query({ table: 'accommodation_ia_data', action: 'count', params, result });
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            dbLogger.error(error, 'AccommodationIaDataModel.count');
            throw new Error(`Failed to count accommodation IA data: ${(error as Error).message}`);
        }
    }
};
