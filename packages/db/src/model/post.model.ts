import { logger } from '@repo/logger';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../client';
import { posts } from '../schema/post.dbschema';
import type { InsertPost, SelectPostFilter, UpdatePostData } from '../types/db-types';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils';

/**
 * Scoped logger for post model operations.
 */
const log = logger.createLogger('PostModel');

/**
 * Full post record as returned by the database.
 */
export type PostRecord = InferSelectModel<typeof posts>;

/**
 * PostModel provides CRUD operations for the posts table.
 */
export const PostModel = {
    /**
     * Create a new post record.
     *
     * @param data - Fields required to create the post (InsertPost type from db-types)
     * @returns The created post record
     */
    async createPost(data: InsertPost): Promise<PostRecord> {
        try {
            log.info('creating a new post', 'createPost', data);
            const rows = castReturning<PostRecord>(await db.insert(posts).values(data).returning());
            const post = assertExists(rows[0], 'createPost: no record returned');
            log.query('insert', 'posts', data, post);
            return post;
        } catch (error) {
            log.error('createPost failed', 'createPost', error);
            throw error;
        }
    },

    /**
     * Fetch a single post by ID.
     *
     * @param id - UUID of the post
     * @returns The post record or undefined if not found
     */
    async getPostById(id: string): Promise<PostRecord | undefined> {
        try {
            log.info('fetching post by id', 'getPostById', { id });
            const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
            log.query('select', 'posts', { id }, post);
            return post ? (post as PostRecord) : undefined;
        } catch (error) {
            log.error('getPostById failed', 'getPostById', error);
            throw error;
        }
    },

    /**
     * List posts with optional filters, pagination, and search.
     *
     * @param filter - Pagination and filtering options (SelectPostFilter type from db-types)
     * @returns Array of post records
     */
    async listPosts(filter: SelectPostFilter): Promise<PostRecord[]> {
        try {
            log.info('listing posts', 'listPosts', filter);
            let query = db.select().from(posts).$dynamic();

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                query = query.where(
                    or(
                        ilike(posts.title, term),
                        ilike(posts.summary, term),
                        ilike(posts.content, term)
                    )
                );
            }

            if (filter.category) {
                query = query.where(eq(posts.category, filter.category));
            }

            if (filter.visibility) {
                query = query.where(eq(posts.visibility, filter.visibility));
            }

            if (filter.sponsorshipId) {
                query = query.where(eq(posts.sponsorshipId, filter.sponsorshipId));
            }

            if (filter.relatedAccommodationId) {
                query = query.where(
                    eq(posts.relatedAccommodationId, filter.relatedAccommodationId)
                );
            }

            if (filter.relatedDestinationId) {
                query = query.where(eq(posts.relatedDestinationId, filter.relatedDestinationId));
            }

            if (filter.relatedEventId) {
                query = query.where(eq(posts.relatedEventId, filter.relatedEventId));
            }

            if (typeof filter.isFeatured === 'boolean') {
                query = query.where(eq(posts.isFeatured, filter.isFeatured));
            }

            if (typeof filter.isNews === 'boolean') {
                query = query.where(eq(posts.isNews, filter.isNews));
            }

            if (typeof filter.isFeaturedInWebsite === 'boolean') {
                query = query.where(eq(posts.isFeaturedInWebsite, filter.isFeaturedInWebsite));
            }

            if (filter.state) {
                // Using inherited 'state' filter
                query = query.where(eq(posts.state, filter.state));
            }

            if (filter.createdById) {
                // Added createdById filter
                query = query.where(eq(posts.createdById, filter.createdById));
            }
            if (filter.updatedById) {
                // Added updatedById filter
                query = query.where(eq(posts.updatedById, filter.updatedById));
            }
            if (filter.deletedById) {
                // Added deletedById filter
                query = query.where(eq(posts.deletedById, filter.deletedById));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(posts.deletedAt));
            }

            // Use the getOrderByColumn utility
            const orderByColumn = getOrderByColumn(posts, filter.orderBy, posts.createdAt);
            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as PostRecord[];

            log.query('select', 'posts', filter, rows);
            return rows;
        } catch (error) {
            log.error('listPosts failed', 'listPosts', error);
            throw error;
        }
    },

    /**
     * Update fields on an existing post.
     *
     * @param id - UUID of the post to update
     * @param changes - Partial fields to update (UpdatePostData type from db-types)
     * @returns The updated post record
     */
    async updatePost(id: string, changes: UpdatePostData): Promise<PostRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating post', 'updatePost', { id, dataToUpdate });
            const rows = castReturning<PostRecord>(
                await db.update(posts).set(dataToUpdate).where(eq(posts.id, id)).returning()
            );
            const updated = assertExists(rows[0], `updatePost: no post found for id ${id}`);
            log.query('update', 'posts', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updatePost failed', 'updatePost', error);
            throw error;
        }
    },

    /**
     * Soft-delete a post by setting the deletedAt timestamp.
     *
     * @param id - UUID of the post
     */
    async softDeletePost(id: string): Promise<void> {
        try {
            log.info('soft deleting post', 'softDeletePost', { id });
            await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, id));
            log.query('update', 'posts', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeletePost failed', 'softDeletePost', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted post by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the post
     */
    async restorePost(id: string): Promise<void> {
        try {
            log.info('restoring post', 'restorePost', { id });
            await db.update(posts).set({ deletedAt: null }).where(eq(posts.id, id));
            log.query('update', 'posts', { id }, { restored: true });
        } catch (error) {
            log.error('restorePost failed', 'restorePost', error);
            throw error;
        }
    },

    /**
     * Permanently delete a post record from the database.
     *
     * @param id - UUID of the post
     */
    async hardDeletePost(id: string): Promise<void> {
        try {
            log.info('hard deleting post', 'hardDeletePost', { id });
            await db.delete(posts).where(eq(posts.id, id));
            log.query('delete', 'posts', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeletePost failed', 'hardDeletePost', error);
            throw error;
        }
    }
};
