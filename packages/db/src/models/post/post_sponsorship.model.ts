import type {
    NewPostSponsorshipInputType,
    PostSponsorshipType,
    UpdatePostSponsorshipInputType
} from '@repo/types';
import { asc, count, desc, eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { postSponsorships } from '../../dbschemas/post/post_sponsorship.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for PostSponsorshipModel
 * Columns: description, createdAt
 */
const postSponsorshipOrderable = createOrderableColumnsAndMapping(
    ['description', 'createdAt'] as const,
    postSponsorships
);

export const POST_SPONSORSHIP_ORDERABLE_COLUMNS = postSponsorshipOrderable.mapping;
export type PostSponsorshipOrderableColumn = keyof typeof POST_SPONSORSHIP_ORDERABLE_COLUMNS;

export interface PostSponsorshipPaginationParams {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: PostSponsorshipOrderableColumn;
}

export interface PostSponsorshipSearchParams extends PostSponsorshipPaginationParams {
    query?: string;
}

export const PostSponsorshipModel = {
    /**
     * Get a sponsorship by id
     */
    async getById(id: string): Promise<PostSponsorshipType | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(postSponsorships)
                .where(eq(postSponsorships.id, id))
                .limit(1)) as PostSponsorshipType[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'postSponsorships', method: 'getById', err });
            throw new Error(`Failed to get post sponsorship by id: ${(err as Error).message}`);
        }
    },
    /**
     * Get sponsorships by sponsorId
     */
    async getBySponsorId(sponsorId: string): Promise<PostSponsorshipType[]> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(postSponsorships)
                .where(eq(postSponsorships.sponsorId, sponsorId))) as PostSponsorshipType[];
            return result;
        } catch (err) {
            dbLogger.error({ table: 'postSponsorships', method: 'getBySponsorId', err });
            throw new Error(
                `Failed to get post sponsorships by sponsorId: ${(err as Error).message}`
            );
        }
    },
    /**
     * Get sponsorships by postId
     */
    async getByPostId(postId: string): Promise<PostSponsorshipType[]> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(postSponsorships)
                .where(eq(postSponsorships.postId, postId))) as PostSponsorshipType[];
            return result;
        } catch (err) {
            dbLogger.error({ table: 'postSponsorships', method: 'getByPostId', err });
            throw new Error(`Failed to get post sponsorships by postId: ${(err as Error).message}`);
        }
    },
    /**
     * Create a new sponsorship
     */
    async create(input: NewPostSponsorshipInputType): Promise<PostSponsorshipType> {
        const db = getDb();
        try {
            const result = (await db
                .insert(postSponsorships)
                .values(input)
                .returning()) as PostSponsorshipType[];
            if (!result?.[0]) throw new Error('Insert failed');
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'postSponsorships', method: 'create', err });
            throw new Error(`Failed to create post sponsorship: ${(err as Error).message}`);
        }
    },
    /**
     * Update a sponsorship by id
     */
    async update(
        id: string,
        input: UpdatePostSponsorshipInputType
    ): Promise<PostSponsorshipType | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .update(postSponsorships)
                .set(input)
                .where(eq(postSponsorships.id, id))
                .returning()) as PostSponsorshipType[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'postSponsorships', method: 'update', err });
            throw new Error(`Failed to update post sponsorship: ${(err as Error).message}`);
        }
    },
    /**
     * Soft delete a sponsorship by id
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .update(postSponsorships)
                .set({ deletedAt: new Date(), deletedById })
                .where(eq(postSponsorships.id, id))
                .returning({ id: postSponsorships.id })) as { id: string }[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'postSponsorships', method: 'delete', err });
            throw new Error(`Failed to delete post sponsorship: ${(err as Error).message}`);
        }
    },
    /**
     * Hard delete a sponsorship by id
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = (await db
                .delete(postSponsorships)
                .where(eq(postSponsorships.id, id))
                .returning()) as unknown[];
            return Array.isArray(result) && result.length > 0;
        } catch (err) {
            dbLogger.error({ table: 'postSponsorships', method: 'hardDelete', err });
            throw new Error(`Failed to hard delete post sponsorship: ${(err as Error).message}`);
        }
    },
    /**
     * List sponsorships paginated
     */
    async list(params: PostSponsorshipPaginationParams): Promise<PostSponsorshipType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(
                postSponsorshipOrderable.mapping,
                orderBy as string | undefined,
                postSponsorships.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = (await db
                .select()
                .from(postSponsorships)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset)) as PostSponsorshipType[];
            dbLogger.query({ table: 'postSponsorships', method: 'list', params });
            return result;
        } catch (err) {
            dbLogger.error({ table: 'postSponsorships', method: 'list', err });
            throw new Error(`Failed to list post sponsorships: ${(err as Error).message}`);
        }
    },
    /**
     * Search sponsorships by description, paginated.
     *
     * @param params - Search and pagination parameters
     * @returns Array of PostSponsorshipType
     * @throws Error if the query fails
     */
    async search(params: PostSponsorshipSearchParams): Promise<PostSponsorshipType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy, query } = params;
        try {
            const col = getOrderableColumn(
                postSponsorshipOrderable.mapping,
                orderBy as string | undefined,
                postSponsorships.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const whereExpr = query
                ? ilike(postSponsorships.description, prepareLikeQuery(query))
                : undefined;
            const result = (await db
                .select()
                .from(postSponsorships)
                .where(whereExpr)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset)) as PostSponsorshipType[];
            dbLogger.query({ table: 'postSponsorships', method: 'search', params });
            return result;
        } catch (err) {
            dbLogger.error({ table: 'postSponsorships', method: 'search', err });
            throw new Error(`Failed to search post sponsorships: ${(err as Error).message}`);
        }
    },
    /**
     * Count sponsorships (optionally by search query).
     *
     * @param params - Search parameters
     * @returns Number of sponsorships matching the query
     * @throws Error if the query fails
     */
    async count(params: PostSponsorshipSearchParams): Promise<number> {
        const db = getDb();
        const { query } = params;
        try {
            const whereExpr = query
                ? ilike(postSponsorships.description, prepareLikeQuery(query))
                : undefined;
            const result = await db
                .select({ count: count() })
                .from(postSponsorships)
                .where(whereExpr);
            return Number(result[0]?.count ?? 0);
        } catch (err) {
            dbLogger.error({ table: 'postSponsorships', method: 'count', err });
            throw new Error(`Failed to count post sponsorships: ${(err as Error).message}`);
        }
    }
};
