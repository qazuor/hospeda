import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type DestinationRatingType, type UserType } from '@repo/types';
import {
    DestinationModel,
    DestinationReviewModel,
    type DestinationReviewRecord
} from '../model/index.js';
import type {
    InsertDestinationReview,
    PaginationParams,
    UpdateDestinationReviewData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

const log = logger.createLogger('DestinationReviewService');

/**
 * Service layer for managing destination review operations.
 * Handles business logic, authorization, and interacts with the DestinationReviewModel.
 */
export class DestinationReviewService {
    /**
     * Checks if the given actor is an admin.
     * @param actor - The user performing the action.
     * @returns true if the actor is an admin, false otherwise.
     */
    private static isAdmin(actor: UserType): boolean {
        return actor.roleId === BuiltinRoleTypeEnum.ADMIN;
    }

    /**
     * Asserts that the actor is either the creator of the resource or an admin.
     * @param createdById - The ID of the resource creator.
     * @param actor - The user performing the action.
     * @throws Error if the actor is neither the creator nor an admin.
     */
    private static assertCreatorOrAdmin(createdById: string, actor: UserType): void {
        if (actor.id !== createdById && !DestinationReviewService.isAdmin(actor)) {
            log.warn('Forbidden access attempt', 'assertCreatorOrAdmin', {
                actorId: actor.id,
                requiredCreatorId: createdById
            });
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new destination review.
     * @param data - The data for the new review.
     * @param actor - The user creating the review.
     * @returns The created review record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertDestinationReview, actor: UserType): Promise<DestinationReviewRecord> {
        log.info('creating destination review', 'create', { actor: actor.id });

        try {
            // Verify destination exists
            const destination = await DestinationModel.getDestinationById(data.destinationId);
            if (!destination) {
                throw new Error(`Destination ${data.destinationId} not found`);
            }

            const dataWithAudit: InsertDestinationReview = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdReview = await DestinationReviewModel.createReview(dataWithAudit);
            log.info('destination review created successfully', 'create', {
                reviewId: createdReview.id
            });
            return createdReview;
        } catch (error) {
            log.error('failed to create destination review', 'create', error, { actor: actor.id });
            throw error;
        }
    }

    /**
     * Get a single review by ID.
     * @param id - The ID of the review to fetch.
     * @param actor - The user performing the action.
     * @returns The review record.
     * @throws Error if review is not found.
     */
    async getById(id: string, actor: UserType): Promise<DestinationReviewRecord> {
        log.info('fetching review by id', 'getById', { reviewId: id, actor: actor.id });

        try {
            const review = await DestinationReviewModel.getReviewById(id);
            const existingReview = assertExists(review, `Review ${id} not found`);

            log.info('review fetched successfully', 'getById', {
                reviewId: existingReview.id
            });
            return existingReview;
        } catch (error) {
            log.error('failed to fetch review by id', 'getById', error, {
                reviewId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List reviews for a destination.
     * @param destinationId - The ID of the destination.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of review records.
     * @throws Error if destination is not found or listing fails.
     */
    async list(
        destinationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<DestinationReviewRecord[]> {
        log.info('listing reviews for destination', 'list', {
            destinationId,
            actor: actor.id,
            filter
        });

        try {
            // Verify destination exists
            const destination = await DestinationModel.getDestinationById(destinationId);
            if (!destination) {
                throw new Error(`Destination ${destinationId} not found`);
            }

            const reviews = await DestinationReviewModel.listReviews({
                destinationId,
                ...filter,
                includeDeleted: false
            });
            log.info('reviews listed successfully', 'list', {
                destinationId,
                count: reviews.length
            });
            return reviews;
        } catch (error) {
            log.error('failed to list reviews', 'list', error, {
                destinationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Update fields on an existing review.
     * @param id - The ID of the review to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action.
     * @returns The updated review record.
     * @throws Error if review is not found, actor is not authorized, or update fails.
     */
    async update(
        id: string,
        changes: UpdateDestinationReviewData,
        actor: UserType
    ): Promise<DestinationReviewRecord> {
        log.info('updating review', 'update', { reviewId: id, actor: actor.id });

        const existingReview = await this.getById(id, actor);

        // Check if actor is creator or admin
        DestinationReviewService.assertCreatorOrAdmin(existingReview.createdById, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdateDestinationReviewData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedReview = await DestinationReviewModel.updateReview(
                existingReview.id,
                dataWithAudit
            );
            log.info('review updated successfully', 'update', {
                reviewId: updatedReview.id
            });
            return updatedReview;
        } catch (error) {
            log.error('failed to update review', 'update', error, {
                reviewId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Soft-delete a review by setting the deletedAt timestamp.
     * @param id - The ID of the review to delete.
     * @param actor - The user performing the action.
     * @throws Error if review is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        log.info('soft deleting review', 'delete', { reviewId: id, actor: actor.id });

        const existingReview = await this.getById(id, actor);

        // Check if actor is creator or admin
        DestinationReviewService.assertCreatorOrAdmin(existingReview.createdById, actor);

        try {
            await DestinationReviewModel.softDeleteReview(id);
            log.info('review soft deleted successfully', 'delete', { reviewId: id });
        } catch (error) {
            log.error('failed to soft delete review', 'delete', error, {
                reviewId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Restore a soft-deleted review by clearing the deletedAt timestamp.
     * @param id - The ID of the review to restore.
     * @param actor - The user performing the action.
     * @throws Error if review is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        log.info('restoring review', 'restore', { reviewId: id, actor: actor.id });

        const existingReview = await this.getById(id, actor);

        // Check if actor is creator or admin
        DestinationReviewService.assertCreatorOrAdmin(existingReview.createdById, actor);

        try {
            await DestinationReviewModel.restoreReview(id);
            log.info('review restored successfully', 'restore', { reviewId: id });
        } catch (error) {
            log.error('failed to restore review', 'restore', error, {
                reviewId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Permanently delete a review record from the database.
     * @param id - The ID of the review to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if review is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        log.info('hard deleting review', 'hardDelete', { reviewId: id, actor: actor.id });

        // Only admins can hard delete
        if (!DestinationReviewService.isAdmin(actor)) {
            throw new Error('Forbidden: Only admins can permanently delete reviews');
        }

        await this.getById(id, actor);

        try {
            await DestinationReviewModel.hardDeleteReview(id);
            log.info('review hard deleted successfully', 'hardDelete', { reviewId: id });
        } catch (error) {
            log.error('failed to hard delete review', 'hardDelete', error, {
                reviewId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Calculate the average rating for a destination based on all its reviews.
     * @param destinationId - The ID of the destination.
     * @param actor - The user performing the action.
     * @returns The average rating across all categories.
     * @throws Error if destination is not found or calculation fails.
     */
    async getAverageRating(destinationId: string, actor: UserType): Promise<DestinationRatingType> {
        log.info('calculating average rating for destination', 'getAverageRating', {
            destinationId,
            actor: actor.id
        });

        try {
            // Verify destination exists
            const destination = await DestinationModel.getDestinationById(destinationId);
            if (!destination) {
                throw new Error(`Destination ${destinationId} not found`);
            }

            // Get all active reviews for the destination
            const reviews = await DestinationReviewModel.listReviews({
                destinationId,
                includeDeleted: false
            });

            if (reviews.length === 0) {
                log.info('no reviews found for rating calculation', 'getAverageRating', {
                    destinationId
                });

                // Return default rating with zeros
                return {
                    landscape: 0,
                    attractions: 0,
                    accessibility: 0,
                    safety: 0,
                    cleanliness: 0,
                    hospitality: 0,
                    culturalOffer: 0,
                    gastronomy: 0,
                    affordability: 0,
                    nightlife: 0,
                    infrastructure: 0,
                    environmentalCare: 0,
                    wifiAvailability: 0,
                    shopping: 0,
                    beaches: 0,
                    greenSpaces: 0,
                    localEvents: 0,
                    weatherSatisfaction: 0
                };
            }

            // Initialize average rating object
            const averageRating: DestinationRatingType = {
                landscape: 0,
                attractions: 0,
                accessibility: 0,
                safety: 0,
                cleanliness: 0,
                hospitality: 0,
                culturalOffer: 0,
                gastronomy: 0,
                affordability: 0,
                nightlife: 0,
                infrastructure: 0,
                environmentalCare: 0,
                wifiAvailability: 0,
                shopping: 0,
                beaches: 0,
                greenSpaces: 0,
                localEvents: 0,
                weatherSatisfaction: 0
            };

            // Sum all ratings
            for (const review of reviews) {
                const rating = review.rating as unknown as DestinationRatingType;

                // Add each rating category
                for (const key of Object.keys(averageRating) as Array<
                    keyof DestinationRatingType
                >) {
                    if (rating[key] !== undefined) {
                        averageRating[key] += Number(rating[key]);
                    }
                }
            }

            // Calculate averages
            const count = reviews.length;
            for (const key of Object.keys(averageRating) as Array<keyof DestinationRatingType>) {
                averageRating[key] = Number((averageRating[key] / count).toFixed(1));
            }

            log.info('average rating calculated successfully', 'getAverageRating', {
                destinationId,
                reviewCount: count
            });
            return averageRating;
        } catch (error) {
            log.error('failed to calculate average rating', 'getAverageRating', error, {
                destinationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List reviews created by a specific user.
     * @param userId - The ID of the user.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of review records created by the user.
     * @throws Error if listing fails.
     */
    async listByUser(
        userId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<DestinationReviewRecord[]> {
        log.info('listing reviews by user', 'listByUser', {
            userId,
            actor: actor.id,
            filter
        });

        // If not admin and not the user themselves, forbid access
        if (!DestinationReviewService.isAdmin(actor) && actor.id !== userId) {
            throw new Error(
                'Forbidden: You can only view your own reviews unless you are an admin'
            );
        }

        try {
            // Get all active reviews from all destinations
            const allDestinations = await DestinationModel.listDestinations({
                includeDeleted: false
            });

            const userReviews: DestinationReviewRecord[] = [];

            // For each destination, get reviews by this user
            for (const destination of allDestinations) {
                const reviews = await DestinationReviewModel.listReviews({
                    destinationId: destination.id,
                    includeDeleted: false
                });

                // Filter for reviews created by the specified user
                const userReviewsForDestination = reviews.filter(
                    (review) => review.createdById === userId
                );
                userReviews.push(...userReviewsForDestination);
            }

            // Apply pagination manually
            const offset = filter.offset || 0;
            const limit = filter.limit || 20;
            const paginatedReviews = userReviews.slice(offset, offset + limit);

            log.info('reviews by user listed successfully', 'listByUser', {
                userId,
                count: paginatedReviews.length
            });
            return paginatedReviews;
        } catch (error) {
            log.error('failed to list reviews by user', 'listByUser', error, {
                userId,
                actor: actor.id
            });
            throw error;
        }
    }
}
