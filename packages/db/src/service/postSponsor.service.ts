import { dbLogger } from '@repo/db/utils/logger.js';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    PostModel,
    type PostRecord,
    PostSponsorModel,
    type PostSponsorRecord,
    PostSponsorshipModel,
    type PostSponsorshipRecord
} from '../model/index.js';
import type {
    InsertPostSponsor,
    InsertPostSponsorship,
    PaginationParams,
    SelectPostSponsorFilter,
    SelectPostSponsorshipFilter,
    UpdatePostSponsorData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

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
            dbLogger.warn({ actorId: actor.id }, 'Admin access required');
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
        dbLogger.info({ actor: actor.id }, 'creating post sponsor');

        // Only admins can create sponsors
        PostSponsorService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertPostSponsor = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdSponsor = await PostSponsorModel.createSponsor(dataWithAudit);
            dbLogger.info(
                {
                    sponsorId: createdSponsor.id
                },
                'post sponsor created successfully'
            );
            return createdSponsor;
        } catch (error) {
            dbLogger.error(error, 'failed to create post sponsor');
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
        dbLogger.info({ sponsorId: id, actor: actor.id }, 'fetching sponsor by id');

        try {
            const sponsor = await PostSponsorModel.getSponsorById(id);
            const existingSponsor = assertExists(sponsor, `Sponsor ${id} not found`);

            dbLogger.info(
                {
                    sponsorId: existingSponsor.id
                },
                'sponsor fetched successfully'
            );
            return existingSponsor;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch sponsor by id');
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
        dbLogger.info({ filter, actor: actor.id }, 'listing sponsors');

        try {
            const sponsors = await PostSponsorModel.listSponsors(filter);
            dbLogger.info(
                {
                    count: sponsors.length,
                    filter
                },
                'sponsors listed successfully'
            );
            return sponsors;
        } catch (error) {
            dbLogger.error(error, 'failed to list sponsors');
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
        dbLogger.info({ sponsorId: id, actor: actor.id }, 'updating sponsor');

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
            dbLogger.info(
                {
                    sponsorId: updatedSponsor.id
                },
                'sponsor updated successfully'
            );
            return updatedSponsor;
        } catch (error) {
            dbLogger.error(error, 'failed to update sponsor');
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
        dbLogger.info({ sponsorId: id, actor: actor.id }, 'soft deleting sponsor');

        // Only admins can delete sponsors
        PostSponsorService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await PostSponsorModel.softDeleteSponsor(id);
            dbLogger.info({ sponsorId: id }, 'sponsor soft deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete sponsor');
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
        dbLogger.info({ sponsorId: id, actor: actor.id }, 'restoring sponsor');

        // Only admins can restore sponsors
        PostSponsorService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await PostSponsorModel.restoreSponsor(id);
            dbLogger.info({ sponsorId: id }, 'sponsor restored successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to restore sponsor');
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
        dbLogger.info({ sponsorId: id, actor: actor.id }, 'hard deleting sponsor');

        // Only admins can hard delete
        PostSponsorService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await PostSponsorModel.hardDeleteSponsor(id);
            dbLogger.info({ sponsorId: id }, 'sponsor hard deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete sponsor');
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
        dbLogger.info({ postId, actor: actor.id, filter }, 'getting sponsors by post id');

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
            dbLogger.info(
                { postId, count: sponsorships.length },
                'sponsors by post id retrieved successfully'
            );
            return sponsorships;
        } catch (error) {
            dbLogger.error(error, 'failed to get sponsors by post id');
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
        dbLogger.info({ postId, sponsorId, actor: actor.id }, 'assigning sponsor to post');

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
            dbLogger.info(
                { postId, sponsorId, sponsorshipId: sponsorship.id },
                'sponsor assigned to post successfully'
            );
            return sponsorship;
        } catch (error) {
            dbLogger.error(error, 'failed to assign sponsor to post');
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
        dbLogger.info({ postId, sponsorId, actor: actor.id }, 'removing sponsor from post');

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

            dbLogger.info({ postId, sponsorId }, 'sponsor removed from post successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to remove sponsor from post');
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
        dbLogger.info({ sponsorId, actor: actor.id, filter }, 'listing posts by sponsor id');

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

            dbLogger.info(
                { sponsorId, count: paginatedPosts.length },
                'posts by sponsor id listed successfully'
            );
            return paginatedPosts;
        } catch (error) {
            dbLogger.error(error, 'failed to list posts by sponsor id');
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
        dbLogger.info({ actor: actor.id, filter }, 'getting active sponsors');

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

            dbLogger.info(
                { count: paginatedSponsors.length },
                'active sponsors retrieved successfully'
            );
            return paginatedSponsors;
        } catch (error) {
            dbLogger.error(error, 'failed to get active sponsors');
            throw error;
        }
    }
}
