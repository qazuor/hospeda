import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    PostModel,
    PostSponsorModel,
    PostSponsorshipModel,
    type PostSponsorshipRecord
} from '../model';
import type {
    InsertPostSponsorship,
    PaginationParams,
    SelectPostSponsorshipFilter,
    UpdatePostSponsorshipData
} from '../types/db-types';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils';

const log = logger.createLogger('PostSponsorshipService');

/**
 * Service layer for managing post sponsorship operations.
 * Handles business logic, authorization, and interacts with the PostSponsorshipModel.
 */
export class PostSponsorshipService {
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
        if (!PostSponsorshipService.isAdmin(actor)) {
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new post sponsorship.
     * @param data - The data for the new sponsorship.
     * @param actor - The user creating the sponsorship (must be an admin).
     * @returns The created sponsorship record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertPostSponsorship, actor: UserType): Promise<PostSponsorshipRecord> {
        log.info('creating post sponsorship', 'create', { actor: actor.id });

        // Only admins can create sponsorships
        PostSponsorshipService.assertAdmin(actor);

        try {
            // Verify post exists
            const post = await PostModel.getPostById(data.postId);
            if (!post) {
                throw new Error(`Post ${data.postId} not found`);
            }

            // Verify sponsor exists
            const sponsor = await PostSponsorModel.getSponsorById(data.sponsorId);
            if (!sponsor) {
                throw new Error(`Sponsor ${data.sponsorId} not found`);
            }

            const dataWithAudit: InsertPostSponsorship = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdSponsorship = await PostSponsorshipModel.createSponsorship(dataWithAudit);
            log.info('post sponsorship created successfully', 'create', {
                sponsorshipId: createdSponsorship.id
            });
            return createdSponsorship;
        } catch (error) {
            log.error('failed to create post sponsorship', 'create', error, { actor: actor.id });
            throw error;
        }
    }

    /**
     * Get a single sponsorship by ID.
     * @param id - The ID of the sponsorship to fetch.
     * @param actor - The user performing the action.
     * @returns The sponsorship record.
     * @throws Error if sponsorship is not found.
     */
    async getSponsorshipById(id: string, actor: UserType): Promise<PostSponsorshipRecord> {
        log.info('fetching sponsorship by id', 'getSponsorshipById', {
            sponsorshipId: id,
            actor: actor.id
        });

        try {
            const sponsorship = await PostSponsorshipModel.getSponsorshipById(id);
            const existingSponsorship = assertExists(sponsorship, `Sponsorship ${id} not found`);

            log.info('sponsorship fetched successfully', 'getSponsorshipById', {
                sponsorshipId: existingSponsorship.id
            });
            return existingSponsorship;
        } catch (error) {
            log.error('failed to fetch sponsorship by id', 'getSponsorshipById', error, {
                sponsorshipId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List sponsorships with optional filters, pagination, and search.
     * @param filter - Filtering and pagination options.
     * @param actor - The user performing the action.
     * @returns Array of sponsorship records.
     * @throws Error if listing fails.
     */
    async listSponsorships(
        filter: SelectPostSponsorshipFilter,
        actor: UserType
    ): Promise<PostSponsorshipRecord[]> {
        log.info('listing sponsorships', 'listSponsorships', { filter, actor: actor.id });

        try {
            const sponsorships = await PostSponsorshipModel.listSponsorships(filter);
            log.info('sponsorships listed successfully', 'listSponsorships', {
                count: sponsorships.length,
                filter
            });
            return sponsorships;
        } catch (error) {
            log.error('failed to list sponsorships', 'listSponsorships', error, {
                filter,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Update fields on an existing sponsorship.
     * @param id - The ID of the sponsorship to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated sponsorship record.
     * @throws Error if sponsorship is not found, actor is not authorized, or update fails.
     */
    async updateSponsorship(
        id: string,
        changes: UpdatePostSponsorshipData,
        actor: UserType
    ): Promise<PostSponsorshipRecord> {
        log.info('updating sponsorship', 'updateSponsorship', {
            sponsorshipId: id,
            actor: actor.id
        });

        // Only admins can update sponsorships
        PostSponsorshipService.assertAdmin(actor);

        const existingSponsorship = await this.getSponsorshipById(id, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdatePostSponsorshipData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedSponsorship = await PostSponsorshipModel.updateSponsorship(
                existingSponsorship.id,
                dataWithAudit
            );
            log.info('sponsorship updated successfully', 'updateSponsorship', {
                sponsorshipId: updatedSponsorship.id
            });
            return updatedSponsorship;
        } catch (error) {
            log.error('failed to update sponsorship', 'updateSponsorship', error, {
                sponsorshipId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Soft-delete a sponsorship by setting the deletedAt timestamp.
     * @param id - The ID of the sponsorship to delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if sponsorship is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        log.info('soft deleting sponsorship', 'delete', { sponsorshipId: id, actor: actor.id });

        // Only admins can delete sponsorships
        PostSponsorshipService.assertAdmin(actor);

        await this.getSponsorshipById(id, actor);

        try {
            await PostSponsorshipModel.softDeleteSponsorship(id);
            log.info('sponsorship soft deleted successfully', 'delete', { sponsorshipId: id });
        } catch (error) {
            log.error('failed to soft delete sponsorship', 'delete', error, {
                sponsorshipId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Restore a soft-deleted sponsorship by clearing the deletedAt timestamp.
     * @param id - The ID of the sponsorship to restore.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if sponsorship is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        log.info('restoring sponsorship', 'restore', { sponsorshipId: id, actor: actor.id });

        // Only admins can restore sponsorships
        PostSponsorshipService.assertAdmin(actor);

        await this.getSponsorshipById(id, actor);

        try {
            await PostSponsorshipModel.restoreSponsorship(id);
            log.info('sponsorship restored successfully', 'restore', { sponsorshipId: id });
        } catch (error) {
            log.error('failed to restore sponsorship', 'restore', error, {
                sponsorshipId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Permanently delete a sponsorship record from the database.
     * @param id - The ID of the sponsorship to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if sponsorship is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        log.info('hard deleting sponsorship', 'hardDelete', { sponsorshipId: id, actor: actor.id });

        // Only admins can hard delete
        PostSponsorshipService.assertAdmin(actor);

        await this.getSponsorshipById(id, actor);

        try {
            await PostSponsorshipModel.hardDeleteSponsorship(id);
            log.info('sponsorship hard deleted successfully', 'hardDelete', { sponsorshipId: id });
        } catch (error) {
            log.error('failed to hard delete sponsorship', 'hardDelete', error, {
                sponsorshipId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List sponsorships for a specific sponsor.
     * @param sponsorId - The ID of the sponsor.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of sponsorship records for the sponsor.
     * @throws Error if sponsor is not found or listing fails.
     */
    async listSponsorshipsBySponsor(
        sponsorId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PostSponsorshipRecord[]> {
        log.info('listing sponsorships by sponsor', 'listSponsorshipsBySponsor', {
            sponsorId,
            actor: actor.id,
            filter
        });

        try {
            // Verify sponsor exists
            const sponsor = await PostSponsorModel.getSponsorById(sponsorId);
            if (!sponsor) {
                throw new Error(`Sponsor ${sponsorId} not found`);
            }

            const sponsorshipFilter: SelectPostSponsorshipFilter = {
                sponsorId,
                ...filter,
                includeDeleted: false
            };

            const sponsorships = await PostSponsorshipModel.listSponsorships(sponsorshipFilter);
            log.info('sponsorships by sponsor listed successfully', 'listSponsorshipsBySponsor', {
                sponsorId,
                count: sponsorships.length
            });
            return sponsorships;
        } catch (error) {
            log.error(
                'failed to list sponsorships by sponsor',
                'listSponsorshipsBySponsor',
                error,
                {
                    sponsorId,
                    actor: actor.id
                }
            );
            throw error;
        }
    }

    /**
     * Get active sponsorships (current date is within fromDate and toDate).
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of active sponsorship records.
     * @throws Error if listing fails.
     */
    async getActiveSponsorships(
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<PostSponsorshipRecord[]> {
        log.info('getting active sponsorships', 'getActiveSponsorships', {
            actor: actor.id,
            filter
        });

        try {
            // Get all sponsorships
            const allSponsorships = await PostSponsorshipModel.listSponsorships({
                ...filter,
                includeDeleted: false
            });

            // Filter for active sponsorships (current date is within fromDate and toDate)
            const now = new Date();
            const activeSponsorships = allSponsorships.filter((sponsorship) => {
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

            log.info('active sponsorships retrieved successfully', 'getActiveSponsorships', {
                count: activeSponsorships.length
            });
            return activeSponsorships;
        } catch (error) {
            log.error('failed to get active sponsorships', 'getActiveSponsorships', error, {
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get statistics about sponsorships.
     * @param actor - The user performing the action (must be an admin).
     * @returns Sponsorship statistics.
     * @throws Error if actor is not authorized or stats calculation fails.
     */
    async getSponsorshipStats(actor: UserType): Promise<{
        totalSponsorships: number;
        activeSponsorships: number;
        expiredSponsorships: number;
        upcomingSponsorships: number;
        totalSponsors: number;
        totalRevenue: number;
        averageDuration: number;
    }> {
        log.info('getting sponsorship stats', 'getSponsorshipStats', { actor: actor.id });

        // Only admins can view sponsorship stats
        PostSponsorshipService.assertAdmin(actor);

        try {
            // Get all sponsorships
            const allSponsorships = await PostSponsorshipModel.listSponsorships({
                includeDeleted: false
            });

            // Get all sponsors
            const allSponsors = await PostSponsorModel.listSponsors({
                includeDeleted: false
            });

            // Current date for comparisons
            const now = new Date();

            // Count active, expired, and upcoming sponsorships
            let activeSponsorships = 0;
            let expiredSponsorships = 0;
            let upcomingSponsorships = 0;
            let totalRevenue = 0;
            let totalDurationDays = 0;
            let sponsorshipsWithDuration = 0;

            for (const sponsorship of allSponsorships) {
                // Calculate revenue
                if (sponsorship.paid?.price) {
                    totalRevenue += sponsorship.paid.price;
                }

                // Calculate duration if both dates are present
                if (sponsorship.fromDate && sponsorship.toDate) {
                    const fromDate = new Date(sponsorship.fromDate);
                    const toDate = new Date(sponsorship.toDate);
                    const durationMs = toDate.getTime() - fromDate.getTime();
                    const durationDays = durationMs / (1000 * 60 * 60 * 24);
                    totalDurationDays += durationDays;
                    sponsorshipsWithDuration++;
                }

                // Categorize by status
                if (!sponsorship.fromDate && !sponsorship.toDate) {
                    // No dates specified, consider it active
                    activeSponsorships++;
                } else if (sponsorship.fromDate && !sponsorship.toDate) {
                    // Only fromDate specified
                    const fromDate = new Date(sponsorship.fromDate);
                    if (fromDate <= now) {
                        activeSponsorships++;
                    } else {
                        upcomingSponsorships++;
                    }
                } else if (!sponsorship.fromDate && sponsorship.toDate) {
                    // Only toDate specified
                    const toDate = new Date(sponsorship.toDate);
                    if (toDate >= now) {
                        activeSponsorships++;
                    } else {
                        expiredSponsorships++;
                    }
                } else if (sponsorship.fromDate && sponsorship.toDate) {
                    // Both dates specified
                    const fromDate = new Date(sponsorship.fromDate);
                    const toDate = new Date(sponsorship.toDate);
                    if (fromDate <= now && toDate >= now) {
                        activeSponsorships++;
                    } else if (toDate < now) {
                        expiredSponsorships++;
                    } else if (fromDate > now) {
                        upcomingSponsorships++;
                    }
                }
            }

            // Calculate average duration
            const averageDuration =
                sponsorshipsWithDuration > 0 ? totalDurationDays / sponsorshipsWithDuration : 0;

            const stats = {
                totalSponsorships: allSponsorships.length,
                activeSponsorships,
                expiredSponsorships,
                upcomingSponsorships,
                totalSponsors: allSponsors.length,
                totalRevenue,
                averageDuration
            };

            log.info('sponsorship stats retrieved successfully', 'getSponsorshipStats', {
                stats
            });
            return stats;
        } catch (error) {
            log.error('failed to get sponsorship stats', 'getSponsorshipStats', error, {
                actor: actor.id
            });
            throw error;
        }
    }
}
