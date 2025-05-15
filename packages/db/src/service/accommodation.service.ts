import { logger } from '@repo/logger';
import {
    type AccommodationRatingType,
    BuiltinRoleTypeEnum,
    EntityTypeEnum,
    type UserType
} from '@repo/types';
import type {
    InsertAccommodation,
    InsertEntityTagRelation,
    PaginationParams,
    SelectAccommodationFilter,
    UpdateAccommodationData
} from 'src/types/db-types';
import {
    AccommodationAmenityModel,
    type AccommodationAmenityRecord,
    AccommodationFaqModel,
    type AccommodationFaqRecord,
    AccommodationFeatureModel,
    type AccommodationFeatureRecord,
    AccommodationIaDataModel,
    type AccommodationIaDataRecord,
    AccommodationModel,
    type AccommodationRecord,
    AccommodationReviewModel,
    type AccommodationReviewRecord,
    type CreateAccommodationAmenityData,
    type CreateAccommodationFaqData,
    type CreateAccommodationFeatureData,
    type CreateAccommodationIaData,
    type CreateAccommodationReviewData,
    EntityTagModel,
    type EntityTagRecord,
    type SelectAccommodationAmenityFilter,
    type SelectAccommodationFaqFilter,
    type SelectAccommodationFeatureFilter,
    type SelectAccommodationIaDataFilter
} from '../model';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils';

const log = logger.createLogger('AccommodationService');

/**
 * Service layer for managing accommodation operations.
 * Handles business logic, authorization, and interacts with the AccommodationModel and related models.
 */
export class AccommodationService {
    /**
     * Checks if the given actor is an admin.
     * @param actor - The user performing the action.
     * @returns true if the actor is an admin, false otherwise.
     */
    private static isAdmin(actor: UserType): boolean {
        return actor.roleId === BuiltinRoleTypeEnum.ADMIN;
    }

    /**
     * Asserts that the actor is either the owner of the resource or an admin.
     * @param ownerId - The ID of the resource owner.
     * @param actor - The user performing the action.
     * @throws Error if the actor is neither the owner nor an admin.
     */
    private static assertOwnerOrAdmin(ownerId: string, actor: UserType): void {
        if (actor.id !== ownerId && !AccommodationService.isAdmin(actor)) {
            log.warn('Forbidden access attempt', 'assertOwnerOrAdmin', {
                actorId: actor.id,
                requiredOwnerId: ownerId
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
        if (!AccommodationService.isAdmin(actor)) {
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new accommodation.
     * @param data - The data for the new accommodation.
     * @param actor - The user creating the accommodation (must be an admin or the owner).
     * @returns The created accommodation record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertAccommodation, actor: UserType): Promise<AccommodationRecord> {
        log.info('creating accommodation', 'create', { actor: actor.id });

        // Check if actor is owner or admin
        AccommodationService.assertOwnerOrAdmin(data.ownerId, actor);

        try {
            const dataWithAudit: InsertAccommodation = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdAccommodation =
                await AccommodationModel.createAccommodation(dataWithAudit);
            log.info('accommodation created successfully', 'create', {
                accommodationId: createdAccommodation.id
            });
            return createdAccommodation;
        } catch (error) {
            log.error('failed to create accommodation', 'create', error, { actor: actor.id });
            throw error;
        }
    }

    /**
     * Get a single accommodation by ID.
     * @param id - The ID of the accommodation to fetch.
     * @param actor - The user performing the action.
     * @returns The accommodation record.
     * @throws Error if accommodation is not found.
     */
    async getById(id: string, actor: UserType): Promise<AccommodationRecord> {
        log.info('fetching accommodation by id', 'getById', {
            accommodationId: id,
            actor: actor.id
        });

        try {
            const accommodation = await AccommodationModel.getAccommodationById(id);
            const existingAccommodation = assertExists(
                accommodation,
                `Accommodation ${id} not found`
            );

            log.info('accommodation fetched successfully', 'getById', {
                accommodationId: existingAccommodation.id
            });
            return existingAccommodation;
        } catch (error) {
            log.error('failed to fetch accommodation by id', 'getById', error, {
                accommodationId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List accommodations with optional filtering and pagination.
     * @param filter - Filtering and pagination options.
     * @param actor - The user performing the action.
     * @returns An array of accommodation records.
     * @throws Error if listing fails.
     */
    async list(filter: SelectAccommodationFilter, actor: UserType): Promise<AccommodationRecord[]> {
        log.info('listing accommodations', 'list', { filter, actor: actor.id });

        try {
            const accommodations = await AccommodationModel.listAccommodations(filter);
            log.info('accommodations listed successfully', 'list', {
                count: accommodations.length,
                filter
            });
            return accommodations;
        } catch (error) {
            log.error('failed to list accommodations', 'list', error, {
                filter,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Update fields on an existing accommodation.
     * @param id - The ID of the accommodation to update.
     * @param changes - The changes to apply.
     * @param actor - The user performing the action.
     * @returns The updated accommodation record.
     * @throws Error if accommodation is not found, actor is not authorized, or update fails.
     */
    async update(
        id: string,
        changes: UpdateAccommodationData,
        actor: UserType
    ): Promise<AccommodationRecord> {
        log.info('updating accommodation', 'update', {
            accommodationId: id,
            actor: actor.id
        });

        const existingAccommodation = await this.getById(id, actor);

        // Check if actor is owner or admin
        AccommodationService.assertOwnerOrAdmin(existingAccommodation.ownerId, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdateAccommodationData = {
                ...dataToUpdate,
                updatedById: actor.id
            };

            const updatedAccommodation = await AccommodationModel.updateAccommodation(
                existingAccommodation.id,
                dataWithAudit
            );

            log.info('accommodation updated successfully', 'update', {
                accommodationId: updatedAccommodation.id
            });
            return updatedAccommodation;
        } catch (error) {
            log.error('failed to update accommodation', 'update', error, {
                accommodationId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Soft-delete an accommodation.
     * @param id - The ID of the accommodation to delete.
     * @param actor - The user performing the action.
     * @throws Error if accommodation is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        log.info('soft deleting accommodation', 'delete', {
            accommodationId: id,
            actor: actor.id
        });

        const existingAccommodation = await this.getById(id, actor);

        // Check if actor is owner or admin
        AccommodationService.assertOwnerOrAdmin(existingAccommodation.ownerId, actor);

        try {
            const changes: UpdateAccommodationData = {
                deletedAt: new Date(),
                deletedById: actor.id
            };

            await AccommodationModel.updateAccommodation(existingAccommodation.id, changes);
            log.info('accommodation soft deleted successfully', 'delete', {
                accommodationId: existingAccommodation.id
            });
        } catch (error) {
            log.error('failed to soft delete accommodation', 'delete', error, {
                accommodationId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Restore a soft-deleted accommodation.
     * @param id - The ID of the accommodation to restore.
     * @param actor - The user performing the action.
     * @throws Error if accommodation is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        log.info('restoring accommodation', 'restore', {
            accommodationId: id,
            actor: actor.id
        });

        const existingAccommodation = await this.getById(id, actor);

        // Check if actor is owner or admin
        AccommodationService.assertOwnerOrAdmin(existingAccommodation.ownerId, actor);

        try {
            const changes: UpdateAccommodationData = {
                deletedAt: null,
                deletedById: null
            };

            await AccommodationModel.updateAccommodation(existingAccommodation.id, changes);
            log.info('accommodation restored successfully', 'restore', {
                accommodationId: existingAccommodation.id
            });
        } catch (error) {
            log.error('failed to restore accommodation', 'restore', error, {
                accommodationId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Permanently delete an accommodation.
     * @param id - The ID of the accommodation to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if accommodation is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        log.info('hard deleting accommodation', 'hardDelete', {
            accommodationId: id,
            actor: actor.id
        });

        // Only admins can hard delete
        AccommodationService.assertAdmin(actor);

        const existingAccommodation = await this.getById(id, actor);

        try {
            await AccommodationModel.hardDeleteAccommodation(existingAccommodation.id);
            log.info('accommodation hard deleted successfully', 'hardDelete', {
                accommodationId: existingAccommodation.id
            });
        } catch (error) {
            log.error('failed to hard delete accommodation', 'hardDelete', error, {
                accommodationId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get accommodations by owner ID.
     * @param ownerId - The ID of the owner.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns An array of accommodation records.
     * @throws Error if actor is not authorized or listing fails.
     */
    async getByOwner(
        ownerId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationRecord[]> {
        log.info('fetching accommodations by owner id', 'getByOwner', {
            ownerId,
            actor: actor.id,
            filter
        });

        // Check if actor is owner or admin
        AccommodationService.assertOwnerOrAdmin(ownerId, actor);

        try {
            const accommodationFilter: SelectAccommodationFilter = {
                ownerId,
                ...filter,
                includeDeleted: false
            };

            const accommodations = await AccommodationModel.listAccommodations(accommodationFilter);
            log.info('accommodations by owner fetched successfully', 'getByOwner', {
                ownerId,
                count: accommodations.length
            });
            return accommodations;
        } catch (error) {
            log.error('failed to fetch accommodations by owner', 'getByOwner', error, {
                ownerId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get accommodations by type.
     * @param type - The accommodation type.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns An array of accommodation records.
     * @throws Error if listing fails.
     */
    async getByType(
        type: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationRecord[]> {
        log.info('fetching accommodations by type', 'getByType', {
            type,
            actor: actor.id,
            filter
        });

        try {
            const accommodationFilter: SelectAccommodationFilter = {
                type,
                ...filter,
                includeDeleted: false
            };

            const accommodations = await AccommodationModel.listAccommodations(accommodationFilter);
            log.info('accommodations by type fetched successfully', 'getByType', {
                type,
                count: accommodations.length
            });
            return accommodations;
        } catch (error) {
            log.error('failed to fetch accommodations by type', 'getByType', error, {
                type,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get accommodations by state.
     * @param state - The accommodation state.
     * @param actor - The user performing the action (must be an admin).
     * @param filter - Pagination options.
     * @returns An array of accommodation records.
     * @throws Error if actor is not authorized or listing fails.
     */
    async getByState(
        state: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationRecord[]> {
        log.info('fetching accommodations by state', 'getByState', {
            state,
            actor: actor.id,
            filter
        });

        // Only admins can filter by state
        AccommodationService.assertAdmin(actor);

        try {
            const accommodationFilter: SelectAccommodationFilter = {
                state,
                ...filter,
                includeDeleted: false
            };

            const accommodations = await AccommodationModel.listAccommodations(accommodationFilter);
            log.info('accommodations by state fetched successfully', 'getByState', {
                state,
                count: accommodations.length
            });
            return accommodations;
        } catch (error) {
            log.error('failed to fetch accommodations by state', 'getByState', error, {
                state,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List accommodations by destination.
     * @param destinationId - The ID of the destination.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns An array of accommodation records.
     * @throws Error if listing fails.
     */
    async listByDestination(
        destinationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationRecord[]> {
        log.info('listing accommodations by destination', 'listByDestination', {
            destinationId,
            actor: actor.id,
            filter
        });

        try {
            const accommodationFilter: SelectAccommodationFilter = {
                destinationId,
                ...filter,
                includeDeleted: false
            };

            const accommodations = await AccommodationModel.listAccommodations(accommodationFilter);
            log.info('accommodations by destination listed successfully', 'listByDestination', {
                destinationId,
                count: accommodations.length
            });
            return accommodations;
        } catch (error) {
            log.error('failed to list accommodations by destination', 'listByDestination', error, {
                destinationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Add a review to an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param data - The review data.
     * @param actor - The user performing the action.
     * @returns The created review record.
     * @throws Error if accommodation is not found or review creation fails.
     */
    async addReview(
        accommodationId: string,
        data: CreateAccommodationReviewData,
        actor: UserType
    ): Promise<AccommodationReviewRecord> {
        log.info('adding review to accommodation', 'addReview', {
            accommodationId,
            actor: actor.id
        });

        // Verify accommodation exists
        const accommodation = await this.getById(accommodationId, actor);

        try {
            const reviewData: CreateAccommodationReviewData = {
                ...data,
                accommodationId: accommodation.id,
                createdById: actor.id,
                updatedById: actor.id
            };

            const review = await AccommodationReviewModel.createReview(reviewData);
            log.info('review added successfully', 'addReview', {
                accommodationId,
                reviewId: review.id
            });
            return review;
        } catch (error) {
            log.error('failed to add review', 'addReview', error, {
                accommodationId,
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
     * @returns An array of review records.
     * @throws Error if accommodation is not found or listing fails.
     */
    async listReviews(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationReviewRecord[]> {
        log.info('listing reviews for accommodation', 'listReviews', {
            accommodationId,
            actor: actor.id,
            filter
        });

        // Verify accommodation exists
        await this.getById(accommodationId, actor);

        try {
            const reviewFilter: SelectAccommodationFilter = {
                ...filter,
                includeDeleted: false
            };

            const reviews = await AccommodationReviewModel.listReviews({
                accommodationId,
                ...reviewFilter
            });

            log.info('reviews listed successfully', 'listReviews', {
                accommodationId,
                count: reviews.length
            });
            return reviews;
        } catch (error) {
            log.error('failed to list reviews', 'listReviews', error, {
                accommodationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get the average rating for an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @returns The average rating.
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

        // Verify accommodation exists
        await this.getById(accommodationId, actor);

        try {
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

            // Calculate average for each rating category
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
                averageRating.cleanliness += rating.cleanliness || 0;
                averageRating.hospitality += rating.hospitality || 0;
                averageRating.services += rating.services || 0;
                averageRating.accuracy += rating.accuracy || 0;
                averageRating.communication += rating.communication || 0;
                averageRating.location += rating.location || 0;
            }

            // Calculate averages
            const count = reviews.length;
            averageRating.cleanliness = Number((averageRating.cleanliness / count).toFixed(1));
            averageRating.hospitality = Number((averageRating.hospitality / count).toFixed(1));
            averageRating.services = Number((averageRating.services / count).toFixed(1));
            averageRating.accuracy = Number((averageRating.accuracy / count).toFixed(1));
            averageRating.communication = Number((averageRating.communication / count).toFixed(1));
            averageRating.location = Number((averageRating.location / count).toFixed(1));

            log.info('average rating calculated successfully', 'getAverageRating', {
                accommodationId,
                averageRating
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
     * Get top-rated accommodations.
     * @param limit - The maximum number of accommodations to return.
     * @param actor - The user performing the action.
     * @returns An array of top-rated accommodation records.
     * @throws Error if listing fails.
     */
    async getTopRated(limit: number, actor: UserType): Promise<AccommodationRecord[]> {
        log.info('fetching top-rated accommodations', 'getTopRated', {
            limit,
            actor: actor.id
        });

        try {
            // First get all active accommodations
            const accommodations = await AccommodationModel.listAccommodations({
                includeDeleted: false,
                limit: 100 // Get a larger set to filter from
            });

            // For each accommodation, get its average rating
            const ratedAccommodations = await Promise.all(
                accommodations.map(async (accommodation) => {
                    const rating = await this.getAverageRating(accommodation.id, actor);

                    // Calculate overall average rating
                    const overallRating =
                        (rating.cleanliness +
                            rating.hospitality +
                            rating.services +
                            rating.accuracy +
                            rating.communication +
                            rating.location) /
                        6;

                    return {
                        accommodation,
                        overallRating
                    };
                })
            );

            // Sort by overall rating and take the top 'limit'
            const topRated = ratedAccommodations
                .sort((a, b) => b.overallRating - a.overallRating)
                .slice(0, limit)
                .map((item) => item.accommodation);

            log.info('top-rated accommodations fetched successfully', 'getTopRated', {
                count: topRated.length
            });
            return topRated;
        } catch (error) {
            log.error('failed to fetch top-rated accommodations', 'getTopRated', error, {
                limit,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Search accommodations by text.
     * @param query - The search query.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns An array of matching accommodation records.
     * @throws Error if search fails.
     */
    async searchFullText(
        query: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationRecord[]> {
        log.info('searching accommodations', 'searchFullText', {
            query,
            actor: actor.id,
            filter
        });

        try {
            const searchFilter: SelectAccommodationFilter = {
                query,
                ...filter,
                includeDeleted: false
            };

            const accommodations = await AccommodationModel.listAccommodations(searchFilter);
            log.info('accommodations search completed successfully', 'searchFullText', {
                query,
                count: accommodations.length
            });
            return accommodations;
        } catch (error) {
            log.error('failed to search accommodations', 'searchFullText', error, {
                query,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List amenities for an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns An array of amenity records.
     * @throws Error if accommodation is not found or listing fails.
     */
    async listAmenities(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationAmenityRecord[]> {
        log.info('listing amenities for accommodation', 'listAmenities', {
            accommodationId,
            actor: actor.id,
            filter
        });

        // Verify accommodation exists
        await this.getById(accommodationId, actor);

        try {
            const amenityFilter: SelectAccommodationAmenityFilter = {
                accommodationId,
                ...filter,
                includeDeleted: false
            };

            const amenities = await AccommodationAmenityModel.listAmenities(amenityFilter);
            log.info('amenities listed successfully', 'listAmenities', {
                accommodationId,
                count: amenities.length
            });
            return amenities;
        } catch (error) {
            log.error('failed to list amenities', 'listAmenities', error, {
                accommodationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List features for an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns An array of feature records.
     * @throws Error if accommodation is not found or listing fails.
     */
    async listFeatures(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationFeatureRecord[]> {
        log.info('listing features for accommodation', 'listFeatures', {
            accommodationId,
            actor: actor.id,
            filter
        });

        // Verify accommodation exists
        await this.getById(accommodationId, actor);

        try {
            const featureFilter: SelectAccommodationFeatureFilter = {
                accommodationId,
                ...filter,
                includeDeleted: false
            };

            const features = await AccommodationFeatureModel.listFeatures(featureFilter);
            log.info('features listed successfully', 'listFeatures', {
                accommodationId,
                count: features.length
            });
            return features;
        } catch (error) {
            log.error('failed to list features', 'listFeatures', error, {
                accommodationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List FAQs for an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns An array of FAQ records.
     * @throws Error if accommodation is not found or listing fails.
     */
    async listFaqs(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationFaqRecord[]> {
        log.info('listing FAQs for accommodation', 'listFaqs', {
            accommodationId,
            actor: actor.id,
            filter
        });

        // Verify accommodation exists
        await this.getById(accommodationId, actor);

        try {
            const faqFilter: SelectAccommodationFaqFilter = {
                accommodationId,
                ...filter,
                includeDeleted: false
            };

            const faqs = await AccommodationFaqModel.listFaqs(faqFilter);
            log.info('FAQs listed successfully', 'listFaqs', {
                accommodationId,
                count: faqs.length
            });
            return faqs;
        } catch (error) {
            log.error('failed to list FAQs', 'listFaqs', error, {
                accommodationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List IA data for an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns An array of IA data records.
     * @throws Error if accommodation is not found, actor is not authorized, or listing fails.
     */
    async listIaData(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationIaDataRecord[]> {
        log.info('listing IA data for accommodation', 'listIaData', {
            accommodationId,
            actor: actor.id,
            filter
        });

        const accommodation = await this.getById(accommodationId, actor);

        // Only owner or admin can see IA data
        AccommodationService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            const iaDataFilter: SelectAccommodationIaDataFilter = {
                accommodationId,
                ...filter,
                includeDeleted: false
            };

            const iaData = await AccommodationIaDataModel.listIaData(iaDataFilter);
            log.info('IA data listed successfully', 'listIaData', {
                accommodationId,
                count: iaData.length
            });
            return iaData;
        } catch (error) {
            log.error('failed to list IA data', 'listIaData', error, {
                accommodationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Add an amenity to an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param data - The amenity data.
     * @param actor - The user performing the action.
     * @returns The created amenity record.
     * @throws Error if accommodation is not found, actor is not authorized, or creation fails.
     */
    async addAmenity(
        accommodationId: string,
        data: CreateAccommodationAmenityData,
        actor: UserType
    ): Promise<AccommodationAmenityRecord> {
        log.info('adding amenity to accommodation', 'addAmenity', {
            accommodationId,
            actor: actor.id
        });

        const accommodation = await this.getById(accommodationId, actor);

        // Only owner or admin can add amenities
        AccommodationService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            const amenityData: CreateAccommodationAmenityData = {
                ...data,
                accommodationId: accommodation.id,
                createdById: actor.id,
                updatedById: actor.id
            };

            const amenity = await AccommodationAmenityModel.createAmenity(amenityData);
            log.info('amenity added successfully', 'addAmenity', {
                accommodationId,
                amenityId: amenity.id
            });
            return amenity;
        } catch (error) {
            log.error('failed to add amenity', 'addAmenity', error, {
                accommodationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Add a feature to an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param data - The feature data.
     * @param actor - The user performing the action.
     * @returns The created feature record.
     * @throws Error if accommodation is not found, actor is not authorized, or creation fails.
     */
    async addFeature(
        accommodationId: string,
        data: CreateAccommodationFeatureData,
        actor: UserType
    ): Promise<AccommodationFeatureRecord> {
        log.info('adding feature to accommodation', 'addFeature', {
            accommodationId,
            actor: actor.id
        });

        const accommodation = await this.getById(accommodationId, actor);

        // Only owner or admin can add features
        AccommodationService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            const featureData: CreateAccommodationFeatureData = {
                ...data,
                accommodationId: accommodation.id,
                createdById: actor.id,
                updatedById: actor.id
            };

            const feature = await AccommodationFeatureModel.createFeature(featureData);
            log.info('feature added successfully', 'addFeature', {
                accommodationId,
                featureId: feature.id
            });
            return feature;
        } catch (error) {
            log.error('failed to add feature', 'addFeature', error, {
                accommodationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Add a FAQ to an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param data - The FAQ data.
     * @param actor - The user performing the action.
     * @returns The created FAQ record.
     * @throws Error if accommodation is not found, actor is not authorized, or creation fails.
     */
    async addFaq(
        accommodationId: string,
        data: CreateAccommodationFaqData,
        actor: UserType
    ): Promise<AccommodationFaqRecord> {
        log.info('adding FAQ to accommodation', 'addFaq', {
            accommodationId,
            actor: actor.id
        });

        const accommodation = await this.getById(accommodationId, actor);

        // Only owner or admin can add FAQs
        AccommodationService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            const faqData: CreateAccommodationFaqData = {
                ...data,
                accommodationId: accommodation.id,
                createdById: actor.id,
                updatedById: actor.id
            };

            const faq = await AccommodationFaqModel.createFaq(faqData);
            log.info('FAQ added successfully', 'addFaq', {
                accommodationId,
                faqId: faq.id
            });
            return faq;
        } catch (error) {
            log.error('failed to add FAQ', 'addFaq', error, {
                accommodationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Add IA data to an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param data - The IA data.
     * @param actor - The user performing the action.
     * @returns The created IA data record.
     * @throws Error if accommodation is not found, actor is not authorized, or creation fails.
     */
    async addIaData(
        accommodationId: string,
        data: CreateAccommodationIaData,
        actor: UserType
    ): Promise<AccommodationIaDataRecord> {
        log.info('adding IA data to accommodation', 'addIaData', {
            accommodationId,
            actor: actor.id
        });

        const accommodation = await this.getById(accommodationId, actor);

        // Only owner or admin can add IA data
        AccommodationService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            const iaDataData: CreateAccommodationIaData = {
                ...data,
                accommodationId: accommodation.id,
                createdById: actor.id,
                updatedById: actor.id
            };

            const iaData = await AccommodationIaDataModel.createIaData(iaDataData);
            log.info('IA data added successfully', 'addIaData', {
                accommodationId,
                iaDataId: iaData.id
            });
            return iaData;
        } catch (error) {
            log.error('failed to add IA data', 'addIaData', error, {
                accommodationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get an accommodation with all its related details.
     * @param id - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @returns The accommodation record with all related details.
     * @throws Error if accommodation is not found or fetching fails.
     */
    async getWithDetails(
        id: string,
        actor: UserType
    ): Promise<
        AccommodationRecord & {
            amenities: AccommodationAmenityRecord[];
            features: AccommodationFeatureRecord[];
            faqs: AccommodationFaqRecord[];
            iaData: AccommodationIaDataRecord[];
            reviews: AccommodationReviewRecord[];
        }
    > {
        log.info('fetching accommodation with details', 'getWithDetails', {
            accommodationId: id,
            actor: actor.id
        });

        try {
            // Get the base accommodation
            const accommodation = await this.getById(id, actor);

            // Get related entities in parallel
            const [amenities, features, faqs, reviews] = await Promise.all([
                this.listAmenities(id, actor),
                this.listFeatures(id, actor),
                this.listFaqs(id, actor),
                this.listReviews(id, actor)
            ]);

            // Get IA data only if actor is owner or admin
            let iaData: AccommodationIaDataRecord[] = [];
            if (actor.id === accommodation.ownerId || AccommodationService.isAdmin(actor)) {
                iaData = await this.listIaData(id, actor);
            }

            const result = {
                ...accommodation,
                amenities,
                features,
                faqs,
                iaData,
                reviews
            };

            log.info('accommodation with details fetched successfully', 'getWithDetails', {
                accommodationId: id
            });
            return result;
        } catch (error) {
            log.error('failed to fetch accommodation with details', 'getWithDetails', error, {
                accommodationId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Add a tag to an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param tagId - The ID of the tag.
     * @param actor - The user performing the action.
     * @returns The created entity-tag relation record.
     * @throws Error if accommodation is not found, actor is not authorized, or creation fails.
     */
    async addTag(
        accommodationId: string,
        tagId: string,
        actor: UserType
    ): Promise<EntityTagRecord> {
        log.info('adding tag to accommodation', 'addTag', {
            accommodationId,
            tagId,
            actor: actor.id
        });

        const accommodation = await this.getById(accommodationId, actor);

        // Only owner or admin can add tags
        AccommodationService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            const entityType: EntityTypeEnum = EntityTypeEnum.ACCOMMODATION;

            const tagData: InsertEntityTagRelation = {
                entityType,
                entityId: accommodation.id,
                tagId
            };

            const tagRelation = await EntityTagModel.createRelation(tagData);
            log.info('tag added successfully', 'addTag', {
                accommodationId,
                tagId
            });
            return tagRelation;
        } catch (error) {
            log.error('failed to add tag', 'addTag', error, {
                accommodationId,
                tagId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Recommend similar accommodations based on type, destination, and features.
     * @param accommodationId - The ID of the accommodation to find similar ones for.
     * @param limit - The maximum number of recommendations to return.
     * @param actor - The user performing the action.
     * @returns An array of similar accommodation records.
     * @throws Error if accommodation is not found or recommendation fails.
     */
    async recommendSimilar(
        accommodationId: string,
        limit: number,
        actor: UserType
    ): Promise<AccommodationRecord[]> {
        log.info('recommending similar accommodations', 'recommendSimilar', {
            accommodationId,
            limit,
            actor: actor.id
        });

        try {
            // Get the source accommodation
            const accommodation = await this.getById(accommodationId, actor);

            // Find accommodations with the same type and destination
            const similarAccommodations = await AccommodationModel.listAccommodations({
                type: accommodation.type as string,
                destinationId: accommodation.destinationId,
                includeDeleted: false,
                limit: limit + 1 // Get one extra to filter out the source accommodation
            });

            // Filter out the source accommodation
            const recommendations = similarAccommodations
                .filter((acc) => acc.id !== accommodationId)
                .slice(0, limit);

            log.info('similar accommodations recommended successfully', 'recommendSimilar', {
                accommodationId,
                count: recommendations.length
            });
            return recommendations;
        } catch (error) {
            log.error('failed to recommend similar accommodations', 'recommendSimilar', error, {
                accommodationId,
                limit,
                actor: actor.id
            });
            throw error;
        }
    }
}
