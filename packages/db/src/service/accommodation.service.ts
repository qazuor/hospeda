import { dbLogger } from '@repo/db/utils/logger.js';
import {
    type AccommodationRatingType,
    BuiltinRoleTypeEnum,
    EntityTypeEnum,
    type UserType
} from '@repo/types';
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
    AmenityModel,
    type AmenityRecord,
    EntityTagModel,
    type EntityTagRecord,
    FeatureModel,
    type FeatureRecord,
    type SelectAccommodationFaqFilter,
    type SelectAccommodationIaDataFilter
} from '../model/index.js';
import type {
    InsertAccommodation,
    InsertEntityTagRelation,
    PaginationParams,
    SelectAccommodationAmenityFilter,
    SelectAccommodationFeatureFilter,
    SelectAccommodationFilter,
    UpdateAccommodationData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

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
            dbLogger.warn(
                {
                    actorId: actor.id,
                    requiredOwnerId: ownerId
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
        if (!AccommodationService.isAdmin(actor)) {
            dbLogger.warn({ actorId: actor.id }, 'Admin access required');
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new accommodation.
     * @param data - The data for the new accommodation (InsertAccommodation type from db-types)
     * @param actor - The user creating the accommodation (must be an admin or the owner).
     * @returns The created accommodation record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertAccommodation, actor: UserType): Promise<AccommodationRecord> {
        dbLogger.info({ actor: actor.id }, 'creating accommodation');

        // Check if actor is owner or admin
        AccommodationService.assertOwnerOrAdmin(data.ownerId, actor);

        try {
            const createdAccommodation = await AccommodationModel.createAccommodation({
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            });

            dbLogger.info(
                {
                    accommodationId: createdAccommodation.id
                },
                'accommodation created successfully'
            );

            return createdAccommodation;
        } catch (error) {
            dbLogger.error(error, 'failed to create accommodation');
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
        dbLogger.info(
            {
                accommodationId: id,
                actor: actor.id
            },
            'fetching accommodation by id'
        );

        try {
            const accommodation = await AccommodationModel.getAccommodationById(id);
            const existingAccommodation = assertExists(
                accommodation,
                `Accommodation ${id} not found`
            );

            dbLogger.info(
                {
                    accommodationId: existingAccommodation.id
                },
                'accommodation fetched successfully'
            );
            return existingAccommodation;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch accommodation by id');
            throw error;
        }
    }

    /**
     * Get a single accommodation by slug.
     * @param slug - The slug of the accommodation to fetch.
     * @param actor - The user performing the action.
     * @returns The accommodation record.
     * @throws Error if accommodation is not found.
     */
    async getBySlug(slug: string, actor: UserType): Promise<AccommodationRecord> {
        dbLogger.info(
            {
                slug,
                actor: actor.id
            },
            'fetching destination by slug'
        );

        try {
            // Use the listAccommodation method with a filter for the slug
            const accommodation = await AccommodationModel.getAccommodationBySlug(slug);
            const existingAccommodation = assertExists(
                accommodation,
                `Accommodation with slug '${slug}' not found`
            );

            dbLogger.info(
                {
                    accommodationId: existingAccommodation.id,
                    slug
                },
                'destination fetched by slug successfully'
            );
            return existingAccommodation;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch accommodation by slug');
            throw error;
        }
    }

    /**
     * List accommodations with optional filters, pagination, and search.
     * @param filter - Filtering and pagination options.
     * @param actor - The user performing the action.
     * @returns Array of accommodation records.
     * @throws Error if listing fails.
     */
    async list(filter: SelectAccommodationFilter, actor: UserType): Promise<AccommodationRecord[]> {
        dbLogger.info({ filter, actor: actor.id }, 'listing accommodations');

        try {
            const accommodations = await AccommodationModel.listAccommodations(filter);
            dbLogger.info(
                {
                    count: accommodations.length,
                    filter
                },
                'accommodations listed successfully'
            );
            return accommodations;
        } catch (error) {
            dbLogger.error(error, 'failed to list accommodations');
            throw error;
        }
    }

    /**
     * Update fields on an existing accommodation.
     * @param id - The ID of the accommodation to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action.
     * @returns The updated accommodation record.
     * @throws Error if accommodation is not found, actor is not authorized, or update fails.
     */
    async update(
        id: string,
        changes: Partial<UpdateAccommodationData>,
        actor: UserType
    ): Promise<AccommodationRecord> {
        dbLogger.info(
            {
                accommodationId: id,
                actor: actor.id
            },
            'updating accommodation'
        );

        const existingAccommodation = await this.getById(id, actor);

        // Check if actor is owner or admin
        AccommodationService.assertOwnerOrAdmin(existingAccommodation.ownerId, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            // Add updatedById only to the final update object
            const updateData: UpdateAccommodationData = {
                ...(dataToUpdate as UpdateAccommodationData)
            };

            // Only add updatedById if it exists in UpdateAccommodationData
            if ('updatedById' in updateData) {
                updateData.updatedById = actor.id;
            }

            // Use the model for the update instead of direct db access
            const updatedAccommodation = await AccommodationModel.updateAccommodation(
                id,
                updateData
            );

            dbLogger.info(
                {
                    accommodationId: updatedAccommodation.id
                },
                'accommodation updated successfully'
            );

            return updatedAccommodation;
        } catch (error) {
            dbLogger.error(error, 'failed to update accommodation');
            throw error;
        }
    }

    /**
     * Soft-delete an accommodation by setting the deletedAt timestamp.
     * @param id - The ID of the accommodation to delete.
     * @param actor - The user performing the action.
     * @throws Error if accommodation is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                accommodationId: id,
                actor: actor.id
            },
            'soft deleting accommodation'
        );

        const existingAccommodation = await this.getById(id, actor);

        // Check if actor is owner or admin
        AccommodationService.assertOwnerOrAdmin(existingAccommodation.ownerId, actor);

        try {
            // Use the model for soft-deletion with the deletedById field
            const updateData: UpdateAccommodationData = {
                deletedAt: new Date(),
                deletedById: actor.id
            };

            await AccommodationModel.updateAccommodation(id, updateData);

            dbLogger.info(
                {
                    accommodationId: existingAccommodation.id
                },
                'accommodation soft deleted successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete accommodation');
            throw error;
        }
    }

    /**
     * Restore a soft-deleted accommodation by clearing the deletedAt timestamp.
     * @param id - The ID of the accommodation to restore.
     * @param actor - The user performing the action.
     * @throws Error if accommodation is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                accommodationId: id,
                actor: actor.id
            },
            'restoring accommodation'
        );

        const existingAccommodation = await this.getById(id, actor);

        // Check if actor is owner or admin
        AccommodationService.assertOwnerOrAdmin(existingAccommodation.ownerId, actor);

        try {
            // Use the model for restoration
            const updateData: UpdateAccommodationData = {
                deletedAt: null,
                deletedById: null
            };

            await AccommodationModel.updateAccommodation(id, updateData);

            dbLogger.info(
                {
                    accommodationId: existingAccommodation.id
                },
                'accommodation restored successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to restore accommodation');
            throw error;
        }
    }

    /**
     * Permanently delete an accommodation record from the database.
     * @param id - The ID of the accommodation to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if accommodation is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                accommodationId: id,
                actor: actor.id
            },
            'hard deleting accommodation'
        );

        // Only admins can hard delete
        AccommodationService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await AccommodationModel.hardDeleteAccommodation(id);
            dbLogger.info({ accommodationId: id }, 'accommodation hard deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete accommodation');
            throw error;
        }
    }

    /**
     * Get accommodations by owner ID.
     * @param ownerId - The ID of the owner.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of accommodation records.
     * @throws Error if actor is not authorized or listing fails.
     */
    async getByOwner(
        ownerId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationRecord[]> {
        dbLogger.info(
            {
                ownerId,
                actor: actor.id,
                filter
            },
            'fetching accommodations by owner id'
        );

        // Check if actor is owner or admin
        AccommodationService.assertOwnerOrAdmin(ownerId, actor);

        try {
            const accommodationFilter: SelectAccommodationFilter = {
                ownerId,
                ...filter,
                includeDeleted: false
            };

            const accommodations = await AccommodationModel.listAccommodations(accommodationFilter);
            dbLogger.info(
                {
                    ownerId,
                    count: accommodations.length
                },
                'accommodations by owner fetched successfully'
            );
            return accommodations;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch accommodations by owner');
            throw error;
        }
    }

    /**
     * Get accommodations by type.
     * @param type - The accommodation type.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of accommodation records.
     * @throws Error if listing fails.
     */
    async getByType(
        type: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationRecord[]> {
        dbLogger.info(
            {
                type,
                actor: actor.id,
                filter
            },
            'fetching accommodations by type'
        );

        try {
            const accommodationFilter: SelectAccommodationFilter = {
                type,
                ...filter,
                includeDeleted: false
            };

            const accommodations = await AccommodationModel.listAccommodations(accommodationFilter);
            dbLogger.info(
                {
                    type,
                    count: accommodations.length
                },
                'accommodations by type fetched successfully'
            );
            return accommodations;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch accommodations by type');
            throw error;
        }
    }

    /**
     * Get accommodations by state.
     * @param state - The accommodation state.
     * @param actor - The user performing the action (must be an admin).
     * @param filter - Pagination options.
     * @returns Array of accommodation records.
     * @throws Error if actor is not authorized or listing fails.
     */
    async getByState(
        state: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationRecord[]> {
        dbLogger.info(
            {
                state,
                actor: actor.id,
                filter
            },
            'fetching accommodations by state'
        );

        // Only admins can filter by state
        AccommodationService.assertAdmin(actor);

        try {
            const accommodationFilter: SelectAccommodationFilter = {
                state,
                ...filter,
                includeDeleted: false
            };

            const accommodations = await AccommodationModel.listAccommodations(accommodationFilter);
            dbLogger.info(
                {
                    state,
                    count: accommodations.length
                },
                'accommodations by state fetched successfully'
            );
            return accommodations;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch accommodations by state');
            throw error;
        }
    }

    /**
     * List accommodations by destination.
     * @param destinationId - The ID of the destination.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of accommodation records.
     * @throws Error if listing fails.
     */
    async listByDestination(
        destinationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationRecord[]> {
        dbLogger.info(
            {
                destinationId,
                actor: actor.id,
                filter
            },
            'listing accommodations by destination'
        );

        try {
            const accommodationFilter: SelectAccommodationFilter = {
                destinationId,
                ...filter,
                includeDeleted: false
            };

            const accommodations = await AccommodationModel.listAccommodations(accommodationFilter);
            dbLogger.info(
                {
                    destinationId,
                    count: accommodations.length
                },
                'accommodations by destination listed successfully'
            );
            return accommodations;
        } catch (error) {
            dbLogger.error(error, 'failed to list accommodations by destination');
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
        data: Record<string, unknown>,
        actor: UserType
    ): Promise<AccommodationReviewRecord> {
        dbLogger.info(
            {
                accommodationId,
                actor: actor.id
            },
            'adding review to accommodation'
        );

        // Verify accommodation exists
        const accommodation = await this.getById(accommodationId, actor);

        try {
            const reviewData = {
                ...data,
                accommodationId: accommodation.id,
                createdById: actor.id,
                updatedById: actor.id
            };

            const review = await AccommodationReviewModel.createReview(reviewData);
            dbLogger.info(
                {
                    accommodationId,
                    reviewId: review.id
                },
                'review added successfully'
            );
            return review;
        } catch (error) {
            dbLogger.error(error, 'failed to add review');
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
    async listReviews(
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

        // Verify accommodation exists
        await this.getById(accommodationId, actor);

        try {
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
        dbLogger.info(
            {
                accommodationId,
                actor: actor.id
            },
            'calculating average rating for accommodation'
        );

        // Verify accommodation exists
        await this.getById(accommodationId, actor);

        try {
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

            dbLogger.info(
                {
                    accommodationId,
                    averageRating
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
     * Get top-rated accommodations.
     * @param limit - The maximum number of accommodations to return.
     * @param actor - The user performing the action.
     * @returns Array of top-rated accommodation records.
     * @throws Error if listing fails.
     */
    async getTopRated(limit: number, actor: UserType): Promise<AccommodationRecord[]> {
        dbLogger.info(
            {
                limit,
                actor: actor.id
            },
            'fetching top-rated accommodations'
        );

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

            dbLogger.info(
                {
                    count: topRated.length
                },
                'top-rated accommodations fetched successfully'
            );
            return topRated;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch top-rated accommodations');
            throw error;
        }
    }

    /**
     * Search accommodations by text.
     * @param query - The search query.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of matching accommodation records.
     * @throws Error if search fails.
     */
    async searchFullText(
        query: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationRecord[]> {
        dbLogger.info(
            {
                query,
                actor: actor.id,
                filter
            },
            'searching accommodations'
        );

        try {
            const searchFilter: SelectAccommodationFilter = {
                query,
                ...filter,
                includeDeleted: false
            };

            const accommodations = await AccommodationModel.listAccommodations(searchFilter);
            dbLogger.info(
                {
                    query,
                    count: accommodations.length
                },
                'accommodations search completed successfully'
            );
            return accommodations;
        } catch (error) {
            dbLogger.error(error, 'failed to search accommodations');
            throw error;
        }
    }

    /**
     * List amenities for an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of amenity records.
     * @throws Error if accommodation is not found or listing fails.
     */
    async listAmenities(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AmenityRecord[]> {
        dbLogger.info(
            {
                accommodationId,
                actor: actor.id,
                filter
            },
            'listing amenities for accommodation'
        );

        // Verify accommodation exists
        await this.getById(accommodationId, actor);

        try {
            // Get all the amenity relations for this accommodation
            const amenityFilter: SelectAccommodationAmenityFilter = {
                accommodationId,
                ...filter,
                includeDeleted: false
            };

            // First, get all the accommodation-amenity relations
            const relations = await AccommodationAmenityModel.listAmenityRelations(amenityFilter);

            // Then get the actual amenity records for each relation
            const amenities: AmenityRecord[] = [];
            for (const relation of relations) {
                const amenity = await AmenityModel.getAmenityById(relation.amenityId);
                if (amenity && !amenity.deletedAt) {
                    amenities.push(amenity);
                }
            }

            dbLogger.info(
                {
                    accommodationId,
                    count: amenities.length
                },
                'amenities listed successfully'
            );

            return amenities;
        } catch (error) {
            dbLogger.error(error, 'failed to list amenities');
            throw error;
        }
    }

    /**
     * List features for an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of feature records.
     * @throws Error if accommodation is not found or listing fails.
     */
    async listFeatures(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<FeatureRecord[]> {
        dbLogger.info(
            {
                accommodationId,
                actor: actor.id,
                filter
            },
            'listing features for accommodation'
        );

        // Verify accommodation exists
        await this.getById(accommodationId, actor);

        try {
            // Get all the feature relations for this accommodation
            const featureFilter: SelectAccommodationFeatureFilter = {
                accommodationId,
                ...filter,
                includeDeleted: false
            };

            // First, get all the accommodation-feature relations
            const relations = await AccommodationFeatureModel.listFeatureRelations(featureFilter);

            // Then get the actual feature records for each relation
            const features: FeatureRecord[] = [];
            for (const relation of relations) {
                const feature = await FeatureModel.getFeatureById(relation.featureId);
                if (feature && !feature.deletedAt) {
                    features.push(feature);
                }
            }

            dbLogger.info(
                {
                    accommodationId,
                    count: features.length
                },
                'features listed successfully'
            );

            return features;
        } catch (error) {
            dbLogger.error(error, 'failed to list features');
            throw error;
        }
    }

    /**
     * List FAQs for an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of FAQ records.
     * @throws Error if accommodation is not found or listing fails.
     */
    async listFaqs(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationFaqRecord[]> {
        dbLogger.info(
            {
                accommodationId,
                actor: actor.id,
                filter
            },
            'listing FAQs for accommodation'
        );

        // Verify accommodation exists
        await this.getById(accommodationId, actor);

        try {
            const faqFilter: SelectAccommodationFaqFilter = {
                accommodationId,
                ...filter,
                includeDeleted: false
            };

            const faqs = await AccommodationFaqModel.listFaqs(faqFilter);
            dbLogger.info(
                {
                    accommodationId,
                    count: faqs.length
                },
                'FAQs listed successfully'
            );
            return faqs;
        } catch (error) {
            dbLogger.error(error, 'failed to list FAQs');
            throw error;
        }
    }

    /**
     * List IA data for an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of IA data records.
     * @throws Error if accommodation is not found, actor is not authorized, or listing fails.
     */
    async listIaData(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationIaDataRecord[]> {
        dbLogger.info(
            {
                accommodationId,
                actor: actor.id,
                filter
            },
            'listing IA data for accommodation'
        );

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
            dbLogger.info(
                {
                    accommodationId,
                    count: iaData.length
                },
                'IA data listed successfully'
            );
            return iaData;
        } catch (error) {
            dbLogger.error(error, 'failed to list IA data');
            throw error;
        }
    }

    /**
     * Add an amenity to an accommodation.
     * This creates a relationship record in the accommodation_amenities table.
     * @param accommodationId - The ID of the accommodation.
     * @param amenityId - The ID of the amenity to add.
     * @param isOptional - Whether the amenity is optional.
     * @param additionalCost - Additional cost for using the amenity.
     * @param additionalCostPercent - Additional cost as a percentage.
     * @param actor - The user performing the action.
     * @returns The created relationship record.
     * @throws Error if accommodation or amenity is not found, actor is not authorized, or creation fails.
     */
    async addAmenity(
        accommodationId: string,
        amenityId: string,
        isOptional: boolean,
        actor: UserType,
        additionalCost: Record<string, unknown> | null = null,
        additionalCostPercent: number | null = null
    ): Promise<{ relation: AccommodationAmenityRecord; amenity: AmenityRecord }> {
        dbLogger.info(
            {
                accommodationId,
                amenityId,
                actor: actor.id
            },
            'adding amenity to accommodation'
        );

        const accommodation = await this.getById(accommodationId, actor);

        // Check if actor is owner or admin
        AccommodationService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        // Verify amenity exists
        const amenity = await AmenityModel.getAmenityById(amenityId);
        if (!amenity) {
            throw new Error(`Amenity ${amenityId} not found`);
        }

        try {
            // Create the relationship
            const relationData = {
                accommodationId,
                amenityId,
                isOptional,
                additionalCost,
                additionalCostPercent,
                createdById: actor.id,
                updatedById: actor.id
            };

            const relation = await AccommodationAmenityModel.createAmenityRelation(relationData);

            dbLogger.info(
                {
                    accommodationId,
                    amenityId
                },
                'amenity added to accommodation successfully'
            );

            return {
                relation,
                amenity
            };
        } catch (error) {
            dbLogger.error(error, 'failed to add amenity to accommodation');
            throw error;
        }
    }

    /**
     * Add a feature to an accommodation.
     * This creates a relationship record in the accommodation_features table.
     * @param accommodationId - The ID of the accommodation.
     * @param featureId - The ID of the feature to add.
     * @param hostReWriteName - Optional custom name for the feature.
     * @param comments - Optional comments about the feature.
     * @param actor - The user performing the action.
     * @returns The created relationship record and the feature.
     * @throws Error if accommodation or feature is not found, actor is not authorized, or creation fails.
     */
    async addFeature(
        accommodationId: string,
        featureId: string,
        hostReWriteName: string | null,
        comments: string | null,
        actor: UserType
    ): Promise<{ relation: AccommodationFeatureRecord; feature: FeatureRecord }> {
        dbLogger.info(
            {
                accommodationId,
                featureId,
                actor: actor.id
            },
            'adding feature to accommodation'
        );

        const accommodation = await this.getById(accommodationId, actor);

        // Check if actor is owner or admin
        AccommodationService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        // Verify feature exists
        const feature = await FeatureModel.getFeatureById(featureId);
        if (!feature) {
            throw new Error(`Feature ${featureId} not found`);
        }

        try {
            // Create the relationship
            const relationData = {
                accommodationId,
                featureId,
                hostReWriteName,
                comments,
                createdById: actor.id,
                updatedById: actor.id
            };

            const relation = await AccommodationFeatureModel.createFeatureRelation(relationData);

            dbLogger.info(
                {
                    accommodationId,
                    featureId
                },
                'feature added to accommodation successfully'
            );

            return {
                relation,
                feature
            };
        } catch (error) {
            dbLogger.error(error, 'failed to add feature to accommodation');
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
        data: Record<string, unknown>,
        actor: UserType
    ): Promise<AccommodationFaqRecord> {
        dbLogger.info(
            {
                accommodationId,
                actor: actor.id
            },
            'adding FAQ to accommodation'
        );

        const accommodation = await this.getById(accommodationId, actor);

        // Check if actor is owner or admin
        AccommodationService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            const faqData = {
                ...data,
                accommodationId: accommodation.id,
                createdById: actor.id,
                updatedById: actor.id
            };

            const faq = await AccommodationFaqModel.createFaq(faqData);
            dbLogger.info(
                {
                    accommodationId,
                    faqId: faq.id
                },
                'FAQ added successfully'
            );
            return faq;
        } catch (error) {
            dbLogger.error(error, 'failed to add FAQ');
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
        data: Record<string, unknown>,
        actor: UserType
    ): Promise<AccommodationIaDataRecord> {
        dbLogger.info(
            {
                accommodationId,
                actor: actor.id
            },
            'adding IA data to accommodation'
        );

        const accommodation = await this.getById(accommodationId, actor);

        // Check if actor is owner or admin
        AccommodationService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            const iaDataData = {
                ...data,
                accommodationId: accommodation.id,
                createdById: actor.id,
                updatedById: actor.id
            };

            const iaData = await AccommodationIaDataModel.createIaData(iaDataData);
            dbLogger.info(
                {
                    accommodationId,
                    iaDataId: iaData.id
                },
                'IA data added successfully'
            );
            return iaData;
        } catch (error) {
            dbLogger.error(error, 'failed to add IA data');
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
            amenities: AmenityRecord[];
            features: FeatureRecord[];
            faqs: AccommodationFaqRecord[];
            iaData: AccommodationIaDataRecord[];
            reviews: AccommodationReviewRecord[];
        }
    > {
        dbLogger.info(
            {
                accommodationId: id,
                actor: actor.id
            },
            'fetching accommodation with details'
        );

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

            dbLogger.info(
                {
                    accommodationId: id
                },
                'accommodation with details fetched successfully'
            );
            return result;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch accommodation with details');
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
        dbLogger.info(
            {
                accommodationId,
                tagId,
                actor: actor.id
            },
            'adding tag to accommodation'
        );

        const accommodation = await this.getById(accommodationId, actor);

        // Check if actor is owner or admin
        AccommodationService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            const entityType: EntityTypeEnum = EntityTypeEnum.ACCOMMODATION;

            const tagData: InsertEntityTagRelation = {
                entityType,
                entityId: accommodation.id,
                tagId
            };

            const tagRelation = await EntityTagModel.createRelation(tagData);
            dbLogger.info(
                {
                    accommodationId,
                    tagId
                },
                'tag added successfully'
            );
            return tagRelation;
        } catch (error) {
            dbLogger.error(error, 'failed to add tag');
            throw error;
        }
    }

    /**
     * Recommend similar accommodations based on type, destination, and features.
     * @param accommodationId - The ID of the accommodation to find similar ones for.
     * @param limit - The maximum number of recommendations to return.
     * @param actor - The user performing the action.
     * @returns Array of similar accommodation records.
     * @throws Error if accommodation is not found or recommendation fails.
     */
    async recommendSimilar(
        accommodationId: string,
        limit: number,
        actor: UserType
    ): Promise<AccommodationRecord[]> {
        dbLogger.info(
            {
                accommodationId,
                limit,
                actor: actor.id
            },
            'recommending similar accommodations'
        );

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

            dbLogger.info(
                {
                    accommodationId,
                    count: recommendations.length
                },
                'similar accommodations recommended successfully'
            );
            return recommendations;
        } catch (error) {
            dbLogger.error(error, 'failed to recommend similar accommodations');
            throw error;
        }
    }
}
