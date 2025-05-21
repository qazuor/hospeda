import { dbLogger } from '@repo/db/utils/logger.js';
import { BuiltinRoleTypeEnum, EntityTypeEnum, type UserType } from '@repo/types';
import {
    EntityTagModel,
    type EntityTagRecord,
    PostModel,
    type PostRecord,
    PostSponsorModel,
    PostSponsorshipModel,
    type PostSponsorshipRecord
} from '../model/index.js';
import type {
    InsertEntityTagRelation,
    InsertPost,
    InsertPostSponsorship,
    PaginationParams,
    SelectPostFilter,
    UpdatePostData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

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
            dbLogger.warn(
                {
                    actorId: actor.id,
                    requiredAuthorId: authorId
                },
                'Forbidden access attempt'
            );
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
            dbLogger.warn({ actorId: actor.id }, 'Admin access required');
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
        dbLogger.info({ actor: actor.id }, 'creating post');

        try {
            const dataWithAudit: InsertPost = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdPost = await PostModel.createPost(dataWithAudit);
            dbLogger.info({ postId: createdPost.id }, 'post created successfully');
            return createdPost;
        } catch (error) {
            dbLogger.error(error, 'failed to create post');
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
    async getById(id: string, actor: UserType): Promise<PostRecord> {
        dbLogger.info({ postId: id, actor: actor.id }, 'fetching post by id');

        try {
            const post = await PostModel.getPostById(id);
            const existingPost = assertExists(post, `Post ${id} not found`);

            dbLogger.info({ postId: existingPost.id }, 'post fetched successfully');
            return existingPost;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch post by id');
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
    async list(filter: SelectPostFilter, actor: UserType): Promise<PostRecord[]> {
        dbLogger.info({ filter, actor: actor.id }, 'listing posts');

        try {
            const posts = await PostModel.listPosts(filter);
            dbLogger.info({ count: posts.length, filter }, 'posts listed successfully');
            return posts;
        } catch (error) {
            dbLogger.error(error, 'failed to list posts');
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
    async update(id: string, changes: UpdatePostData, actor: UserType): Promise<PostRecord> {
        dbLogger.info({ postId: id, actor: actor.id }, 'updating post');

        const existingPost = await this.getById(id, actor);

        // Check if actor is author or admin
        PostService.assertAuthorOrAdmin(existingPost.createdById, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdatePostData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedPost = await PostModel.updatePost(existingPost.id, dataWithAudit);
            dbLogger.info({ postId: updatedPost.id }, 'post updated successfully');
            return updatedPost;
        } catch (error) {
            dbLogger.error(error, 'failed to update post');
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
        dbLogger.info({ postId: id, actor: actor.id }, 'soft deleting post');

        const existingPost = await this.getById(id, actor);

        // Check if actor is author or admin
        PostService.assertAuthorOrAdmin(existingPost.createdById, actor);

        try {
            await PostModel.softDeletePost(id);
            dbLogger.info({ postId: id }, 'post soft deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete post');
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
        dbLogger.info({ postId: id, actor: actor.id }, 'restoring post');

        const existingPost = await this.getById(id, actor);

        // Check if actor is author or admin
        PostService.assertAuthorOrAdmin(existingPost.createdById, actor);

        try {
            await PostModel.restorePost(id);
            dbLogger.info({ postId: id }, 'post restored successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to restore post');
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
        dbLogger.info({ postId: id, actor: actor.id }, 'hard deleting post');

        // Only admins can hard delete
        PostService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await PostModel.hardDeletePost(id);
            dbLogger.info({ postId: id }, 'post hard deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete post');
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
    async getByCategory(
        category: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PostRecord[]> {
        dbLogger.info({ category, actor: actor.id, filter }, 'fetching posts by category');

        try {
            const postFilter: SelectPostFilter = {
                category,
                ...filter,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(postFilter);
            dbLogger.info(
                { category, count: posts.length },
                'posts fetched by category successfully'
            );
            return posts;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch posts by category');
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
    async getByVisibility(
        visibility: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PostRecord[]> {
        dbLogger.info({ visibility, actor: actor.id, filter }, 'fetching posts by visibility');

        try {
            const postFilter: SelectPostFilter = {
                visibility,
                ...filter,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(postFilter);
            dbLogger.info(
                { visibility, count: posts.length },
                'posts fetched by visibility successfully'
            );
            return posts;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch posts by visibility');
            throw error;
        }
    }

    /**
     * Assign a sponsor to a post by creating a sponsorship.
     * @param postId - The ID of the post.
     * @param sponsorId - The ID of the sponsor.
     * @param sponsorshipData - The sponsorship data.
     * @param actor - The user performing the action (must be an admin).
     * @returns The created sponsorship record.
     * @throws Error if post or sponsor is not found, actor is not authorized, or creation fails.
     */
    async addSponsor(
        postId: string,
        sponsorId: string,
        sponsorshipData: Omit<
            InsertPostSponsorship,
            'postId' | 'sponsorId' | 'createdById' | 'updatedById'
        >,
        actor: UserType
    ): Promise<PostSponsorshipRecord> {
        dbLogger.info({ postId, sponsorId, actor: actor.id }, 'adding sponsor to post');

        // Only admins can assign sponsors
        PostService.assertAdmin(actor);

        // Check if post exists
        const _post = await this.getById(postId, actor);

        // Check if sponsor exists
        const sponsor = await PostSponsorModel.getSponsorById(sponsorId);
        if (!sponsor) {
            throw new Error(`Sponsor ${sponsorId} not found`);
        }

        try {
            const sponsorshipDataWithIds: InsertPostSponsorship = {
                ...sponsorshipData,
                postId,
                sponsorId,
                createdById: actor.id,
                updatedById: actor.id
            };

            const sponsorship =
                await PostSponsorshipModel.createSponsorship(sponsorshipDataWithIds);
            dbLogger.info(
                { postId, sponsorId, sponsorshipId: sponsorship.id },
                'sponsor added to post successfully'
            );
            return sponsorship;
        } catch (error) {
            dbLogger.error(error, 'failed to add sponsor to post');
            throw error;
        }
    }

    /**
     * Remove a sponsor from a post by deleting the sponsorship.
     * @param postId - The ID of the post.
     * @param sponsorId - The ID of the sponsor to remove.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if post or sponsor is not found, actor is not authorized, or deletion fails.
     */
    async removeSponsor(postId: string, sponsorId: string, actor: UserType): Promise<void> {
        dbLogger.info({ postId, sponsorId, actor: actor.id }, 'removing sponsor from post');

        // Only admins can remove sponsors
        PostService.assertAdmin(actor);

        try {
            // Find the sponsorship
            const sponsorships = await PostSponsorshipModel.listSponsorships({
                postId,
                sponsorId,
                includeDeleted: false
            });

            if (sponsorships.length === 0) {
                throw new Error(`No sponsorship found for post ${postId} and sponsor ${sponsorId}`);
            }

            // Delete each sponsorship (should be only one, but just in case)
            for (const sponsorship of sponsorships) {
                await PostSponsorshipModel.softDeleteSponsorship(sponsorship.id);
            }

            dbLogger.info({ postId, sponsorId }, 'sponsor removed from post successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to remove sponsor from post');
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
        dbLogger.info({ postId, tagId, actor: actor.id }, 'adding tag to post');

        const existingPost = await this.getById(postId, actor);

        // Check if actor is author or admin
        PostService.assertAuthorOrAdmin(existingPost.createdById, actor);

        try {
            const relationData: InsertEntityTagRelation = {
                entityType: EntityTypeEnum.POST,
                entityId: postId,
                tagId
            };

            const relation = await EntityTagModel.createRelation(relationData);
            dbLogger.info({ postId, tagId }, 'tag added to post successfully');
            return relation;
        } catch (error) {
            dbLogger.error(error, 'failed to add tag to post');
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
        dbLogger.info({ postId, tagId, actor: actor.id }, 'removing tag from post');

        const existingPost = await this.getById(postId, actor);

        // Check if actor is author or admin
        PostService.assertAuthorOrAdmin(existingPost.createdById, actor);

        try {
            await EntityTagModel.deleteRelation(EntityTypeEnum.POST, postId, tagId);
            dbLogger.info({ postId, tagId }, 'tag removed from post successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to remove tag from post');
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
    async getByDateRange(
        startDate: Date,
        endDate: Date,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PostRecord[]> {
        dbLogger.info(
            { startDate, endDate, actor: actor.id, filter },
            'getting posts by date range'
        );

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

            dbLogger.info(
                { count: postsInRange.length },
                'posts in date range retrieved successfully'
            );
            return postsInRange;
        } catch (error) {
            dbLogger.error(error, 'failed to get posts by date range');
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
    async getFeatured(limit: number, actor: UserType): Promise<PostRecord[]> {
        dbLogger.info({ limit, actor: actor.id }, 'getting featured posts');

        try {
            const postFilter: SelectPostFilter = {
                isFeatured: true,
                limit,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(postFilter);
            dbLogger.info({ count: posts.length }, 'featured posts retrieved successfully');
            return posts;
        } catch (error) {
            dbLogger.error(error, 'failed to get featured posts');
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
    async getNews(limit: number, actor: UserType): Promise<PostRecord[]> {
        dbLogger.info({ limit, actor: actor.id }, 'getting news posts');

        try {
            const postFilter: SelectPostFilter = {
                isNews: true,
                limit,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(postFilter);
            dbLogger.info({ count: posts.length }, 'news posts retrieved successfully');
            return posts;
        } catch (error) {
            dbLogger.error(error, 'failed to get news posts');
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
        dbLogger.info(
            { destinationId, actor: actor.id, filter },
            'getting posts by related destination'
        );

        try {
            const postFilter: SelectPostFilter = {
                relatedDestinationId: destinationId,
                ...filter,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(postFilter);
            dbLogger.info(
                { destinationId, count: posts.length },
                'posts by related destination retrieved successfully'
            );
            return posts;
        } catch (error) {
            dbLogger.error(error, 'failed to get posts by related destination');
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
        dbLogger.info(
            { accommodationId, actor: actor.id, filter },
            'getting posts by related accommodation'
        );

        try {
            const postFilter: SelectPostFilter = {
                relatedAccommodationId: accommodationId,
                ...filter,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(postFilter);
            dbLogger.info(
                { accommodationId, count: posts.length },
                'posts by related accommodation retrieved successfully'
            );
            return posts;
        } catch (error) {
            dbLogger.error(error, 'failed to get posts by related accommodation');
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
        dbLogger.info({ eventId, actor: actor.id, filter }, 'getting posts by related event');

        try {
            const postFilter: SelectPostFilter = {
                relatedEventId: eventId,
                ...filter,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(postFilter);
            dbLogger.info(
                { eventId, count: posts.length },
                'posts by related event retrieved successfully'
            );
            return posts;
        } catch (error) {
            dbLogger.error(error, 'failed to get posts by related event');
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
        dbLogger.info({ slug, actor: actor.id }, 'fetching post by slug');

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

            dbLogger.info({ postId: existingPost.id, slug }, 'post fetched by slug successfully');
            return existingPost;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch post by slug');
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
    async search(
        query: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PostRecord[]> {
        dbLogger.info({ query, actor: actor.id, filter }, 'searching posts');

        try {
            const searchFilter: SelectPostFilter = {
                query,
                ...filter,
                includeDeleted: false
            };

            const posts = await PostModel.listPosts(searchFilter);
            dbLogger.info({ query, count: posts.length }, 'posts search completed successfully');
            return posts;
        } catch (error) {
            dbLogger.error(error, 'failed to search posts');
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
        dbLogger.info({ actor: actor.id, filter }, 'getting draft posts');

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
            dbLogger.info({ count: posts.length }, 'draft posts retrieved successfully');
            return posts;
        } catch (error) {
            dbLogger.error(error, 'failed to get draft posts');
            throw error;
        }
    }
}
