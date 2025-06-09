import type {
    AccommodationReviewType,
    NewAccommodationReviewInputType,
    UpdateAccommodationReviewInputType
} from '@repo/types';
import { asc, count, desc, eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { accommodationReviews } from '../../dbschemas/accommodation/accommodation_review.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for AccommodationReviewModel
 * Columns: createdAt
 */
const accommodationReviewOrderable = createOrderableColumnsAndMapping(
    ['createdAt'] as const,
    accommodationReviews
);

export const ACCOMMODATION_REVIEW_ORDERABLE_COLUMNS = accommodationReviewOrderable.mapping;
export type AccommodationReviewOrderableColumn =
    keyof typeof ACCOMMODATION_REVIEW_ORDERABLE_COLUMNS;

export interface AccommodationReviewPaginationParams {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: AccommodationReviewOrderableColumn;
}

export interface AccommodationReviewSearchParams extends AccommodationReviewPaginationParams {
    query?: string;
}

export const AccommodationReviewModel = {
    /**
     * Get a review by id.
     *
     * @param id - Review ID
     * @returns AccommodationReviewType if found, otherwise undefined
     * @throws Error if the query fails
     */
    async getById(id: string): Promise<AccommodationReviewType | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(accommodationReviews)
                .where(eq(accommodationReviews.id, id))
                .limit(1)) as AccommodationReviewType[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'accommodationReviews', method: 'getById', err });
            throw new Error(`Failed to get accommodation review by id: ${(err as Error).message}`);
        }
    },
    /**
     * Get reviews by accommodationId.
     *
     * @param accommodationId - Accommodation ID
     * @returns Array of AccommodationReviewType
     * @throws Error if the query fails
     */
    async getByAccommodationId(accommodationId: string): Promise<AccommodationReviewType[]> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(accommodationReviews)
                .where(
                    eq(accommodationReviews.accommodationId, accommodationId)
                )) as AccommodationReviewType[];
            return result;
        } catch (err) {
            dbLogger.error({ table: 'accommodationReviews', method: 'getByAccommodationId', err });
            throw new Error(
                `Failed to get accommodation reviews by accommodationId: ${(err as Error).message}`
            );
        }
    },
    /**
     * Get reviews by userId.
     *
     * @param userId - User ID
     * @returns Array of AccommodationReviewType
     * @throws Error if the query fails
     */
    async getByUserId(userId: string): Promise<AccommodationReviewType[]> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(accommodationReviews)
                .where(eq(accommodationReviews.userId, userId))) as AccommodationReviewType[];
            return result;
        } catch (err) {
            dbLogger.error({ table: 'accommodationReviews', method: 'getByUserId', err });
            throw new Error(
                `Failed to get accommodation reviews by userId: ${(err as Error).message}`
            );
        }
    },
    /**
     * Create a new review.
     *
     * @param input - New review input
     * @returns The created AccommodationReviewType
     * @throws Error if the insert fails
     */
    async create(input: NewAccommodationReviewInputType): Promise<AccommodationReviewType> {
        const db = getDb();
        try {
            const result = (await db
                .insert(accommodationReviews)
                .values(input)
                .returning()) as AccommodationReviewType[];
            if (!result?.[0]) throw new Error('Insert failed');
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'accommodationReviews', method: 'create', err });
            throw new Error(`Failed to create accommodation review: ${(err as Error).message}`);
        }
    },
    /**
     * Update a review by id.
     *
     * @param id - Review ID
     * @param input - Update input
     * @returns Updated AccommodationReviewType if found, otherwise undefined
     * @throws Error if the update fails
     */
    async update(
        id: string,
        input: UpdateAccommodationReviewInputType
    ): Promise<AccommodationReviewType | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .update(accommodationReviews)
                .set(input)
                .where(eq(accommodationReviews.id, id))
                .returning()) as AccommodationReviewType[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'accommodationReviews', method: 'update', err });
            throw new Error(`Failed to update accommodation review: ${(err as Error).message}`);
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
                .update(accommodationReviews)
                .set({ deletedAt: new Date(), deletedById })
                .where(eq(accommodationReviews.id, id))
                .returning({ id: accommodationReviews.id })) as { id: string }[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'accommodationReviews', method: 'delete', err });
            throw new Error(`Failed to delete accommodation review: ${(err as Error).message}`);
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
                .delete(accommodationReviews)
                .where(eq(accommodationReviews.id, id))
                .returning()) as unknown[];
            return Array.isArray(result) && result.length > 0;
        } catch (err) {
            dbLogger.error({ table: 'accommodationReviews', method: 'hardDelete', err });
            throw new Error(
                `Failed to hard delete accommodation review: ${(err as Error).message}`
            );
        }
    },
    /**
     * List reviews paginated.
     *
     * @param params - Pagination and ordering parameters
     * @returns Array of AccommodationReviewType
     * @throws Error if the query fails
     */
    async list(params: AccommodationReviewPaginationParams): Promise<AccommodationReviewType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(
                accommodationReviewOrderable.mapping,
                orderBy as string | undefined,
                accommodationReviews.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = (await db
                .select()
                .from(accommodationReviews)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset)) as AccommodationReviewType[];
            dbLogger.query({ table: 'accommodationReviews', method: 'list', params });
            return result;
        } catch (err) {
            dbLogger.error({ table: 'accommodationReviews', method: 'list', err });
            throw new Error(`Failed to list accommodation reviews: ${(err as Error).message}`);
        }
    },
    /**
     * Search reviews paginated.
     *
     * @param params - Search and pagination parameters
     * @returns Array of AccommodationReviewType
     * @throws Error if the query fails
     */
    async search(params: AccommodationReviewSearchParams): Promise<AccommodationReviewType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy, query } = params;
        try {
            const col = getOrderableColumn(
                accommodationReviewOrderable.mapping,
                orderBy as string | undefined,
                accommodationReviews.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const whereExpr = query
                ? ilike(accommodationReviews.content, prepareLikeQuery(query))
                : undefined;
            const result = (await db
                .select()
                .from(accommodationReviews)
                .where(whereExpr)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset)) as AccommodationReviewType[];
            dbLogger.query({ table: 'accommodationReviews', method: 'search', params });
            return result;
        } catch (err) {
            dbLogger.error({ table: 'accommodationReviews', method: 'search', err });
            throw new Error(`Failed to search accommodation reviews: ${(err as Error).message}`);
        }
    },
    /**
     * Count reviews (optionally by search query).
     *
     * @param params - Search parameters
     * @returns Number of reviews matching the query
     * @throws Error if the query fails
     */
    async count(params: AccommodationReviewSearchParams): Promise<number> {
        const db = getDb();
        const { query } = params;
        try {
            const whereExpr = query
                ? ilike(accommodationReviews.content, prepareLikeQuery(query))
                : undefined;
            const result = await db
                .select({ count: count() })
                .from(accommodationReviews)
                .where(whereExpr);
            return Number(result[0]?.count ?? 0);
        } catch (err) {
            dbLogger.error({ table: 'accommodationReviews', method: 'count', err });
            throw new Error(`Failed to count accommodation reviews: ${(err as Error).message}`);
        }
    }
};
