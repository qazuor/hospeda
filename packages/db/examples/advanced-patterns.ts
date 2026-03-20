/**
 * Advanced Patterns Example
 *
 * This file demonstrates advanced database patterns and optimizations:
 * - Full-text search with PostgreSQL
 * - Batch operations (bulk insert/update)
 * - Caching strategies
 * - Performance optimizations
 * - Lifecycle hooks (beforeCreate, afterUpdate, etc.)
 * - Soft delete patterns
 * - Index hints and query optimization
 *
 * Key Concepts:
 * - tsvector for full-text search
 * - Batch operations with returning
 * - In-memory caching layer
 * - Query result estimation
 * - Lazy loading patterns
 * - Event hooks for business logic
 * - Database indexes optimization
 *
 * @example
 * ```ts
 * import { PostModel } from './advanced-patterns';
 *
 * const postModel = new PostModel();
 *
 * // Full-text search
 * const results = await postModel.fullTextSearch({
 *   query: 'typescript database'
 * });
 * ```
 */

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
    boolean,
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { BaseModel } from '../src/base/base.model';
import type * as schema from '../src/schemas/index.js';
import { buildWhereClause } from '../src/utils/drizzle-helpers';
import { DbError } from '../src/utils/error';
import { logError, logQuery } from '../src/utils/logger';

// ============================================================================
// 1. SCHEMAS WITH ADVANCED FEATURES
// ============================================================================

/**
 * User table schema
 */
export const userTable = pgTable('users_advanced', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    avatar: text('avatar'),
    isActive: boolean('is_active').default(true).notNull(),
    // Audit fields
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at')
});

/**
 * Post table schema with full-text search support
 *
 * Includes tsvector column for efficient full-text search
 */
export const postTable = pgTable(
    'posts_advanced',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        authorId: uuid('author_id')
            .notNull()
            .references(() => userTable.id, { onDelete: 'cascade' }),
        title: varchar('title', { length: 255 }).notNull(),
        slug: varchar('slug', { length: 255 }).notNull().unique(),
        content: text('content').notNull(),
        excerpt: text('excerpt'),
        // Full-text search vector (updated via trigger)
        searchVector: text('search_vector'),
        // Metrics
        viewCount: integer('view_count').default(0).notNull(),
        likeCount: integer('like_count').default(0).notNull(),
        commentCount: integer('comment_count').default(0).notNull(),
        // Flags
        isPublished: boolean('is_published').default(false).notNull(),
        isFeatured: boolean('is_featured').default(false).notNull(),
        // Timestamps
        publishedAt: timestamp('published_at'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        deletedAt: timestamp('deleted_at')
    },
    (table) => ({
        // Indexes for common queries
        authorIdx: index('posts_author_idx').on(table.authorId),
        slugIdx: index('posts_slug_idx').on(table.slug),
        publishedIdx: index('posts_published_idx').on(table.isPublished),
        // Composite index for published posts by author
        authorPublishedIdx: index('posts_author_published_idx').on(
            table.authorId,
            table.isPublished
        )
    })
);

/**
 * Comment table schema
 */
export const commentTable = pgTable('comments_advanced', {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id')
        .notNull()
        .references(() => postTable.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
        .notNull()
        .references(() => userTable.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    // Audit fields
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at')
});

// ============================================================================
// 2. TYPE DEFINITIONS
// ============================================================================

export type User = typeof userTable.$inferSelect;
export type Post = typeof postTable.$inferSelect;
export type Comment = typeof commentTable.$inferSelect;

/**
 * Batch operation result
 */
export interface BatchResult<T> {
    created: T[];
    failed: Array<{ data: Partial<T>; error: string }>;
}

/**
 * Cache entry
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

// ============================================================================
// 3. CACHING HELPER
// ============================================================================

/**
 * Simple in-memory cache implementation
 *
 * For production, consider using Redis or similar
 */
export class SimpleCache<T> {
    private cache = new Map<string, CacheEntry<T>>();
    private ttl: number; // Time to live in milliseconds

    /**
     * Create a new cache instance
     *
     * @param ttl - Time to live in seconds (default: 300 = 5 minutes)
     */
    constructor(ttl = 300) {
        this.ttl = ttl * 1000; // Convert to milliseconds
    }

    /**
     * Get a value from cache
     *
     * @param key - Cache key
     * @returns Cached value or null if expired/not found
     */
    get(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check if expired
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    /**
     * Set a value in cache
     *
     * @param key - Cache key
     * @param data - Data to cache
     */
    set(key: string, data: T): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Invalidate a cache entry
     *
     * @param key - Cache key to invalidate
     */
    invalidate(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Invalidate all cache entries matching a pattern
     *
     * @param pattern - Key pattern (supports * wildcard)
     */
    invalidatePattern(pattern: string): void {
        const regex = new RegExp(pattern.replace('*', '.*'));
        const keys = Array.from(this.cache.keys());

        for (const key of keys) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// ============================================================================
// 4. POST MODEL WITH ADVANCED PATTERNS
// ============================================================================

/**
 * Post Model with advanced features
 *
 * Demonstrates:
 * - Full-text search
 * - Batch operations
 * - Caching
 * - Performance optimizations
 * - Lifecycle hooks
 */
export class PostModel extends BaseModel<Post> {
    protected table = postTable;
    protected entityName = 'post';
    private cache: SimpleCache<Post>;

    constructor() {
        super();
        // Initialize cache with 5-minute TTL
        this.cache = new SimpleCache<Post>(300);
    }

    protected getTableName(): string {
        return 'posts_advanced';
    }

    // ==========================================================================
    // FULL-TEXT SEARCH
    // ==========================================================================

    /**
     * Full-text search using PostgreSQL tsvector
     *
     * Searches in title, content, and excerpt fields
     *
     * @param input - Query input
     * @param input.query - Search query
     * @param input.limit - Maximum results (default: 20)
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to matching posts
     *
     * @example
     * ```ts
     * const results = await postModel.fullTextSearch({
     *   query: 'typescript database optimization',
     *   limit: 10
     * });
     *
     * results.forEach(post => {
     *   console.log(`${post.title} - ${post.viewCount} views`);
     * });
     * ```
     */
    async fullTextSearch(input: {
        query: string;
        limit?: number;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Post[]> {
        const { query, limit = 20, tx } = input;
        const db = this.getClient(tx);

        try {
            // Build tsquery from search terms
            const tsquery = query
                .split(/\s+/)
                .filter((term) => term.length > 0)
                .join(' & ');

            const result = await db
                .select()
                .from(postTable)
                .where(
                    and(
                        // Full-text search using to_tsquery
                        sql`to_tsvector('english', ${postTable.title} || ' ' || ${postTable.content}) @@ to_tsquery('english', ${tsquery})`,
                        eq(postTable.isPublished, true),
                        isNull(postTable.deletedAt)
                    )
                )
                .orderBy(
                    // Rank by relevance
                    sql`ts_rank(to_tsvector('english', ${postTable.title} || ' ' || ${postTable.content}), to_tsquery('english', ${tsquery})) DESC`
                )
                .limit(limit);

            logQuery(this.entityName, 'fullTextSearch', { query, limit }, result);
            return result as Post[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'fullTextSearch', { query, limit }, err);
            throw new DbError(this.entityName, 'fullTextSearch', { query, limit }, err.message);
        }
    }

    // ==========================================================================
    // BATCH OPERATIONS
    // ==========================================================================

    /**
     * Batch create posts
     *
     * Inserts multiple posts in a single query
     *
     * @param input - Query input
     * @param input.posts - Array of post data
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to batch result
     *
     * @example
     * ```ts
     * const result = await postModel.batchCreate({
     *   posts: [
     *     { authorId: 'user-1', title: 'Post 1', slug: 'post-1', content: '...' },
     *     { authorId: 'user-1', title: 'Post 2', slug: 'post-2', content: '...' },
     *     { authorId: 'user-2', title: 'Post 3', slug: 'post-3', content: '...' },
     *   ]
     * });
     *
     * console.log(`Created ${result.created.length} posts`);
     * console.log(`Failed: ${result.failed.length}`);
     * ```
     */
    async batchCreate(input: {
        posts: Array<Omit<Post, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<BatchResult<Post>> {
        const { posts, tx } = input;
        const db = this.getClient(tx);

        try {
            // Execute batch insert
            const created = await db.insert(postTable).values(posts).returning();

            logQuery(this.entityName, 'batchCreate', { count: posts.length }, created);

            return {
                created: created as Post[],
                failed: []
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'batchCreate', { count: posts.length }, err);

            // In production, implement more sophisticated error handling
            // (e.g., identify which specific posts failed)
            return {
                created: [],
                failed: posts.map((post) => ({
                    data: post,
                    error: err.message
                }))
            };
        }
    }

    /**
     * Batch update posts
     *
     * Updates multiple posts efficiently
     *
     * @param input - Query input
     * @param input.updates - Array of { id, data } pairs
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to number of updated posts
     *
     * @example
     * ```ts
     * const updated = await postModel.batchUpdate({
     *   updates: [
     *     { id: 'post-1', data: { viewCount: 100 } },
     *     { id: 'post-2', data: { viewCount: 200 } },
     *     { id: 'post-3', data: { viewCount: 150 } },
     *   ]
     * });
     *
     * console.log(`Updated ${updated} posts`);
     * ```
     */
    async batchUpdate(input: {
        updates: Array<{ id: string; data: Partial<Post> }>;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<number> {
        const { updates, tx } = input;
        const db = this.getClient(tx);

        try {
            let totalUpdated = 0;

            // Execute in transaction for consistency
            await db.transaction(async (trx) => {
                for (const { id, data } of updates) {
                    const result = await this.update({ id }, data, trx);
                    if (result) totalUpdated++;

                    // Invalidate cache
                    this.cache.invalidate(`post:${id}`);
                }
            });

            logQuery(this.entityName, 'batchUpdate', { count: updates.length }, { totalUpdated });
            return totalUpdated;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'batchUpdate', { count: updates.length }, err);
            throw new DbError(
                this.entityName,
                'batchUpdate',
                { count: updates.length },
                err.message
            );
        }
    }

    /**
     * Batch soft delete posts
     *
     * @param input - Query input
     * @param input.ids - Array of post IDs to delete
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to number of deleted posts
     *
     * @example
     * ```ts
     * const deleted = await postModel.softDeleteBatch({
     *   ids: ['post-1', 'post-2', 'post-3']
     * });
     * ```
     */
    async softDeleteBatch(input: {
        ids: string[];
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<number> {
        const { ids, tx } = input;
        const db = this.getClient(tx);

        try {
            const result = await db
                .update(postTable)
                .set({ deletedAt: new Date() })
                .where(and(inArray(postTable.id, ids), isNull(postTable.deletedAt)))
                .returning();

            // Invalidate cache for deleted posts
            for (const id of ids) {
                this.cache.invalidate(`post:${id}`);
            }

            logQuery(this.entityName, 'softDeleteBatch', { ids }, result);
            return result.length;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'softDeleteBatch', { ids }, err);
            throw new DbError(this.entityName, 'softDeleteBatch', { ids }, err.message);
        }
    }

    // ==========================================================================
    // CACHING PATTERN
    // ==========================================================================

    /**
     * Find post by ID with caching
     *
     * Checks cache before querying database
     *
     * @param input - Query input
     * @param input.id - Post ID
     * @param input.bypassCache - Skip cache lookup
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to post or null
     *
     * @example
     * ```ts
     * // First call - queries database
     * const post1 = await postModel.findWithCache({ id: 'post-uuid' });
     *
     * // Second call - returns from cache
     * const post2 = await postModel.findWithCache({ id: 'post-uuid' });
     *
     * // Bypass cache
     * const fresh = await postModel.findWithCache({
     *   id: 'post-uuid',
     *   bypassCache: true
     * });
     * ```
     */
    async findWithCache(input: {
        id: string;
        bypassCache?: boolean;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Post | null> {
        const { id, bypassCache = false, tx } = input;
        const cacheKey = `post:${id}`;

        try {
            // Check cache first
            if (!bypassCache) {
                const cached = this.cache.get(cacheKey);
                if (cached) {
                    logQuery(this.entityName, 'findWithCache', { id }, { fromCache: true });
                    return cached;
                }
            }

            // Query database
            const post = await this.findById(id, tx);

            // Store in cache if found
            if (post) {
                this.cache.set(cacheKey, post);
            }

            logQuery(this.entityName, 'findWithCache', { id }, { fromCache: false });
            return post;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findWithCache', { id }, err);
            throw new DbError(this.entityName, 'findWithCache', { id }, err.message);
        }
    }

    // ==========================================================================
    // PERFORMANCE OPTIMIZATIONS
    // ==========================================================================

    /**
     * Find popular posts
     *
     * Uses composite sorting for featured and view count
     *
     * @param input - Query input
     * @param input.limit - Number of posts to return
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to popular posts
     *
     * @example
     * ```ts
     * const popular = await postModel.findPopular({ limit: 10 });
     * ```
     */
    async findPopular(input: {
        limit: number;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Post[]> {
        const { limit, tx } = input;
        const db = this.getClient(tx);

        try {
            const result = await db
                .select()
                .from(postTable)
                .where(and(eq(postTable.isPublished, true), isNull(postTable.deletedAt)))
                .orderBy(
                    // Featured posts first
                    desc(postTable.isFeatured),
                    // Then by view count
                    desc(postTable.viewCount)
                )
                .limit(limit);

            logQuery(this.entityName, 'findPopular', { limit }, result);
            return result as Post[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findPopular', { limit }, err);
            throw new DbError(this.entityName, 'findPopular', { limit }, err.message);
        }
    }

    /**
     * Get related posts based on author and view count similarity
     *
     * @param input - Query input
     * @param input.postId - Reference post ID
     * @param input.limit - Number of related posts
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to related posts
     *
     * @example
     * ```ts
     * const related = await postModel.getRelatedPosts({
     *   postId: 'post-uuid',
     *   limit: 5
     * });
     * ```
     */
    async getRelatedPosts(input: {
        postId: string;
        limit: number;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Post[]> {
        const { postId, limit, tx } = input;
        const db = this.getClient(tx);

        try {
            const referencePost = await this.findById(postId, tx);
            if (!referencePost) {
                return [];
            }

            const result = await db
                .select()
                .from(postTable)
                .where(
                    and(
                        // Same author
                        eq(postTable.authorId, referencePost.authorId),
                        // Not the same post
                        sql`${postTable.id} != ${postId}`,
                        eq(postTable.isPublished, true),
                        isNull(postTable.deletedAt)
                    )
                )
                .orderBy(desc(postTable.viewCount))
                .limit(limit);

            logQuery(this.entityName, 'getRelatedPosts', { postId, limit }, result);
            return result as Post[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'getRelatedPosts', { postId, limit }, err);
            throw new DbError(this.entityName, 'getRelatedPosts', { postId, limit }, err.message);
        }
    }

    /**
     * Fast count estimation for large tables
     *
     * Uses PostgreSQL statistics for quick approximation
     *
     * @param input - Query input
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to estimated count
     *
     * @example
     * ```ts
     * const estimate = await postModel.countEstimate({});
     * console.log(`Approximately ${estimate} posts`);
     * ```
     */
    async countEstimate(input: {
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<number> {
        const { tx } = input;
        const db = this.getClient(tx);

        try {
            // Use PostgreSQL statistics for fast estimation
            const result = await db.execute(sql`
        SELECT reltuples::BIGINT AS estimate
        FROM pg_class
        WHERE relname = 'posts_advanced'
      `);

            const rows = result.rows as Array<{ estimate: string }>;
            const estimate = Number(rows[0]?.estimate ?? 0);

            logQuery(this.entityName, 'countEstimate', {}, { estimate });
            return estimate;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'countEstimate', {}, err);
            // Fallback to exact count
            return this.count({ deletedAt: null }, { tx });
        }
    }

    /**
     * Find with lazy loading pattern
     *
     * Returns minimal data and provides method to load full details
     *
     * @param input - Query input
     * @param input.filters - Search filters
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to lazy-loaded posts
     *
     * @example
     * ```ts
     * const posts = await postModel.findLazy({ filters: {} });
     *
     * posts.forEach(post => {
     *   console.log(`${post.id}: ${post.title}`);
     * });
     * ```
     */
    async findLazy(input: {
        filters: Partial<Post>;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Array<Pick<Post, 'id' | 'title' | 'slug' | 'publishedAt'>>> {
        const { filters, tx } = input;
        const db = this.getClient(tx);

        try {
            const whereClause = buildWhereClause(filters, this.table as unknown);

            const result = await db
                .select({
                    id: postTable.id,
                    title: postTable.title,
                    slug: postTable.slug,
                    publishedAt: postTable.publishedAt
                })
                .from(postTable)
                .where(whereClause);

            logQuery(this.entityName, 'findLazy', { filters }, result);
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findLazy', { filters }, err);
            throw new DbError(this.entityName, 'findLazy', { filters }, err.message);
        }
    }

    // ==========================================================================
    // LIFECYCLE HOOKS
    // ==========================================================================

    /**
     * Before create hook
     *
     * Validates and transforms data before insert
     *
     * @param data - Post data to be created
     * @returns Validated and transformed data
     */
    protected async beforeCreate(data: Partial<Post>): Promise<Partial<Post>> {
        // Generate slug if not provided
        if (!data.slug && data.title) {
            data.slug = data.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
        }

        // Generate excerpt from content if not provided
        if (!data.excerpt && data.content) {
            data.excerpt = `${data.content.slice(0, 200)}...`;
        }

        // Set published date if publishing
        if (data.isPublished && !data.publishedAt) {
            data.publishedAt = new Date();
        }

        return data;
    }

    /**
     * After create hook
     *
     * Executes after successful creation
     *
     * @param post - Created post
     */
    protected async afterCreate(post: Post): Promise<void> {
        // Could trigger notifications, update search index, etc.
        logQuery(this.entityName, 'afterCreate', { postId: post.id }, { success: true });
    }

    /**
     * Before update hook
     *
     * @param id - Post ID being updated
     * @param data - Update data
     * @returns Transformed update data
     */
    protected async beforeUpdate(id: string, data: Partial<Post>): Promise<Partial<Post>> {
        // Update publishedAt if transitioning to published
        if (data.isPublished && !data.publishedAt) {
            const existing = await this.findById(id);
            if (existing && !existing.isPublished) {
                data.publishedAt = new Date();
            }
        }

        // Always update updatedAt
        data.updatedAt = new Date();

        // Invalidate cache
        this.cache.invalidate(`post:${id}`);

        return data;
    }

    /**
     * After soft delete hook
     *
     * @param post - Deleted post
     */
    protected async afterSoftDelete(post: Post): Promise<void> {
        // Invalidate cache
        this.cache.invalidate(`post:${post.id}`);

        // Could trigger cleanup, notifications, etc.
        logQuery(this.entityName, 'afterSoftDelete', { postId: post.id }, { success: true });
    }

    /**
     * Override create to use hooks
     */
    async create(data: Partial<Post>, tx?: NodePgDatabase<typeof schema>): Promise<Post> {
        const transformedData = await this.beforeCreate(data);
        const post = await super.create(transformedData, tx);
        await this.afterCreate(post);
        return post;
    }

    /**
     * Override update to use hooks
     */
    async update(
        where: Record<string, unknown>,
        data: Partial<Post>,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Post | null> {
        const id = where.id as string;
        const transformedData = await this.beforeUpdate(id, data);
        return super.update(where, transformedData, tx);
    }

    /**
     * Override soft delete to use hooks
     */
    async softDelete(
        where: Record<string, unknown>,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<number> {
        const post = await this.findOne(where, tx);
        const count = await super.softDelete(where, tx);

        if (post && count > 0) {
            await this.afterSoftDelete(post);
        }

        return count;
    }
}

// ============================================================================
// 5. SINGLETON INSTANCE
// ============================================================================

export const postModel = new PostModel();

// ============================================================================
// 6. USAGE EXAMPLES
// ============================================================================

/**
 * USAGE EXAMPLES
 *
 * ============================================================================
 * EXAMPLE 1: Full-text search
 * ============================================================================
 *
 * ```ts
 * const results = await postModel.fullTextSearch({
 *   query: 'typescript database optimization',
 *   limit: 10
 * });
 *
 * console.log(`Found ${results.length} matching posts`);
 * results.forEach(post => {
 *   console.log(`- ${post.title} (${post.viewCount} views)`);
 * });
 * ```
 *
 * ============================================================================
 * EXAMPLE 2: Batch create posts
 * ============================================================================
 *
 * ```ts
 * const posts = Array.from({ length: 100 }, (_, i) => ({
 *   authorId: 'user-uuid',
 *   title: `Post ${i + 1}`,
 *   slug: `post-${i + 1}`,
 *   content: `Content for post ${i + 1}`,
 *   isPublished: true,
 * }));
 *
 * const result = await postModel.batchCreate({ posts });
 * console.log(`Successfully created ${result.created.length} posts`);
 * ```
 *
 * ============================================================================
 * EXAMPLE 3: Batch update with metrics
 * ============================================================================
 *
 * ```ts
 * const updates = [
 *   { id: 'post-1', data: { viewCount: 150, likeCount: 25 } },
 *   { id: 'post-2', data: { viewCount: 200, likeCount: 40 } },
 *   { id: 'post-3', data: { viewCount: 100, likeCount: 15 } },
 * ];
 *
 * const updated = await postModel.batchUpdate({ updates });
 * console.log(`Updated ${updated} posts`);
 * ```
 *
 * ============================================================================
 * EXAMPLE 4: Caching pattern
 * ============================================================================
 *
 * ```ts
 * // First call - database query
 * const start1 = Date.now();
 * const post1 = await postModel.findWithCache({ id: 'post-uuid' });
 * const time1 = Date.now() - start1;
 * console.log(`First call: ${time1}ms`);
 *
 * // Second call - from cache (much faster)
 * const start2 = Date.now();
 * const post2 = await postModel.findWithCache({ id: 'post-uuid' });
 * const time2 = Date.now() - start2;
 * console.log(`Second call: ${time2}ms (from cache)`);
 *
 * // Bypass cache when needed
 * const fresh = await postModel.findWithCache({
 *   id: 'post-uuid',
 *   bypassCache: true
 * });
 * ```
 *
 * ============================================================================
 * EXAMPLE 5: Popular and related posts
 * ============================================================================
 *
 * ```ts
 * // Get popular posts
 * const popular = await postModel.findPopular({ limit: 10 });
 * console.log('Popular posts:');
 * popular.forEach((post, i) => {
 *   console.log(`${i + 1}. ${post.title} - ${post.viewCount} views`);
 * });
 *
 * // Get related posts
 * const related = await postModel.getRelatedPosts({
 *   postId: 'post-uuid',
 *   limit: 5
 * });
 * console.log('\nRelated posts:');
 * related.forEach(post => {
 *   console.log(`- ${post.title}`);
 * });
 * ```
 *
 * ============================================================================
 * EXAMPLE 6: Performance optimization
 * ============================================================================
 *
 * ```ts
 * // Fast count estimation (for large tables)
 * const estimate = await postModel.countEstimate({});
 * console.log(`Approximately ${estimate} posts in database`);
 *
 * // Lazy loading for listing pages
 * const posts = await postModel.findLazy({
 *   filters: { isPublished: true }
 * });
 *
 * // Only loads id, title, slug, publishedAt (not full content)
 * posts.forEach(post => {
 *   console.log(`${post.title} (${post.slug})`);
 * });
 * ```
 *
 * ============================================================================
 * EXAMPLE 7: Lifecycle hooks
 * ============================================================================
 *
 * ```ts
 * // Hooks execute automatically during operations
 *
 * // Create with hooks (generates slug, excerpt, publishedAt)
 * const post = await postModel.create({
 *   authorId: 'user-uuid',
 *   title: 'My Awesome Post',
 *   // slug will be auto-generated: "my-awesome-post"
 *   content: 'This is the full content of my post...',
 *   // excerpt will be auto-generated from content
 *   isPublished: true,
 *   // publishedAt will be set to now
 * });
 *
 * console.log(post.slug); // "my-awesome-post"
 * console.log(post.excerpt); // First 200 chars + "..."
 * console.log(post.publishedAt); // Current timestamp
 *
 * // Update with hooks (invalidates cache, updates timestamps)
 * await postModel.update(
 *   { id: post.id },
 *   { viewCount: 100 }
 * );
 * // Cache for this post is now invalidated
 * // updatedAt is automatically set
 * ```
 */
