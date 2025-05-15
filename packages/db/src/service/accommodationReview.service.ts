import { logger } from '@repo/logger';
import { type AccommodationRatingType, BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    AccommodationModel,
    AccommodationReviewModel,
    type AccommodationReviewRecord
} from '../model';
import type {
    InsertAccommodationReview,
    PaginationParams,
    UpdateAccommodationReviewData
} from '../types/db-types';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils';

const log = logger.createLogger('AccommodationReviewService');

/**
 * Service layer for managing accommodation review operations.
 * Handles business logic, authorization, and interacts with the AccommodationReviewModel.
 */
export class AccommodationReviewService {
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
        if (actor.id !== createdById && !AccommodationReviewService.isAdmin(actor)) {
            log.warn('Forbidden access attempt', 'assertCreatorOrAdmin', {
                actorId: actor.id,
                requiredCreatorId: createdById
            });
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new accommodation review.
     * @param data - The data for the new review.
     * @param actor - The user creating the review.
     * @returns The created review record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(
        data: InsertAccommodationReview,
        actor: UserType
    ): Promise<AccommodationReviewRecord> {
        log.info('creating accommodation review', 'create', { actor: actor.id });

        try {
            // Verify accommodation exists
            const accommodation = await AccommodationModel.getAccommodationById(
                data.accommodationId
            );
            if (!accommodation) {
                throw new Error(`Accommodation ${data.accommodationId} not found`);
            }

            const dataWithAudit: InsertAccommodationReview = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdReview = await AccommodationReviewModel.createReview(dataWithAudit);
            log.info('accommodation review created successfully', 'create', {
                reviewId: createdReview.id
            });
            return createdReview;
        } catch (error) {
            log.error('failed to create accommodation review', 'create', error, {
                actor: actor.id
            });
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
    async getById(id: string, actor: UserType): Promise<AccommodationReviewRecord> {
        log.info('fetching review by id', 'getById', { reviewId: id, actor: actor.id });

        try {
            const review = await AccommodationReviewModel.getReviewById(id);
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
     * List reviews for an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of review records.
     * @throws Error if accommodation is not found or listing fails.
     */
    async list(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationReviewRecord[]> {
        log.info('listing reviews for accommodation', 'list', {
            accommodationId,
            actor: actor.id,
            filter
        });

        try {
            // Verify accommodation exists
            const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
            if (!accommodation) {
                throw new Error(`Accommodation ${accommodationId} not found`);
            }

            const reviews = await AccommodationReviewModel.listReviews({
                accommodationId,
                ...filter,
                includeDeleted: false
            });
            log.info('reviews listed successfully', 'list', {
                accommodationId,
                count: reviews.length
            });
            return reviews;
        } catch (error) {
            log.error('failed to list reviews', 'list', error, {
                accommodationId,
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
        changes: UpdateAccommodationReviewData,
        actor: UserType
    ): Promise<AccommodationReviewRecord> {
        log.info('updating review', 'update', { reviewId: id, actor: actor.id });

        const existingReview = await this.getById(id, actor);

        // Check if actor is creator or admin
        AccommodationReviewService.assertCreatorOrAdmin(existingReview.createdById, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdateAccommodationReviewData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedReview = await AccommodationReviewModel.updateReview(
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
        AccommodationReviewService.assertCreatorOrAdmin(existingReview.createdById, actor);

        try {
            await AccommodationReviewModel.softDeleteReview(id);
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
        AccommodationReviewService.assertCreatorOrAdmin(existingReview.createdById, actor);

        try {
            await AccommodationReviewModel.restoreReview(id);
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
        if (!AccommodationReviewService.isAdmin(actor)) {
            throw new Error('Forbidden: Only admins can permanently delete reviews');
        }

        await this.getById(id, actor);

        try {
            await AccommodationReviewModel.hardDeleteReview(id);
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
     * Calculate the average rating for an accommodation based on all its reviews.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @returns The average rating across all categories.
     * @throws Error if accommodation is not found or calculation fails.
     */
    async getAverageRating(
        accommodationId: string,
        actor: UserType
    ): Promise<AccommodationRatingType> {
        log.info('calculating average rating for accommodation', 'getAverageRating', {
            accommodationId,
            actor: actor.id
        });

        try {
            // Verify accommodation exists
            const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
            if (!accommodation) {
                throw new Error(`Accommodation ${accommodationId} not found`);
            }

            // Get all active reviews for the accommodation
            const reviews = await AccommodationReviewModel.listReviews({
                accommodationId,
                includeDeleted: false
            });

            if (reviews.length === 0) {
                log.info('no reviews found for rating calculation', 'getAverageRating', {
                    accommodationId
                });

                // Return default rating with zeros
                return {
                    cleanliness: 0,
                    hospitality: 0,
                    services: 0,
                    accuracy: 0,
                    communication: 0,
                    location: 0
                };
            }

            // Initialize average rating object
            const averageRating: AccommodationRatingType = {
                cleanliness: 0,
                hospitality: 0,
                services: 0,
                accuracy: 0,
                communication: 0,
                location: 0
            };

            // Sum all ratings
            for (const review of reviews) {
                const rating = review.rating as unknown as AccommodationRatingType;

                // Add each rating category
                for (const key of Object.keys(averageRating) as Array<
                    keyof AccommodationRatingType
                >) {
                    if (rating[key] !== undefined) {
                        averageRating[key] += Number(rating[key]);
                    }
                }
            }

            // Calculate averages
            const count = reviews.length;
            for (const key of Object.keys(averageRating) as Array<keyof AccommodationRatingType>) {
                averageRating[key] = Number((averageRating[key] / count).toFixed(1));
            }

            log.info('average rating calculated successfully', 'getAverageRating', {
                accommodationId,
                reviewCount: count
            });
            return averageRating;
        } catch (error) {
            log.error('failed to calculate average rating', 'getAverageRating', error, {
                accommodationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Count the number of reviews for a specific accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @returns The number of reviews.
     * @throws Error if accommodation is not found or count fails.
     */
    async countByAccommodation(accommodationId: string, actor: UserType): Promise<number> {
        log.info('counting reviews by accommodation', 'countByAccommodation', {
            accommodationId,
            actor: actor.id
        });

        try {
            // Verify accommodation exists
            const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
            if (!accommodation) {
                throw new Error(`Accommodation ${accommodationId} not found`);
            }

            // Get all active reviews for the accommodation
            const reviews = await AccommodationReviewModel.listReviews({
                accommodationId,
                includeDeleted: false
            });

            log.info('reviews counted by accommodation successfully', 'countByAccommodation', {
                accommodationId,
                count: reviews.length
            });
            return reviews.length;
        } catch (error) {
            log.error('failed to count reviews by accommodation', 'countByAccommodation', error, {
                accommodationId,
                actor: actor.id
            });
            throw error;
        }
    }
}
