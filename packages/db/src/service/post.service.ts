import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, EntityTypeEnum, type UserType } from '@repo/types';
import {
    EntityTagModel,
    type EntityTagRecord,
    PostModel,
    type PostRecord,
    PostSponsorModel,
    type PostSponsorRecord
} from '../model';
import type {
    InsertEntityTagRelation,
    InsertPost,
    PaginationParams,
    SelectPostFilter,
    UpdatePostData,
    UpdatePostSponsorData
} from '../types/db-types';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils';

const log = logger.createLogger('PostService');

/**
 * Service layer for managing post operations.
 * Handles business logic, authorization, and interacts with the PostModel and related models.
 */
export class PostService {
    /**
     * Checks if the given actor is an admin.
     * @param actor - The user performing the action.
     * @returns true if the actor is an admin, false otherwise.
     */
    private static isAdmin(actor: UserType): boolean {
        return actor.roleId === BuiltinRoleTypeEnum.ADMIN;
    }

    /**
     * Asserts that the actor is either the author of the resource or an admin.
     * @param authorId - The ID of the resource author.
     * @param actor - The user performing the action.
     * @throws Error if the actor is neither the author nor an admin.
     */
    private static assertAuthorOrAdmin(authorId: string, actor: UserType): void {
        if (actor.id !== authorId && !PostService.isAdmin(actor)) {
            log.warn('Forbidden access attempt', 'assertAuthorOrAdmin', {
                actorId: actor.id,
                requiredAuthorId: authorId
            });
            throw new Error('Forbidden');
        }
    }

    /**
     * Asserts that the actor is an admin.
     * @param actor - The user performing the action.
     * @throws Error if the actor is not an admin.
     */
    private static assertAdmin(actor: UserType): void {
        if (!PostService.isAdmin(actor)) {
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new post.
     * @param data - The data for the new post.
     * @param actor - The user creating the post.
     * @returns The created post record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertPost, actor: UserType): Promise<PostRecord> {
        log.info('creating post', 'create', { actor: actor.id });

        try {
            const dataWithAudit: InsertPost = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdPost = await PostModel.createPost(dataWithAudit);
            log.info('post created successfully', 'create', { postId: createdPost.id });
            return createdPost;
        } catch (error) {
            log.error('failed to create post', 'create', error, { actor: actor.id });
            throw error;
        }
    }

    /**
     * Get a single post by ID.
     * @param id - The ID of the post to fetch.
     * @param actor - The user performing the action.
     * @returns The post record.
     * @throws Error if post is not found.
     */
    async getPostById(id: string, actor: UserType): Promise<PostRecord> {
        log.info('fetching post by id', 'getPostById', { postId: id, actor: actor.id });

        try {
            const post = await PostModel.getPostById(id);
            const existingPost = assertExists(post, `Post ${id} not found`);

            log.info('post fetched successfully', 'getPostById', { postId: existingPost.id });
            return existingPost;
        } catch (error) {
            log.error('failed to fetch post by id', 'getPostById', error, {
                postId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List posts with optional filters, pagination, and search.
     * @param filter - Filtering and pagination options.
     * @param actor - The user performing the action.
     * @returns Array of post records.
     * @throws Error if listing fails.
     */
    async listPosts(filter: SelectPostFilter, actor: UserType): Promise<PostRecord[]> {
        log.info('listing posts', 'listPosts', { filter, actor: actor.id });

        try {
            const posts = await PostModel.listPosts(filter);
            log.info('posts listed successfully', 'listPosts', {
                count: posts.length,
                filter
            });
            return posts;
        } catch (error) {
            log.error('failed to list posts', 'listPosts', error, { filter, actor: actor.id });
            throw error;
        }
    }

    /**
     * Update fields on an existing post.
     * @param id - The ID of the post to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action.
     * @returns The updated post record.
     * @throws Error if post is not found, actor is not authorized, or update fails.
     */
    async updatePost(id: string, changes: UpdatePostData, actor: UserType): Promise<PostRecord> {
        log.info('updating post', 'updatePost', { postId: id, actor: actor.id });

        const existingPost = await this.getPostById(id, actor);

        // Check if actor is author or admin
        PostService.assertAuthorOrAdmin(existingPost.createdById, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdatePostData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedPost = await PostModel.updatePost(existingPost.id, dataWithAudit);
            log.info('post updated successfully', 'updatePost', { postId: updatedPost.id });
            return updatedPost;
        } catch (error) {
            log.error('failed to update post', 'updatePost', error, {
                postId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Soft-delete a post by setting the deletedAt timestamp.
     * @param id - The ID of the post to delete.
     * @param actor - The user performing the action.
     * @throws Error if post is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        log.info('soft deleting post', 'delete', { postId: id, actor: actor.id });

        const existingPost = await this.getPostById(id, actor);

        // Check if actor is author or admin
        PostService.assertAuthorOrAdmin(existingPost.createdById, actor);

        try {
            await PostModel.softDeletePost(id);
            log.info('post soft deleted successfully', 'delete', { postId: id });
        } catch (error) {
            log.error('failed to soft delete post', 'delete', error, {
                postId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Restore a soft-deleted post by clearing the deletedAt timestamp.
     * @param id - The ID of the post to restore.
     * @param actor - The user performing the action.
     * @throws Error if post is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        log.info('restoring post', 'restore', { postId: id, actor: actor.id });

        const existingPost = await this.getPostById(id, actor);

        // Check if actor is author or admin
        PostService.assertAuthorOrAdmin(existingPost.createdById, actor);

        try {
            await PostModel.restorePost(id);
            log.info('post restored successfully', 'restore', { postId: id });
        } catch (error) {
            log.error('failed to restore post', 'restore', error, {
                postId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Permanently delete a post record from the database.
     * @param id - The ID of the post to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if post is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        log.info('hard deleting post', 'hardDelete', { postId: id, actor: actor.id });

        // Only admins can hard delete
        PostService.assertAdmin(actor);

        await this.getPostById(id, actor);

        try {
            await PostModel.hardDeletePost(id);
            log.info('post hard deleted successfully', 'hardDelete', { postId: id });
        } catch (error) {
            log.error('failed to hard delete post', 'hardDelete', error, {
                postId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get posts by category.
     * @param category - The category to filter by.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of post records with the specified category.
     * @throws Error if listing fails.
     */
    async getPostsByCategory(
        category: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PostRecord[]> {
        log.info('fetching posts by category', 'getPostsByCategory', {
            category,
            actor: actor.id,
            filter
        });

        try {
            const postFilter: SelectPostFilter = {
                category,
                ...filter,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(postFilter);
            log.info('posts fetched by category successfully', 'getPostsByCategory', {
                category,
                count: posts.length
            });
            return posts;
        } catch (error) {
            log.error('failed to fetch posts by category', 'getPostsByCategory', error, {
                category,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get posts by visibility.
     * @param visibility - The visibility to filter by.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of post records with the specified visibility.
     * @throws Error if listing fails.
     */
    async getPostsByVisibility(
        visibility: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PostRecord[]> {
        log.info('fetching posts by visibility', 'getPostsByVisibility', {
            visibility,
            actor: actor.id,
            filter
        });

        try {
            const postFilter: SelectPostFilter = {
                visibility,
                ...filter,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(postFilter);
            log.info('posts fetched by visibility successfully', 'getPostsByVisibility', {
                visibility,
                count: posts.length
            });
            return posts;
        } catch (error) {
            log.error('failed to fetch posts by visibility', 'getPostsByVisibility', error, {
                visibility,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Update a post sponsor.
     * @param sponsorId - The ID of the sponsor to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated sponsor record.
     * @throws Error if sponsor is not found, actor is not authorized, or update fails.
     */
    async updateSponsor(
        sponsorId: string,
        changes: UpdatePostSponsorData,
        actor: UserType
    ): Promise<PostSponsorRecord> {
        log.info('updating post sponsor', 'updateSponsor', {
            sponsorId,
            actor: actor.id
        });

        // Only admins can update sponsors
        PostService.assertAdmin(actor);

        try {
            // Check if sponsor exists
            const sponsor = await PostSponsorModel.getSponsorById(sponsorId);
            if (!sponsor) {
                throw new Error(`Sponsor ${sponsorId} not found`);
            }

            const dataToUpdate = sanitizePartialUpdate(changes);
            const dataWithAudit: UpdatePostSponsorData = {
                ...dataToUpdate,
                updatedById: actor.id
            };

            const updatedSponsor = await PostSponsorModel.updateSponsor(sponsorId, dataWithAudit);
            log.info('post sponsor updated successfully', 'updateSponsor', {
                sponsorId: updatedSponsor.id
            });
            return updatedSponsor;
        } catch (error) {
            log.error('failed to update post sponsor', 'updateSponsor', error, {
                sponsorId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Add a tag to a post.
     * @param postId - The ID of the post.
     * @param tagId - The ID of the tag.
     * @param actor - The user performing the action.
     * @returns The created entity-tag relation record.
     * @throws Error if post or tag is not found, actor is not authorized, or creation fails.
     */
    async addTag(postId: string, tagId: string, actor: UserType): Promise<EntityTagRecord> {
        log.info('adding tag to post', 'addTag', {
            postId,
            tagId,
            actor: actor.id
        });

        const existingPost = await this.getPostById(postId, actor);

        // Check if actor is author or admin
        PostService.assertAuthorOrAdmin(existingPost.createdById, actor);

        try {
            const relationData: InsertEntityTagRelation = {
                entityType: EntityTypeEnum.POST,
                entityId: postId,
                tagId
            };

            const relation = await EntityTagModel.createRelation(relationData);
            log.info('tag added to post successfully', 'addTag', {
                postId,
                tagId
            });
            return relation;
        } catch (error) {
            log.error('failed to add tag to post', 'addTag', error, {
                postId,
                tagId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Remove a tag from a post.
     * @param postId - The ID of the post.
     * @param tagId - The ID of the tag.
     * @param actor - The user performing the action.
     * @throws Error if post or tag is not found, actor is not authorized, or removal fails.
     */
    async removeTag(postId: string, tagId: string, actor: UserType): Promise<void> {
        log.info('removing tag from post', 'removeTag', {
            postId,
            tagId,
            actor: actor.id
        });

        const existingPost = await this.getPostById(postId, actor);

        // Check if actor is author or admin
        PostService.assertAuthorOrAdmin(existingPost.createdById, actor);

        try {
            await EntityTagModel.deleteRelation(EntityTypeEnum.POST, postId, tagId);
            log.info('tag removed from post successfully', 'removeTag', {
                postId,
                tagId
            });
        } catch (error) {
            log.error('failed to remove tag from post', 'removeTag', error, {
                postId,
                tagId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get posts within a date range.
     * @param startDate - The start date of the range.
     * @param endDate - The end date of the range.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of post records within the date range.
     * @throws Error if listing fails.
     */
    async getPostsByDateRange(
        startDate: Date,
        endDate: Date,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PostRecord[]> {
        log.info('getting posts by date range', 'getPostsByDateRange', {
            startDate,
            endDate,
            actor: actor.id,
            filter
        });

        try {
            // Get all active posts
            const allPosts = await PostModel.listPosts({
                ...filter,
                includeDeleted: false
            });

            // Filter for posts created within the date range
            const postsInRange = allPosts.filter((post) => {
                const createdAt = new Date(post.createdAt);
                return createdAt >= startDate && createdAt <= endDate;
            });

            // Sort by creation date (descending - newest first)
            postsInRange.sort((a, b) => {
                const dateA = new Date(a.createdAt);
                const dateB = new Date(b.createdAt);
                return dateB.getTime() - dateA.getTime();
            });

            log.info('posts in date range retrieved successfully', 'getPostsByDateRange', {
                count: postsInRange.length
            });
            return postsInRange;
        } catch (error) {
            log.error('failed to get posts by date range', 'getPostsByDateRange', error, {
                startDate,
                endDate,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get featured posts.
     * @param limit - The maximum number of posts to return.
     * @param actor - The user performing the action.
     * @returns Array of featured post records.
     * @throws Error if listing fails.
     */
    async getFeaturedPosts(limit: number, actor: UserType): Promise<PostRecord[]> {
        log.info('getting featured posts', 'getFeaturedPosts', {
            limit,
            actor: actor.id
        });

        try {
            const postFilter: SelectPostFilter = {
                isFeatured: true,
                limit,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(postFilter);
            log.info('featured posts retrieved successfully', 'getFeaturedPosts', {
                count: posts.length
            });
            return posts;
        } catch (error) {
            log.error('failed to get featured posts', 'getFeaturedPosts', error, {
                limit,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get news posts.
     * @param limit - The maximum number of posts to return.
     * @param actor - The user performing the action.
     * @returns Array of news post records.
     * @throws Error if listing fails.
     */
    async getNewsPosts(limit: number, actor: UserType): Promise<PostRecord[]> {
        log.info('getting news posts', 'getNewsPosts', {
            limit,
            actor: actor.id
        });

        try {
            const postFilter: SelectPostFilter = {
                isNews: true,
                limit,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(postFilter);
            log.info('news posts retrieved successfully', 'getNewsPosts', {
                count: posts.length
            });
            return posts;
        } catch (error) {
            log.error('failed to get news posts', 'getNewsPosts', error, {
                limit,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get posts related to a specific destination.
     * @param destinationId - The ID of the destination.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of post records related to the destination.
     * @throws Error if destination is not found or listing fails.
     */
    async getByRelatedDestination(
        destinationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PostRecord[]> {
        log.info('getting posts by related destination', 'getByRelatedDestination', {
            destinationId,
            actor: actor.id,
            filter
        });

        try {
            const postFilter: SelectPostFilter = {
                relatedDestinationId: destinationId,
                ...filter,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(postFilter);
            log.info(
                'posts by related destination retrieved successfully',
                'getByRelatedDestination',
                {
                    destinationId,
                    count: posts.length
                }
            );
            return posts;
        } catch (error) {
            log.error(
                'failed to get posts by related destination',
                'getByRelatedDestination',
                error,
                {
                    destinationId,
                    actor: actor.id
                }
            );
            throw error;
        }
    }

    /**
     * Get posts related to a specific accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of post records related to the accommodation.
     * @throws Error if accommodation is not found or listing fails.
     */
    async getByRelatedAccommodation(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PostRecord[]> {
        log.info('getting posts by related accommodation', 'getByRelatedAccommodation', {
            accommodationId,
            actor: actor.id,
            filter
        });

        try {
            const postFilter: SelectPostFilter = {
                relatedAccommodationId: accommodationId,
                ...filter,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(postFilter);
            log.info(
                'posts by related accommodation retrieved successfully',
                'getByRelatedAccommodation',
                {
                    accommodationId,
                    count: posts.length
                }
            );
            return posts;
        } catch (error) {
            log.error(
                'failed to get posts by related accommodation',
                'getByRelatedAccommodation',
                error,
                {
                    accommodationId,
                    actor: actor.id
                }
            );
            throw error;
        }
    }

    /**
     * Get posts related to a specific event.
     * @param eventId - The ID of the event.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of post records related to the event.
     * @throws Error if event is not found or listing fails.
     */
    async getByRelatedEvent(
        eventId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PostRecord[]> {
        log.info('getting posts by related event', 'getByRelatedEvent', {
            eventId,
            actor: actor.id,
            filter
        });

        try {
            const postFilter: SelectPostFilter = {
                relatedEventId: eventId,
                ...filter,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(postFilter);
            log.info('posts by related event retrieved successfully', 'getByRelatedEvent', {
                eventId,
                count: posts.length
            });
            return posts;
        } catch (error) {
            log.error('failed to get posts by related event', 'getByRelatedEvent', error, {
                eventId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get a single post by slug.
     * @param slug - The slug of the post to fetch.
     * @param actor - The user performing the action.
     * @returns The post record.
     * @throws Error if post is not found.
     */
    async getBySlug(slug: string, actor: UserType): Promise<PostRecord> {
        log.info('fetching post by slug', 'getBySlug', {
            slug,
            actor: actor.id
        });

        try {
            // Use the listPosts method with a filter for the slug
            const posts = await PostModel.listPosts({
                query: slug, // This will search in title, summary, content, and slug
                limit: 1,
                includeDeleted: false
            });

            // Find the exact match for slug
            const post = posts.find((p) => p.slug === slug);
            const existingPost = assertExists(post, `Post with slug '${slug}' not found`);

            log.info('post fetched by slug successfully', 'getBySlug', {
                postId: existingPost.id,
                slug
            });
            return existingPost;
        } catch (error) {
            log.error('failed to fetch post by slug', 'getBySlug', error, {
                slug,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Search posts by text.
     * @param query - The search query.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of matching post records.
     * @throws Error if search fails.
     */
    async searchPosts(
        query: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PostRecord[]> {
        log.info('searching posts', 'searchPosts', {
            query,
            actor: actor.id,
            filter
        });

        try {
            const searchFilter: SelectPostFilter = {
                query,
                ...filter,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(searchFilter);
            log.info('posts search completed successfully', 'searchPosts', {
                query,
                count: posts.length
            });
            return posts;
        } catch (error) {
            log.error('failed to search posts', 'searchPosts', error, {
                query,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get draft posts.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of draft post records.
     * @throws Error if listing fails.
     */
    async getDrafts(actor: UserType, filter: PaginationParams = {}): Promise<PostRecord[]> {
        log.info('getting draft posts', 'getDrafts', {
            actor: actor.id,
            filter
        });

        try {
            const postFilter: SelectPostFilter = {
                visibility: 'DRAFT',
                ...filter,
                includeDeleted: false
            };

            // If not admin, only show drafts created by the actor
            if (!PostService.isAdmin(actor)) {
                postFilter.createdById = actor.id;
            }

            const posts = await PostModel.listPosts(postFilter);
            log.info('draft posts retrieved successfully', 'getDrafts', {
                count: posts.length
            });
            return posts;
        } catch (error) {
            log.error('failed to get draft posts', 'getDrafts', error, {
                actor: actor.id
            });
            throw error;
        }
    }
}
