import type {
    DestinationReviewType,
    NewDestinationReviewInputType,
    UpdateDestinationReviewInputType
} from '@repo/types';
import { asc, count, desc, eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { destinationReviews } from '../../dbschemas/destination/destination_review.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for DestinationReviewModel
 * Columns: createdAt
 */
const destinationReviewOrderable = createOrderableColumnsAndMapping(
    ['createdAt'] as const,
    destinationReviews
);

export const DESTINATION_REVIEW_ORDERABLE_COLUMNS = destinationReviewOrderable.mapping;
export type DestinationReviewOrderableColumn = keyof typeof DESTINATION_REVIEW_ORDERABLE_COLUMNS;

export interface DestinationReviewPaginationParams {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: DestinationReviewOrderableColumn;
}

export interface DestinationReviewSearchParams extends DestinationReviewPaginationParams {
    query?: string;
}

export const DestinationReviewModel = {
    /**
     * Get a review by id.
     *
     * @param id - Review ID
     * @returns DestinationReviewType if found, otherwise undefined
     * @throws Error if the query fails
     */
    async getById(id: string): Promise<DestinationReviewType | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(destinationReviews)
                .where(eq(destinationReviews.id, id))
                .limit(1)) as DestinationReviewType[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'destinationReviews', method: 'getById', err });
            throw new Error(`Failed to get destination review by id: ${(err as Error).message}`);
        }
    },
    /**
     * Get reviews by destinationId.
     *
     * @param destinationId - Destination ID
     * @returns Array of DestinationReviewType
     * @throws Error if the query fails
     */
    async getByDestinationId(destinationId: string): Promise<DestinationReviewType[]> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(destinationReviews)
                .where(
                    eq(destinationReviews.destinationId, destinationId)
                )) as DestinationReviewType[];
            return result;
        } catch (err) {
            dbLogger.error({ table: 'destinationReviews', method: 'getByDestinationId', err });
            throw new Error(
                `Failed to get destination reviews by destinationId: ${(err as Error).message}`
            );
        }
    },
    /**
     * Get reviews by userId.
     *
     * @param userId - User ID
     * @returns Array of DestinationReviewType
     * @throws Error if the query fails
     */
    async getByUserId(userId: string): Promise<DestinationReviewType[]> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(destinationReviews)
                .where(eq(destinationReviews.userId, userId))) as DestinationReviewType[];
            return result;
        } catch (err) {
            dbLogger.error({ table: 'destinationReviews', method: 'getByUserId', err });
            throw new Error(
                `Failed to get destination reviews by userId: ${(err as Error).message}`
            );
        }
    },
    /**
     * Create a new review.
     *
     * @param input - New review input
     * @returns The created DestinationReviewType
     * @throws Error if the insert fails
     */
    async create(input: NewDestinationReviewInputType): Promise<DestinationReviewType> {
        const db = getDb();
        try {
            const result = (await db
                .insert(destinationReviews)
                .values(input)
                .returning()) as DestinationReviewType[];
            if (!result?.[0]) throw new Error('Insert failed');
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'destinationReviews', method: 'create', err });
            throw new Error(`Failed to create destination review: ${(err as Error).message}`);
        }
    },
    /**
     * Update a review by id.
     *
     * @param id - Review ID
     * @param input - Update input
     * @returns Updated DestinationReviewType if found, otherwise undefined
     * @throws Error if the update fails
     */
    async update(
        id: string,
        input: UpdateDestinationReviewInputType
    ): Promise<DestinationReviewType | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .update(destinationReviews)
                .set(input)
                .where(eq(destinationReviews.id, id))
                .returning()) as DestinationReviewType[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'destinationReviews', method: 'update', err });
            throw new Error(`Failed to update destination review: ${(err as Error).message}`);
        }
    },
    /**
     * Soft delete a review by id.
     *
     * @param id - Review ID
     * @param deletedById - User ID who deletes
     * @returns Object with deleted review id if found, otherwise undefined
     * @throws Error if the delete fails
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .update(destinationReviews)
                .set({ deletedAt: new Date(), deletedById })
                .where(eq(destinationReviews.id, id))
                .returning({ id: destinationReviews.id })) as { id: string }[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'destinationReviews', method: 'delete', err });
            throw new Error(`Failed to delete destination review: ${(err as Error).message}`);
        }
    },
    /**
     * Hard delete a review by id.
     *
     * @param id - Review ID
     * @returns True if deleted, false otherwise
     * @throws Error if the delete fails
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = (await db
                .delete(destinationReviews)
                .where(eq(destinationReviews.id, id))
                .returning()) as unknown[];
            return Array.isArray(result) && result.length > 0;
        } catch (err) {
            dbLogger.error({ table: 'destinationReviews', method: 'hardDelete', err });
            throw new Error(`Failed to hard delete destination review: ${(err as Error).message}`);
        }
    },
    /**
     * List reviews paginated.
     *
     * @param params - Pagination and ordering parameters
     * @returns Array of DestinationReviewType
     * @throws Error if the query fails
     */
    async list(params: DestinationReviewPaginationParams): Promise<DestinationReviewType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(
                destinationReviewOrderable.mapping,
                orderBy as string | undefined,
                destinationReviews.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = (await db
                .select()
                .from(destinationReviews)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset)) as DestinationReviewType[];
            dbLogger.query({ table: 'destinationReviews', method: 'list', params });
            return result;
        } catch (err) {
            dbLogger.error({ table: 'destinationReviews', method: 'list', err });
            throw new Error(`Failed to list destination reviews: ${(err as Error).message}`);
        }
    },
    /**
     * Search reviews paginated.
     *
     * @param params - Search and pagination parameters
     * @returns Array of DestinationReviewType
     * @throws Error if the query fails
     */
    async search(params: DestinationReviewSearchParams): Promise<DestinationReviewType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy, query } = params;
        try {
            const col = getOrderableColumn(
                destinationReviewOrderable.mapping,
                orderBy as string | undefined,
                destinationReviews.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const whereExpr = query
                ? ilike(destinationReviews.content, prepareLikeQuery(query))
                : undefined;
            const result = (await db
                .select()
                .from(destinationReviews)
                .where(whereExpr)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset)) as DestinationReviewType[];
            dbLogger.query({ table: 'destinationReviews', method: 'search', params });
            return result;
        } catch (err) {
            dbLogger.error({ table: 'destinationReviews', method: 'search', err });
            throw new Error(`Failed to search destination reviews: ${(err as Error).message}`);
        }
    },
    /**
     * Count reviews (optionally by search query).
     *
     * @param params - Search parameters
     * @returns Number of reviews matching the query
     * @throws Error if the query fails
     */
    async count(params: DestinationReviewSearchParams): Promise<number> {
        const db = getDb();
        const { query } = params;
        try {
            const whereExpr = query
                ? ilike(destinationReviews.content, prepareLikeQuery(query))
                : undefined;
            const result = await db
                .select({ count: count() })
                .from(destinationReviews)
                .where(whereExpr);
            return Number(result[0]?.count ?? 0);
        } catch (err) {
            dbLogger.error({ table: 'destinationReviews', method: 'count', err });
            throw new Error(`Failed to count destination reviews: ${(err as Error).message}`);
        }
    }
};
