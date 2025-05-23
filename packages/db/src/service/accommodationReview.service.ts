import { dbLogger } from '@repo/db/utils/logger.js';
import { type AccommodationRatingType, BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    AccommodationModel,
    AccommodationReviewModel,
    type AccommodationReviewRecord
} from '../model/index.js';
import type {
    InsertAccommodationReview,
    PaginationParams,
    UpdateAccommodationReviewData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

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
            dbLogger.warn(
                {
                    actorId: actor.id,
                    requiredCreatorId: createdById
                },
                'Forbidden access attempt'
            );
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
        dbLogger.info({ actor: actor.id }, 'creating accommodation review');

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
            dbLogger.info(
                { reviewId: createdReview.id },
                'accommodation review created successfully'
            );
            return createdReview;
        } catch (error) {
            dbLogger.error(error, 'failed to create accommodation review');
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
        dbLogger.info({ reviewId: id, actor: actor.id }, 'fetching review by id');

        try {
            const review = await AccommodationReviewModel.getReviewById(id);
            const existingReview = assertExists(review, `Review ${id} not found`);

            dbLogger.info({ reviewId: existingReview.id }, 'review fetched successfully');
            return existingReview;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch review by id');
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
        dbLogger.info(
            {
                accommodationId,
                actor: actor.id,
                filter
            },
            'listing reviews for accommodation'
        );

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
            dbLogger.info(
                {
                    accommodationId,
                    count: reviews.length
                },
                'reviews listed successfully'
            );
            return reviews;
        } catch (error) {
            dbLogger.error(error, 'failed to list reviews');
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
        dbLogger.info({ reviewId: id, actor: actor.id }, 'updating review');

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
            dbLogger.info({ reviewId: updatedReview.id }, 'review updated successfully');
            return updatedReview;
        } catch (error) {
            dbLogger.error(error, 'failed to update review');
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
        dbLogger.info({ reviewId: id, actor: actor.id }, 'soft deleting review');

        const existingReview = await this.getById(id, actor);

        // Check if actor is creator or admin
        AccommodationReviewService.assertCreatorOrAdmin(existingReview.createdById, actor);

        try {
            await AccommodationReviewModel.softDeleteReview(id);
            dbLogger.info({ reviewId: id }, 'review soft deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete review');
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
        dbLogger.info({ reviewId: id, actor: actor.id }, 'restoring review');

        const existingReview = await this.getById(id, actor);

        // Check if actor is creator or admin
        AccommodationReviewService.assertCreatorOrAdmin(existingReview.createdById, actor);

        try {
            await AccommodationReviewModel.restoreReview(id);
            dbLogger.info({ reviewId: id }, 'review restored successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to restore review');
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
        dbLogger.info({ reviewId: id, actor: actor.id }, 'hard deleting review');

        // Only admins can hard delete
        if (!AccommodationReviewService.isAdmin(actor)) {
            throw new Error('Forbidden: Only admins can permanently delete reviews');
        }

        await this.getById(id, actor);

        try {
            await AccommodationReviewModel.hardDeleteReview(id);
            dbLogger.info({ reviewId: id }, 'review hard deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete review');
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
        dbLogger.info(
            {
                accommodationId,
                actor: actor.id
            },
            'calculating average rating for accommodation'
        );

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
                dbLogger.info(
                    {
                        accommodationId
                    },
                    'no reviews found for rating calculation'
                );

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

            dbLogger.info(
                {
                    accommodationId,
                    reviewCount: count
                },
                'average rating calculated successfully'
            );
            return averageRating;
        } catch (error) {
            dbLogger.error(error, 'failed to calculate average rating');
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
        dbLogger.info(
            {
                accommodationId,
                actor: actor.id
            },
            'counting reviews by accommodation'
        );

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

            dbLogger.info(
                {
                    accommodationId,
                    count: reviews.length
                },
                'reviews counted by accommodation successfully'
            );
            return reviews.length;
        } catch (error) {
            dbLogger.error(error, 'failed to count reviews by accommodation');
            throw error;
        }
    }
}
