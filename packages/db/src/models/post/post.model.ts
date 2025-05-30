import type { NewPostInputType, PostType, UpdatePostInputType } from '@repo/types';
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { posts } from '../../dbschemas/post/post.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for PostModel
 * Columns: title, createdAt
 */
const postOrderable = createOrderableColumnsAndMapping(['title', 'createdAt'] as const, posts);

export const POST_ORDERABLE_COLUMNS = postOrderable.columns;
export type PostOrderByColumn = typeof postOrderable.type;
const postOrderableColumns = postOrderable.mapping;

export type PostPaginationParams = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: PostOrderByColumn;
};

export type PostSearchParams = PostPaginationParams & {
    q?: string;
    title?: string;
    summary?: string;
    category?: string;
    authorId?: string;
    lifecycle?: string;
    visibility?: string;
};

export const PostModel = {
    /**
     * Get a post by its unique ID.
     */
    async getById(id: string): Promise<PostType | undefined> {
        const db = getDb();
        try {
            const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
            dbLogger.query({ table: 'posts', action: 'getById', params: { id }, result });
            return result[0] as PostType | undefined;
        } catch (error) {
            dbLogger.error(error, 'PostModel.getById');
            throw new Error(`Failed to get post by id: ${(error as Error).message}`);
        }
    },

    /**
     * Get a post by its unique slug.
     */
    async getBySlug(slug: string): Promise<PostType | undefined> {
        const db = getDb();
        try {
            const result = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
            dbLogger.query({ table: 'posts', action: 'getBySlug', params: { slug }, result });
            return result[0] as PostType | undefined;
        } catch (error) {
            dbLogger.error(error, 'PostModel.getBySlug');
            throw new Error(`Failed to get post by slug: ${(error as Error).message}`);
        }
    },

    /**
     * Get posts by category.
     */
    async getByCategory(category: string): Promise<PostType[]> {
        const db = getDb();
        try {
            const result = await db.select().from(posts).where(eq(posts.category, category));
            dbLogger.query({
                table: 'posts',
                action: 'getByCategory',
                params: { category },
                result
            });
            return result as PostType[];
        } catch (error) {
            dbLogger.error(error, 'PostModel.getByCategory');
            throw new Error(`Failed to get posts by category: ${(error as Error).message}`);
        }
    },

    /**
     * Get posts by author.
     */
    async getByAuthor(authorId: string): Promise<PostType[]> {
        const db = getDb();
        try {
            const result = await db.select().from(posts).where(eq(posts.authorId, authorId));
            dbLogger.query({ table: 'posts', action: 'getByAuthor', params: { authorId }, result });
            return result as PostType[];
        } catch (error) {
            dbLogger.error(error, 'PostModel.getByAuthor');
            throw new Error(`Failed to get posts by author: ${(error as Error).message}`);
        }
    },

    /**
     * Create a new post.
     */
    async create(input: NewPostInputType): Promise<PostType> {
        const db = getDb();
        try {
            const result = await db.insert(posts).values(input).returning();
            const created = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'posts',
                action: 'create',
                params: { input },
                result: created
            });
            if (!created) throw new Error('Insert failed');
            return created as PostType;
        } catch (error) {
            dbLogger.error(error, 'PostModel.create');
            throw new Error(`Failed to create post: ${(error as Error).message}`);
        }
    },

    /**
     * Update a post by ID.
     */
    async update(id: string, input: UpdatePostInputType): Promise<PostType | undefined> {
        const db = getDb();
        try {
            const result = await db.update(posts).set(input).where(eq(posts.id, id)).returning();
            const updated = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'posts',
                action: 'update',
                params: { id, input },
                result: updated
            });
            return updated as PostType | undefined;
        } catch (error) {
            dbLogger.error(error, 'PostModel.update');
            throw new Error(`Failed to update post: ${(error as Error).message}`);
        }
    },

    /**
     * Soft delete a post by ID.
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .update(posts)
                .set({ deletedAt: now, deletedById })
                .where(eq(posts.id, id))
                .returning({ id: posts.id });
            const deleted = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'posts',
                action: 'delete',
                params: { id, deletedById },
                result: deleted
            });
            return deleted as { id: string } | undefined;
        } catch (error) {
            dbLogger.error(error, 'PostModel.delete');
            throw new Error(`Failed to delete post: ${(error as Error).message}`);
        }
    },

    /**
     * Hard delete a post by ID.
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db.delete(posts).where(eq(posts.id, id)).returning();
            const deleted = Array.isArray(result) ? result.length > 0 : false;
            dbLogger.query({
                table: 'posts',
                action: 'hardDelete',
                params: { id },
                result: deleted
            });
            return deleted;
        } catch (error) {
            dbLogger.error(error, 'PostModel.hardDelete');
            throw new Error(`Failed to hard delete post: ${(error as Error).message}`);
        }
    },

    /**
     * List posts with pagination and optional ordering.
     */
    async list(params: PostPaginationParams): Promise<PostType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(postOrderableColumns, orderBy, posts.createdAt);
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(posts)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'posts', action: 'list', params, result });
            return result as PostType[];
        } catch (error) {
            dbLogger.error(error, 'PostModel.list');
            throw new Error(`Failed to list posts: ${(error as Error).message}`);
        }
    },

    /**
     * Search posts by title, summary, etc.
     */
    async search(params: PostSearchParams): Promise<PostType[]> {
        const db = getDb();
        const {
            q,
            title,
            summary,
            category,
            authorId,
            lifecycle,
            visibility,
            limit,
            offset,
            order,
            orderBy
        } = params;
        try {
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(posts.title, prepareLikeQuery(q)));
            }
            if (title) {
                whereClauses.push(ilike(posts.title, prepareLikeQuery(title)));
            }
            if (summary) {
                whereClauses.push(ilike(posts.summary, prepareLikeQuery(summary)));
            }
            if (category) {
                whereClauses.push(eq(posts.category, category));
            }
            if (authorId) {
                whereClauses.push(eq(posts.authorId, authorId));
            }
            if (lifecycle) {
                whereClauses.push(eq(posts.lifecycle, lifecycle));
            }
            if (visibility) {
                whereClauses.push(eq(posts.visibility, visibility));
            }
            const col = getOrderableColumn(postOrderableColumns, orderBy, posts.createdAt);
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(posts)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'posts', action: 'search', params, result });
            return result as PostType[];
        } catch (error) {
            dbLogger.error(error, 'PostModel.search');
            throw new Error(`Failed to search posts: ${(error as Error).message}`);
        }
    },

    /**
     * Count posts with optional filters.
     */
    async count(params?: PostSearchParams): Promise<number> {
        const db = getDb();
        try {
            const { q, title, summary, category, authorId, lifecycle, visibility } = params || {};
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(posts.title, prepareLikeQuery(q)));
            }
            if (title) {
                whereClauses.push(ilike(posts.title, prepareLikeQuery(title)));
            }
            if (summary) {
                whereClauses.push(ilike(posts.summary, prepareLikeQuery(summary)));
            }
            if (category) {
                whereClauses.push(eq(posts.category, category));
            }
            if (authorId) {
                whereClauses.push(eq(posts.authorId, authorId));
            }
            if (lifecycle) {
                whereClauses.push(eq(posts.lifecycle, lifecycle));
            }
            if (visibility) {
                whereClauses.push(eq(posts.visibility, visibility));
            }
            const result = await db
                .select({ count: count().as('count') })
                .from(posts)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);
            dbLogger.query({ table: 'posts', action: 'count', params, result });
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            dbLogger.error(error, 'PostModel.count');
            throw new Error(`Failed to count posts: ${(error as Error).message}`);
        }
    }
};
