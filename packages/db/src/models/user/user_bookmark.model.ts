import type {
    NewUserBookmarkInputType,
    UpdateUserBookmarkInputType,
    UserBookmarkType
} from '@repo/types';
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { userBookmarks } from '../../dbschemas/user/user_bookmark.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for UserBookmarkModel
 * Columns: createdAt
 */
const userBookmarkOrderable = createOrderableColumnsAndMapping(
    ['createdAt'] as const,
    userBookmarks
);

export const USER_BOOKMARK_ORDERABLE_COLUMNS = userBookmarkOrderable.mapping;
export type UserBookmarkOrderableColumn = keyof typeof USER_BOOKMARK_ORDERABLE_COLUMNS;

export interface UserBookmarkPaginationParams {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: UserBookmarkOrderableColumn;
}

export interface UserBookmarkSearchParams extends UserBookmarkPaginationParams {
    query?: string;
}

export const UserBookmarkModel = {
    /**
     * Get a bookmark by id
     */
    async getById(id: string): Promise<UserBookmarkType | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(userBookmarks)
                .where(eq(userBookmarks.id, id))
                .limit(1)) as UserBookmarkType[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'userBookmarks', method: 'getById', err });
            throw new Error(`Failed to get user bookmark by id: ${(err as Error).message}`);
        }
    },
    /**
     * Get bookmarks by userId
     */
    async getByUserId(userId: string): Promise<UserBookmarkType[]> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(userBookmarks)
                .where(eq(userBookmarks.userId, userId))) as UserBookmarkType[];
            return result;
        } catch (err) {
            dbLogger.error({ table: 'userBookmarks', method: 'getByUserId', err });
            throw new Error(`Failed to get user bookmarks by userId: ${(err as Error).message}`);
        }
    },
    /**
     * Get bookmarks by entityId and entityType
     */
    async getByEntity(entityId: string, entityType: string): Promise<UserBookmarkType[]> {
        const db = getDb();
        try {
            const result = (await db
                .select()
                .from(userBookmarks)
                .where(
                    and(
                        eq(userBookmarks.entityId, entityId),
                        eq(userBookmarks.entityType, entityType)
                    )
                )) as UserBookmarkType[];
            return result;
        } catch (err) {
            dbLogger.error({ table: 'userBookmarks', method: 'getByEntity', err });
            throw new Error(`Failed to get user bookmarks by entity: ${(err as Error).message}`);
        }
    },
    /**
     * Create a new bookmark
     */
    async create(input: NewUserBookmarkInputType): Promise<UserBookmarkType> {
        const db = getDb();
        try {
            const result = (await db
                .insert(userBookmarks)
                .values(input)
                .returning()) as UserBookmarkType[];
            if (!result?.[0]) throw new Error('Insert failed');
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'userBookmarks', method: 'create', err });
            throw new Error(`Failed to create user bookmark: ${(err as Error).message}`);
        }
    },
    /**
     * Update a bookmark by id
     */
    async update(
        id: string,
        input: UpdateUserBookmarkInputType
    ): Promise<UserBookmarkType | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .update(userBookmarks)
                .set(input)
                .where(eq(userBookmarks.id, id))
                .returning()) as UserBookmarkType[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'userBookmarks', method: 'update', err });
            throw new Error(`Failed to update user bookmark: ${(err as Error).message}`);
        }
    },
    /**
     * Soft delete a bookmark by id
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const result = (await db
                .update(userBookmarks)
                .set({ deletedAt: new Date(), deletedById })
                .where(eq(userBookmarks.id, id))
                .returning({ id: userBookmarks.id })) as { id: string }[];
            return result[0];
        } catch (err) {
            dbLogger.error({ table: 'userBookmarks', method: 'delete', err });
            throw new Error(`Failed to delete user bookmark: ${(err as Error).message}`);
        }
    },
    /**
     * Hard delete a bookmark by id
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = (await db
                .delete(userBookmarks)
                .where(eq(userBookmarks.id, id))
                .returning()) as unknown[];
            return Array.isArray(result) && result.length > 0;
        } catch (err) {
            dbLogger.error({ table: 'userBookmarks', method: 'hardDelete', err });
            throw new Error(`Failed to hard delete user bookmark: ${(err as Error).message}`);
        }
    },
    /**
     * List bookmarks paginated
     */
    async list(params: UserBookmarkPaginationParams): Promise<UserBookmarkType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(
                userBookmarkOrderable.mapping,
                orderBy as string | undefined,
                userBookmarks.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = (await db
                .select()
                .from(userBookmarks)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset)) as UserBookmarkType[];
            dbLogger.query({ table: 'userBookmarks', method: 'list', params });
            return result;
        } catch (err) {
            dbLogger.error({ table: 'userBookmarks', method: 'list', err });
            throw new Error(`Failed to list user bookmarks: ${(err as Error).message}`);
        }
    },
    /**
     * Search bookmarks paginated
     */
    async search(params: UserBookmarkSearchParams): Promise<UserBookmarkType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy, query } = params;
        try {
            const col = getOrderableColumn(
                userBookmarkOrderable.mapping,
                orderBy as string | undefined,
                userBookmarks.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const whereExpr = query
                ? ilike(userBookmarks.name, prepareLikeQuery(query))
                : undefined;
            const result = (await db
                .select()
                .from(userBookmarks)
                .where(whereExpr)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset)) as UserBookmarkType[];
            dbLogger.query({ table: 'userBookmarks', method: 'search', params });
            return result;
        } catch (err) {
            dbLogger.error({ table: 'userBookmarks', method: 'search', err });
            throw new Error(`Failed to search user bookmarks: ${(err as Error).message}`);
        }
    },
    /**
     * Count bookmarks (optionally by search query)
     */
    async count(params: UserBookmarkSearchParams): Promise<number> {
        const db = getDb();
        const { query } = params;
        try {
            const whereExpr = query
                ? ilike(userBookmarks.name, prepareLikeQuery(query))
                : undefined;
            const result = await db.select({ count: count() }).from(userBookmarks).where(whereExpr);
            return Number(result[0]?.count ?? 0);
        } catch (err) {
            dbLogger.error({ table: 'userBookmarks', method: 'count', err });
            throw new Error(`Failed to count user bookmarks: ${(err as Error).message}`);
        }
    }
};
