import type {
    NewPostSponsorInputType,
    PostSponsorType,
    UpdatePostSponsorInputType
} from '@repo/types';
import { asc, count, desc, eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { postSponsors } from '../../dbschemas/post/post_sponsor.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for PostSponsorModel
 * Columns: name, createdAt
 */
const postSponsorOrderable = createOrderableColumnsAndMapping(
    ['name', 'createdAt'] as const,
    postSponsors
);

export const POST_SPONSOR_ORDERABLE_COLUMNS = postSponsorOrderable.columns;
export type PostSponsorOrderableColumn = keyof typeof POST_SPONSOR_ORDERABLE_COLUMNS;

export interface PostSponsorPaginationParams {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: PostSponsorOrderableColumn;
}

export interface PostSponsorSearchParams extends PostSponsorPaginationParams {
    query?: string;
}

export const PostSponsorModel = {
    /**
     * Get a sponsor by id
     */
    async getById(id: string): Promise<PostSponsorType | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(postSponsors)
                .where(eq(postSponsors.id, id))
                .limit(1)) as PostSponsorType[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'postSponsors', method: 'getById', err });
            throw new Error(`Failed to get post sponsor by id: ${(err as Error).message}`);
        }
    },
    /**
     * Get sponsors by name (case-insensitive)
     */
    async getByName(name: string): Promise<PostSponsorType[]> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(postSponsors)
                .where(ilike(postSponsors.name, `%${name}%`))) as PostSponsorType[];
            return result;
        } catch (err) {
            dbLogger.error({ table: 'postSponsors', method: 'getByName', err });
            throw new Error(`Failed to get post sponsors by name: ${(err as Error).message}`);
        }
    },
    /**
     * Create a new sponsor
     */
    async create(input: NewPostSponsorInputType): Promise<PostSponsorType> {
        const db = getDb();
        try {
            const result = (await db
                .insert(postSponsors)
                .values(input)
                .returning()) as PostSponsorType[];
            if (!result?.[0]) throw new Error('Insert failed');
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'postSponsors', method: 'create', err });
            throw new Error(`Failed to create post sponsor: ${(err as Error).message}`);
        }
    },
    /**
     * Update a sponsor by id
     */
    async update(
        id: string,
        input: UpdatePostSponsorInputType
    ): Promise<PostSponsorType | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .update(postSponsors)
                .set(input)
                .where(eq(postSponsors.id, id))
                .returning()) as PostSponsorType[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'postSponsors', method: 'update', err });
            throw new Error(`Failed to update post sponsor: ${(err as Error).message}`);
        }
    },
    /**
     * Soft delete a sponsor by id
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .update(postSponsors)
                .set({ deletedAt: new Date(), deletedById })
                .where(eq(postSponsors.id, id))
                .returning({ id: postSponsors.id })) as { id: string }[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'postSponsors', method: 'delete', err });
            throw new Error(`Failed to delete post sponsor: ${(err as Error).message}`);
        }
    },
    /**
     * Hard delete a sponsor by id
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = (await db
                .delete(postSponsors)
                .where(eq(postSponsors.id, id))
                .returning()) as unknown[];
            return Array.isArray(result) && result.length > 0;
        } catch (err) {
            dbLogger.error({ table: 'postSponsors', method: 'hardDelete', err });
            throw new Error(`Failed to hard delete post sponsor: ${(err as Error).message}`);
        }
    },
    /**
     * List sponsors paginated
     */
    async list(params: PostSponsorPaginationParams): Promise<PostSponsorType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(
                postSponsorOrderable.mapping,
                orderBy as string | undefined,
                postSponsors.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = (await db
                .select()
                .from(postSponsors)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset)) as PostSponsorType[];
            dbLogger.query({ table: 'postSponsors', method: 'list', params });
            return result;
        } catch (err) {
            dbLogger.error({ table: 'postSponsors', method: 'list', err });
            throw new Error(`Failed to list post sponsors: ${(err as Error).message}`);
        }
    },
    /**
     * Search sponsors by name, paginated.
     *
     * @param params - Search and pagination parameters
     * @returns Array of PostSponsorType
     * @throws Error if the query fails
     */
    async search(params: PostSponsorSearchParams): Promise<PostSponsorType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy, query } = params;
        try {
            const col = getOrderableColumn(
                postSponsorOrderable.mapping,
                orderBy as string | undefined,
                postSponsors.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const whereExpr = query ? ilike(postSponsors.name, prepareLikeQuery(query)) : undefined;
            const result = (await db
                .select()
                .from(postSponsors)
                .where(whereExpr)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset)) as PostSponsorType[];
            dbLogger.query({ table: 'postSponsors', method: 'search', params });
            return result;
        } catch (err) {
            dbLogger.error({ table: 'postSponsors', method: 'search', err });
            throw new Error(`Failed to search post sponsors: ${(err as Error).message}`);
        }
    },
    /**
     * Count sponsors (optionally by search query).
     *
     * @param params - Search parameters
     * @returns Number of sponsors matching the query
     * @throws Error if the query fails
     */
    async count(params: PostSponsorSearchParams): Promise<number> {
        const db = getDb();
        const { query } = params;
        try {
            const whereExpr = query ? ilike(postSponsors.name, prepareLikeQuery(query)) : undefined;
            const result = await db.select({ count: count() }).from(postSponsors).where(whereExpr);
            return Number(result[0]?.count ?? 0);
        } catch (err) {
            dbLogger.error({ table: 'postSponsors', method: 'count', err });
            throw new Error(`Failed to count post sponsors: ${(err as Error).message}`);
        }
    }
};
