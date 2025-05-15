import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    PostModel,
    type PostRecord,
    PostSponsorModel,
    type PostSponsorRecord,
    PostSponsorshipModel,
    type PostSponsorshipRecord
} from '../model';
import type {
    InsertPostSponsor,
    InsertPostSponsorship,
    PaginationParams,
    SelectPostSponsorFilter,
    SelectPostSponsorshipFilter,
    UpdatePostSponsorData
} from '../types/db-types';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils';

const log = logger.createLogger('PostSponsorService');

/**
 * Service layer for managing post sponsor operations.
 * Handles business logic, authorization, and interacts with the PostSponsorModel and related models.
 */
export class PostSponsorService {
    /**
     * Checks if the given actor is an admin.
     * @param actor - The user performing the action.
     * @returns true if the actor is an admin, false otherwise.
     */
    private static isAdmin(actor: UserType): boolean {
        return actor.roleId === BuiltinRoleTypeEnum.ADMIN;
    }

    /**
     * Asserts that the actor is an admin.
     * @param actor - The user performing the action.
     * @throws Error if the actor is not an admin.
     */
    private static assertAdmin(actor: UserType): void {
        if (!PostSponsorService.isAdmin(actor)) {
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new post sponsor.
     * @param data - The data for the new sponsor.
     * @param actor - The user creating the sponsor (must be an admin).
     * @returns The created sponsor record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertPostSponsor, actor: UserType): Promise<PostSponsorRecord> {
        log.info('creating post sponsor', 'create', { actor: actor.id });

        // Only admins can create sponsors
        PostSponsorService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertPostSponsor = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdSponsor = await PostSponsorModel.createSponsor(dataWithAudit);
            log.info('post sponsor created successfully', 'create', {
                sponsorId: createdSponsor.id
            });
            return createdSponsor;
        } catch (error) {
            log.error('failed to create post sponsor', 'create', error, { actor: actor.id });
            throw error;
        }
    }

    /**
     * Get a single sponsor by ID.
     * @param id - The ID of the sponsor to fetch.
     * @param actor - The user performing the action.
     * @returns The sponsor record.
     * @throws Error if sponsor is not found.
     */
    async getById(id: string, actor: UserType): Promise<PostSponsorRecord> {
        log.info('fetching sponsor by id', 'getById', { sponsorId: id, actor: actor.id });

        try {
            const sponsor = await PostSponsorModel.getSponsorById(id);
            const existingSponsor = assertExists(sponsor, `Sponsor ${id} not found`);

            log.info('sponsor fetched successfully', 'getById', { sponsorId: existingSponsor.id });
            return existingSponsor;
        } catch (error) {
            log.error('failed to fetch sponsor by id', 'getById', error, {
                sponsorId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List sponsors with optional filters, pagination, and search.
     * @param filter - Filtering and pagination options.
     * @param actor - The user performing the action.
     * @returns Array of sponsor records.
     * @throws Error if listing fails.
     */
    async list(filter: SelectPostSponsorFilter, actor: UserType): Promise<PostSponsorRecord[]> {
        log.info('listing sponsors', 'list', { filter, actor: actor.id });

        try {
            const sponsors = await PostSponsorModel.listSponsors(filter);
            log.info('sponsors listed successfully', 'list', {
                count: sponsors.length,
                filter
            });
            return sponsors;
        } catch (error) {
            log.error('failed to list sponsors', 'list', error, { filter, actor: actor.id });
            throw error;
        }
    }

    /**
     * Update fields on an existing sponsor.
     * @param id - The ID of the sponsor to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated sponsor record.
     * @throws Error if sponsor is not found, actor is not authorized, or update fails.
     */
    async update(
        id: string,
        changes: UpdatePostSponsorData,
        actor: UserType
    ): Promise<PostSponsorRecord> {
        log.info('updating sponsor', 'update', { sponsorId: id, actor: actor.id });

        // Only admins can update sponsors
        PostSponsorService.assertAdmin(actor);

        const existingSponsor = await this.getById(id, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdatePostSponsorData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedSponsor = await PostSponsorModel.updateSponsor(
                existingSponsor.id,
                dataWithAudit
            );
            log.info('sponsor updated successfully', 'update', { sponsorId: updatedSponsor.id });
            return updatedSponsor;
        } catch (error) {
            log.error('failed to update sponsor', 'update', error, {
                sponsorId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Soft-delete a sponsor by setting the deletedAt timestamp.
     * @param id - The ID of the sponsor to delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if sponsor is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        log.info('soft deleting sponsor', 'delete', { sponsorId: id, actor: actor.id });

        // Only admins can delete sponsors
        PostSponsorService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await PostSponsorModel.softDeleteSponsor(id);
            log.info('sponsor soft deleted successfully', 'delete', { sponsorId: id });
        } catch (error) {
            log.error('failed to soft delete sponsor', 'delete', error, {
                sponsorId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Restore a soft-deleted sponsor by clearing the deletedAt timestamp.
     * @param id - The ID of the sponsor to restore.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if sponsor is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        log.info('restoring sponsor', 'restore', { sponsorId: id, actor: actor.id });

        // Only admins can restore sponsors
        PostSponsorService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await PostSponsorModel.restoreSponsor(id);
            log.info('sponsor restored successfully', 'restore', { sponsorId: id });
        } catch (error) {
            log.error('failed to restore sponsor', 'restore', error, {
                sponsorId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Permanently delete a sponsor record from the database.
     * @param id - The ID of the sponsor to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if sponsor is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        log.info('hard deleting sponsor', 'hardDelete', { sponsorId: id, actor: actor.id });

        // Only admins can hard delete
        PostSponsorService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await PostSponsorModel.hardDeleteSponsor(id);
            log.info('sponsor hard deleted successfully', 'hardDelete', { sponsorId: id });
        } catch (error) {
            log.error('failed to hard delete sponsor', 'hardDelete', error, {
                sponsorId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get sponsors for a specific post.
     * @param postId - The ID of the post.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of sponsorship records for the post.
     * @throws Error if post is not found or listing fails.
     */
    async getByPostId(
        postId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PostSponsorshipRecord[]> {
        log.info('getting sponsors by post id', 'getByPostId', {
            postId,
            actor: actor.id,
            filter
        });

        try {
            // Check if post exists
            const post = await PostModel.getPostById(postId);
            if (!post) {
                throw new Error(`Post ${postId} not found`);
            }

            const sponsorshipFilter: SelectPostSponsorshipFilter = {
                postId,
                ...filter,
                includeDeleted: false
            };

            const sponsorships = await PostSponsorshipModel.listSponsorships(sponsorshipFilter);
            log.info('sponsors by post id retrieved successfully', 'getByPostId', {
                postId,
                count: sponsorships.length
            });
            return sponsorships;
        } catch (error) {
            log.error('failed to get sponsors by post id', 'getByPostId', error, {
                postId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Assign a sponsor to a post by creating a sponsorship.
     * @param postId - The ID of the post.
     * @param sponsorId - The ID of the sponsor.
     * @param sponsorshipData - Additional sponsorship data.
     * @param actor - The user performing the action (must be an admin).
     * @returns The created sponsorship record.
     * @throws Error if post or sponsor is not found, actor is not authorized, or creation fails.
     */
    async assignToPost(
        postId: string,
        sponsorId: string,
        sponsorshipData: Omit<
            InsertPostSponsorship,
            'postId' | 'sponsorId' | 'createdById' | 'updatedById'
        >,
        actor: UserType
    ): Promise<PostSponsorshipRecord> {
        log.info('assigning sponsor to post', 'assignToPost', {
            postId,
            sponsorId,
            actor: actor.id
        });

        // Only admins can assign sponsors
        PostSponsorService.assertAdmin(actor);

        // Check if post exists
        const post = await PostModel.getPostById(postId);
        if (!post) {
            throw new Error(`Post ${postId} not found`);
        }

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
            log.info('sponsor assigned to post successfully', 'assignToPost', {
                postId,
                sponsorId,
                sponsorshipId: sponsorship.id
            });
            return sponsorship;
        } catch (error) {
            log.error('failed to assign sponsor to post', 'assignToPost', error, {
                postId,
                sponsorId,
                actor: actor.id
            });
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
    async removeFromPost(postId: string, sponsorId: string, actor: UserType): Promise<void> {
        log.info('removing sponsor from post', 'removeFromPost', {
            postId,
            sponsorId,
            actor: actor.id
        });

        // Only admins can remove sponsors
        PostSponsorService.assertAdmin(actor);

        try {
            // Find the sponsorship(s)
            const sponsorships = await PostSponsorshipModel.listSponsorships({
                postId,
                sponsorId,
                includeDeleted: false
            });

            if (sponsorships.length === 0) {
                throw new Error(`No sponsorship found for post ${postId} and sponsor ${sponsorId}`);
            }

            // Delete each sponsorship (should typically be one, but handling multiple to be safe)
            for (const sponsorship of sponsorships) {
                await PostSponsorshipModel.softDeleteSponsorship(sponsorship.id);
            }

            log.info('sponsor removed from post successfully', 'removeFromPost', {
                postId,
                sponsorId
            });
        } catch (error) {
            log.error('failed to remove sponsor from post', 'removeFromPost', error, {
                postId,
                sponsorId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List posts sponsored by a specific sponsor.
     * @param sponsorId - The ID of the sponsor.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of post records sponsored by the sponsor.
     * @throws Error if sponsor is not found or listing fails.
     */
    async listPosts(
        sponsorId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PostRecord[]> {
        log.info('listing posts by sponsor id', 'listPosts', {
            sponsorId,
            actor: actor.id,
            filter
        });

        try {
            // Check if sponsor exists
            const sponsor = await PostSponsorModel.getSponsorById(sponsorId);
            if (!sponsor) {
                throw new Error(`Sponsor ${sponsorId} not found`);
            }

            // Get sponsorships for this sponsor
            const sponsorships = await PostSponsorshipModel.listSponsorships({
                sponsorId,
                includeDeleted: false
            });

            // Get the post IDs from sponsorships
            const postIds = sponsorships.map((s) => s.postId);

            // If no sponsorships, return empty array
            if (postIds.length === 0) {
                return [];
            }

            // Get all posts with these IDs
            const posts: PostRecord[] = [];
            for (const postId of postIds) {
                const post = await PostModel.getPostById(postId);
                if (post && !post.deletedAt) {
                    posts.push(post);
                }
            }

            // Apply pagination manually
            const offset = filter.offset || 0;
            const limit = filter.limit || 20;
            const paginatedPosts = posts.slice(offset, offset + limit);

            log.info('posts by sponsor id listed successfully', 'listPosts', {
                sponsorId,
                count: paginatedPosts.length
            });
            return paginatedPosts;
        } catch (error) {
            log.error('failed to list posts by sponsor id', 'listPosts', error, {
                sponsorId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get active sponsors (sponsors with active sponsorships).
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of active sponsor records.
     * @throws Error if listing fails.
     */
    async getActive(actor: UserType, filter: PaginationParams = {}): Promise<PostSponsorRecord[]> {
        log.info('getting active sponsors', 'getActive', { actor: actor.id, filter });

        try {
            // Get all active sponsorships
            const now = new Date();
            const activeSponsorships = await PostSponsorshipModel.listSponsorships({
                includeDeleted: false
            });

            // Filter for sponsorships that are currently active based on dates
            const currentlyActive = activeSponsorships.filter((sponsorship) => {
                // If no date range specified, consider it always active
                if (!sponsorship.fromDate && !sponsorship.toDate) {
                    return true;
                }

                // If only fromDate specified, check if it's in the past
                if (sponsorship.fromDate && !sponsorship.toDate) {
                    return new Date(sponsorship.fromDate) <= now;
                }

                // If only toDate specified, check if it's in the future
                if (!sponsorship.fromDate && sponsorship.toDate) {
                    return new Date(sponsorship.toDate) >= now;
                }

                // If both dates specified, check if current date is within range
                if (sponsorship.fromDate && sponsorship.toDate) {
                    return (
                        new Date(sponsorship.fromDate) <= now && new Date(sponsorship.toDate) >= now
                    );
                }

                return false;
            });

            // Get unique sponsor IDs
            const sponsorIds = [...new Set(currentlyActive.map((s) => s.sponsorId))];

            // Get the actual sponsor records
            const sponsors: PostSponsorRecord[] = [];
            for (const sponsorId of sponsorIds) {
                const sponsor = await PostSponsorModel.getSponsorById(sponsorId);
                if (sponsor && !sponsor.deletedAt) {
                    sponsors.push(sponsor);
                }
            }

            // Apply pagination manually
            const offset = filter.offset || 0;
            const limit = filter.limit || 20;
            const paginatedSponsors = sponsors.slice(offset, offset + limit);

            log.info('active sponsors retrieved successfully', 'getActive', {
                count: paginatedSponsors.length
            });
            return paginatedSponsors;
        } catch (error) {
            log.error('failed to get active sponsors', 'getActive', error, {
                actor: actor.id
            });
            throw error;
        }
    }
}
