import { dbLogger } from '@repo/db/utils/logger.js';
import {
    BuiltinRoleTypeEnum,
    type DestinationRatingType,
    EntityTypeEnum,
    type UserType
} from '@repo/types';
import { BookmarkModel } from '../model/bookmark.model.js';
import {
    DestinationAttractionModel,
    type DestinationAttractionRecord,
    DestinationModel,
    type DestinationRecord,
    DestinationReviewModel,
    type DestinationReviewRecord,
    EntityTagModel,
    type EntityTagRecord,
    TagModel,
    type TagRecord
} from '../model/index.js';
import type {
    InsertDestination,
    InsertDestinationAttraction,
    InsertDestinationReview,
    InsertEntityTagRelation,
    PaginationParams,
    SelectDestinationAttractionFilter,
    SelectDestinationFilter,
    UpdateDestinationData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

/**
 * Service layer for managing destination operations.
 * Handles business logic, authorization, and interacts with the DestinationModel and related models.
 */
export class DestinationService {
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
        if (!DestinationService.isAdmin(actor)) {
            dbLogger.warn({ actorId: actor.id }, 'Admin access required');
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new destination.
     * @param data - The data for the new destination.
     * @param actor - The user creating the destination (must be an admin).
     * @returns The created destination record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertDestination, actor: UserType): Promise<DestinationRecord> {
        dbLogger.info({ actor: actor.id }, 'creating destination');

        // Only admins can create destinations
        DestinationService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertDestination = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdDestination = await DestinationModel.createDestination(dataWithAudit);
            dbLogger.info(
                {
                    destinationId: createdDestination.id
                },
                'destination created successfully'
            );
            return createdDestination;
        } catch (error) {
            dbLogger.error(error, 'failed to create destination');
            throw error;
        }
    }

    /**
     * Get a single destination by ID.
     * @param id - The ID of the destination to fetch.
     * @param actor - The user performing the action.
     * @returns The destination record.
     * @throws Error if destination is not found.
     */
    async getById(id: string, actor: UserType): Promise<DestinationRecord> {
        dbLogger.info(
            {
                destinationId: id,
                actor: actor.id
            },
            'fetching destination by id'
        );

        try {
            const destination = await DestinationModel.getDestinationById(id);
            const existingDestination = assertExists(destination, `Destination ${id} not found`);

            dbLogger.info(
                {
                    destinationId: existingDestination.id
                },
                'destination fetched successfully'
            );
            return existingDestination;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch destination by id');
            throw error;
        }
    }

    /**
     * Get a single destination by slug.
     * @param slug - The slug of the destination to fetch.
     * @param actor - The user performing the action.
     * @returns The destination record.
     * @throws Error if destination is not found.
     */
    async getBySlug(slug: string, actor: UserType): Promise<DestinationRecord> {
        dbLogger.info(
            {
                slug,
                actor: actor.id
            },
            'fetching destination by slug'
        );

        try {
            // Use the listDestinations method with a filter for the slug
            const destinations = await DestinationModel.listDestinations({
                query: slug, // This will search in name, displayName, summary, description, and slug
                limit: 1,
                includeDeleted: false
            });

            // Find the exact match for slug
            const destination = destinations.find((d) => d.slug === slug);
            const existingDestination = assertExists(
                destination,
                `Destination with slug '${slug}' not found`
            );

            dbLogger.info(
                {
                    destinationId: existingDestination.id,
                    slug
                },
                'destination fetched by slug successfully'
            );
            return existingDestination;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch destination by slug');
            throw error;
        }
    }

    /**
     * List destinations with optional filters, pagination, and search.
     * @param filter - Filtering and pagination options.
     * @param actor - The user performing the action.
     * @returns Array of destination records.
     * @throws Error if listing fails.
     */
    async list(filter: SelectDestinationFilter, actor: UserType): Promise<DestinationRecord[]> {
        dbLogger.info({ filter, actor: actor.id }, 'listing destinations');

        try {
            const destinations = await DestinationModel.listDestinations(filter);
            dbLogger.info(
                {
                    count: destinations.length,
                    filter
                },
                'destinations listed successfully'
            );
            return destinations;
        } catch (error) {
            dbLogger.error(error, 'failed to list destinations');
            throw error;
        }
    }

    /**
     * Update fields on an existing destination.
     * @param id - The ID of the destination to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated destination record.
     * @throws Error if destination is not found, actor is not authorized, or update fails.
     */
    async update(
        id: string,
        changes: UpdateDestinationData,
        actor: UserType
    ): Promise<DestinationRecord> {
        dbLogger.info(
            {
                destinationId: id,
                actor: actor.id
            },
            'updating destination'
        );

        // Only admins can update destinations
        DestinationService.assertAdmin(actor);

        const existingDestination = await this.getById(id, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdateDestinationData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedDestination = await DestinationModel.updateDestination(
                existingDestination.id,
                dataWithAudit
            );
            dbLogger.info(
                {
                    destinationId: updatedDestination.id
                },
                'destination updated successfully'
            );
            return updatedDestination;
        } catch (error) {
            dbLogger.error(error, 'failed to update destination');
            throw error;
        }
    }

    /**
     * Soft-delete a destination by setting the deletedAt timestamp.
     * @param id - The ID of the destination to delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if destination is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                destinationId: id,
                actor: actor.id
            },
            'soft deleting destination'
        );

        // Only admins can delete destinations
        DestinationService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await DestinationModel.softDeleteDestination(id);
            dbLogger.info({ destinationId: id }, 'destination soft deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete destination');
            throw error;
        }
    }

    /**
     * Restore a soft-deleted destination by clearing the deletedAt timestamp.
     * @param id - The ID of the destination to restore.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if destination is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ destinationId: id, actor: actor.id }, 'restoring destination');

        // Only admins can restore destinations
        DestinationService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await DestinationModel.restoreDestination(id);
            dbLogger.info({ destinationId: id }, 'destination restored successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to restore destination');
            throw error;
        }
    }

    /**
     * Permanently delete a destination record from the database.
     * @param id - The ID of the destination to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if destination is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                destinationId: id,
                actor: actor.id
            },
            'hard deleting destination'
        );

        // Only admins can hard delete
        DestinationService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await DestinationModel.hardDeleteDestination(id);
            dbLogger.info({ destinationId: id }, 'destination hard deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete destination');
            throw error;
        }
    }

    /**
     * Get destinations by visibility.
     * @param visibility - The visibility to filter by.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of destination records with the specified visibility.
     * @throws Error if listing fails.
     */
    async getByVisibility(
        visibility: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<DestinationRecord[]> {
        dbLogger.info(
            {
                visibility,
                actor: actor.id,
                filter
            },
            'fetching destinations by visibility'
        );

        try {
            const destinationFilter: SelectDestinationFilter = {
                visibility,
                ...filter,
                includeDeleted: false
            };

            const destinations = await DestinationModel.listDestinations(destinationFilter);
            dbLogger.info(
                {
                    visibility,
                    count: destinations.length
                },
                'destinations fetched by visibility successfully'
            );
            return destinations;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch destinations by visibility');
            throw error;
        }
    }

    /**
     * Add an attraction to a destination.
     * @param destinationId - The ID of the destination.
     * @param data - The attraction data.
     * @param actor - The user performing the action (must be an admin).
     * @returns The created attraction record.
     * @throws Error if destination is not found, actor is not authorized, or creation fails.
     */
    async addAttraction(
        destinationId: string,
        data: InsertDestinationAttraction,
        actor: UserType
    ): Promise<DestinationAttractionRecord> {
        dbLogger.info(
            {
                destinationId,
                actor: actor.id
            },
            'adding attraction to destination'
        );

        // Only admins can add attractions
        DestinationService.assertAdmin(actor);

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            const attractionData: InsertDestinationAttraction = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };

            const attraction = await DestinationAttractionModel.createAttraction(attractionData);
            dbLogger.info(
                {
                    destinationId,
                    attractionId: attraction.id
                },
                'attraction added to destination successfully'
            );
            return attraction;
        } catch (error) {
            dbLogger.error(error, 'failed to add attraction to destination');
            throw error;
        }
    }

    /**
     * Remove an attraction from a destination.
     * @param destinationId - The ID of the destination.
     * @param attractionId - The ID of the attraction.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if destination or attraction is not found, actor is not authorized, or deletion fails.
     */
    async removeAttraction(
        destinationId: string,
        attractionId: string,
        actor: UserType
    ): Promise<void> {
        dbLogger.info(
            {
                destinationId,
                attractionId,
                actor: actor.id
            },
            'removing attraction from destination'
        );

        // Only admins can remove attractions
        DestinationService.assertAdmin(actor);

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            await DestinationAttractionModel.softDeleteAttraction(attractionId);
            dbLogger.info(
                {
                    destinationId,
                    attractionId
                },
                'attraction removed from destination successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to remove attraction from destination');
            throw error;
        }
    }

    /**
     * List attractions for a destination.
     * @param destinationId - The ID of the destination.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of attraction records.
     * @throws Error if destination is not found or listing fails.
     */
    async listAttractions(
        destinationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<DestinationAttractionRecord[]> {
        dbLogger.info(
            {
                destinationId,
                actor: actor.id,
                filter
            },
            'listing attractions for destination'
        );

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            const attractionFilter: SelectDestinationAttractionFilter = {
                ...filter,
                includeDeleted: false
            };

            const attractions = await DestinationAttractionModel.listAttractions(attractionFilter);
            dbLogger.info(
                {
                    destinationId,
                    count: attractions.length
                },
                'attractions listed for destination successfully'
            );
            return attractions;
        } catch (error) {
            dbLogger.error(error, 'failed to list attractions for destination');
            throw error;
        }
    }

    /**
     * Add a review to a destination.
     * @param destinationId - The ID of the destination.
     * @param data - The review data.
     * @param actor - The user performing the action.
     * @returns The created review record.
     * @throws Error if destination is not found or review creation fails.
     */
    async addReview(
        destinationId: string,
        data: InsertDestinationReview,
        actor: UserType
    ): Promise<DestinationReviewRecord> {
        dbLogger.info(
            {
                destinationId,
                actor: actor.id
            },
            'adding review to destination'
        );

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            const reviewData: InsertDestinationReview = {
                ...data,
                destinationId,
                createdById: actor.id,
                updatedById: actor.id
            };

            const review = await DestinationReviewModel.createReview(reviewData);
            dbLogger.info(
                {
                    destinationId,
                    reviewId: review.id
                },
                'review added to destination successfully'
            );
            return review;
        } catch (error) {
            dbLogger.error(error, 'failed to add review to destination');
            throw error;
        }
    }

    /**
     * Remove a review from a destination.
     * @param destinationId - The ID of the destination.
     * @param reviewId - The ID of the review.
     * @param actor - The user performing the action.
     * @throws Error if destination or review is not found, actor is not authorized, or deletion fails.
     */
    async removeReview(destinationId: string, reviewId: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                destinationId,
                reviewId,
                actor: actor.id
            },
            'removing review from destination'
        );

        // Verify destination exists
        await this.getById(destinationId, actor);

        // Get the review to check ownership
        const review = await DestinationReviewModel.getReviewById(reviewId);
        if (!review) {
            throw new Error(`Review ${reviewId} not found`);
        }

        // Only the review creator or an admin can remove a review
        if (review.createdById !== actor.id && !DestinationService.isAdmin(actor)) {
            throw new Error('Forbidden: You can only remove your own reviews');
        }

        try {
            await DestinationReviewModel.softDeleteReview(reviewId);
            dbLogger.info(
                {
                    destinationId,
                    reviewId
                },
                'review removed from destination successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to remove review from destination');
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
    async listReviews(
        destinationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<DestinationReviewRecord[]> {
        dbLogger.info(
            {
                destinationId,
                actor: actor.id,
                filter
            },
            'listing reviews for destination'
        );

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            const reviews = await DestinationReviewModel.listReviews({
                destinationId,
                ...filter,
                includeDeleted: false
            });
            dbLogger.info(
                {
                    destinationId,
                    count: reviews.length
                },
                'reviews listed for destination successfully'
            );
            return reviews;
        } catch (error) {
            dbLogger.error(error, 'failed to list reviews for destination');
            throw error;
        }
    }

    /**
     * Get statistics for a destination.
     * @param destinationId - The ID of the destination.
     * @param actor - The user performing the action.
     * @returns Statistics for the destination.
     * @throws Error if destination is not found or stats calculation fails.
     */
    async getStats(
        destinationId: string,
        actor: UserType
    ): Promise<{
        reviewCount: number;
        averageRating: DestinationRatingType;
        attractionCount: number;
        bookmarkCount: number;
    }> {
        dbLogger.info(
            {
                destinationId,
                actor: actor.id
            },
            'getting destination stats'
        );

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            // Get reviews
            const reviews = await DestinationReviewModel.listReviews({
                destinationId,
                includeDeleted: false
            });

            // Calculate average rating
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

            if (reviews.length > 0) {
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
                for (const key of Object.keys(averageRating) as Array<
                    keyof DestinationRatingType
                >) {
                    averageRating[key] = Number((averageRating[key] / reviews.length).toFixed(1));
                }
            }

            // Get attractions
            const attractions = await DestinationAttractionModel.listAttractions({
                includeDeleted: false
            });

            // Get bookmark count
            const bookmarks = await BookmarkModel.selectBookmarks({
                entityType: EntityTypeEnum.DESTINATION,
                entityId: destinationId,
                includeDeleted: false
            });

            const stats = {
                reviewCount: reviews.length,
                averageRating,
                attractionCount: attractions.length,
                bookmarkCount: bookmarks.length
            };

            dbLogger.info(
                {
                    destinationId,
                    stats
                },
                'destination stats retrieved successfully'
            );
            return stats;
        } catch (error) {
            dbLogger.error(error, 'failed to get destination stats');
            throw error;
        }
    }

    /**
     * Find destinations near a specific location.
     * @param latitude - The latitude coordinate.
     * @param longitude - The longitude coordinate.
     * @param radiusKm - The search radius in kilometers.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of nearby destination records.
     * @throws Error if search fails.
     */
    async findNearby(
        latitude: number,
        longitude: number,
        radiusKm: number,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<DestinationRecord[]> {
        dbLogger.info(
            {
                latitude,
                longitude,
                radiusKm,
                actor: actor.id,
                filter
            },
            'finding destinations nearby'
        );

        try {
            // Get all active destinations
            const allDestinations = await DestinationModel.listDestinations({
                ...filter,
                includeDeleted: false
            });

            // Filter destinations by distance
            // This is a simplified approach - in a real application, you would use
            // a spatial database query or a more efficient algorithm
            const nearbyDestinations = allDestinations.filter((destination) => {
                // Skip destinations without coordinates
                if (!destination.location || !destination.location.coordinates) {
                    return false;
                }

                const destCoords = destination.location.coordinates;
                const destLat = Number.parseFloat(String(destCoords.lat));
                const destLong = Number.parseFloat(String(destCoords.long));

                // Calculate distance using Haversine formula
                const distance = this.calculateDistance(latitude, longitude, destLat, destLong);

                return distance <= radiusKm;
            });

            dbLogger.info(
                {
                    count: nearbyDestinations.length,
                    latitude,
                    longitude,
                    radiusKm
                },
                'nearby destinations found successfully'
            );
            return nearbyDestinations;
        } catch (error) {
            dbLogger.error(error, 'failed to find destinations nearby');
            throw error;
        }
    }

    /**
     * Calculate distance between two coordinates using the Haversine formula.
     * @param lat1 - Latitude of first point.
     * @param lon1 - Longitude of first point.
     * @param lat2 - Latitude of second point.
     * @param lon2 - Longitude of second point.
     * @returns Distance in kilometers.
     */
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) *
                Math.cos(this.deg2rad(lat2)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance;
    }

    /**
     * Convert degrees to radians.
     * @param deg - Angle in degrees.
     * @returns Angle in radians.
     */
    private deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    /**
     * List top destinations based on ratings and reviews.
     * @param limit - The maximum number of destinations to return.
     * @param actor - The user performing the action.
     * @returns Array of top destination records.
     * @throws Error if listing fails.
     */
    async listTop(limit: number, actor: UserType): Promise<DestinationRecord[]> {
        dbLogger.info(
            {
                limit,
                actor: actor.id
            },
            'listing top destinations'
        );

        try {
            // Get all active destinations
            const allDestinations = await DestinationModel.listDestinations({
                includeDeleted: false
            });

            // For each destination, calculate an overall score based on reviews
            const scoredDestinations = await Promise.all(
                allDestinations.map(async (destination) => {
                    const stats = await this.getStats(destination.id, actor);

                    // Calculate overall score (average of all rating categories)
                    const ratingValues = Object.values(stats.averageRating) as number[];
                    const averageRating =
                        ratingValues.reduce((sum, val) => sum + val, 0) / ratingValues.length;

                    // Score is a combination of average rating and review count
                    const score = averageRating * (1 + Math.min(stats.reviewCount / 10, 1));

                    return {
                        destination,
                        score
                    };
                })
            );

            // Sort by score and take the top 'limit'
            const topDestinations = scoredDestinations
                .sort((a, b) => b.score - a.score)
                .slice(0, limit)
                .map((item) => item.destination);

            dbLogger.info(
                { count: topDestinations.length },
                'top destinations listed successfully'
            );
            return topDestinations;
        } catch (error) {
            dbLogger.error(error, 'failed to list top destinations');
            throw error;
        }
    }

    /**
     * Update the visibility of a destination.
     * @param id - The ID of the destination to update.
     * @param visibility - The new visibility value.
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated destination record.
     * @throws Error if destination is not found, actor is not authorized, or update fails.
     */
    async updateVisibility(
        id: string,
        visibility: string,
        actor: UserType
    ): Promise<DestinationRecord> {
        dbLogger.info(
            {
                destinationId: id,
                visibility,
                actor: actor.id
            },
            'updating destination visibility'
        );

        // Only admins can update visibility
        DestinationService.assertAdmin(actor);

        const existingDestination = await this.getById(id, actor);

        try {
            const changes: UpdateDestinationData = {
                visibility,
                updatedById: actor.id
            };
            const updatedDestination = await DestinationModel.updateDestination(
                existingDestination.id,
                changes
            );
            dbLogger.info(
                {
                    destinationId: updatedDestination.id,
                    visibility
                },
                'destination visibility updated successfully'
            );
            return updatedDestination;
        } catch (error) {
            dbLogger.error(error, 'failed to update destination visibility');
            throw error;
        }
    }

    /**
     * Get featured destinations.
     * @param limit - The maximum number of destinations to return.
     * @param actor - The user performing the action.
     * @returns Array of featured destination records.
     * @throws Error if listing fails.
     */
    async getFeatured(limit: number, actor: UserType): Promise<DestinationRecord[]> {
        dbLogger.info(
            {
                limit,
                actor: actor.id
            },
            'getting featured destinations'
        );

        try {
            const destinationFilter: SelectDestinationFilter = {
                isFeatured: true,
                limit,
                includeDeleted: false
            };

            const destinations = await DestinationModel.listDestinations(destinationFilter);
            dbLogger.info(
                {
                    count: destinations.length
                },
                'featured destinations retrieved successfully'
            );
            return destinations;
        } catch (error) {
            dbLogger.error(error, 'failed to get featured destinations');
            throw error;
        }
    }

    /**
     * Get tags for a destination.
     * @param destinationId - The ID of the destination.
     * @param actor - The user performing the action.
     * @returns Array of tag records.
     * @throws Error if destination is not found or listing fails.
     */
    async getTags(destinationId: string, actor: UserType): Promise<TagRecord[]> {
        dbLogger.info(
            {
                destinationId,
                actor: actor.id
            },
            'getting tags for destination'
        );

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            const relations = await EntityTagModel.listRelations({
                entityType: EntityTypeEnum.DESTINATION,
                entityId: destinationId
            });

            const tags: TagRecord[] = [];
            for (const relation of relations) {
                const tag = await TagModel.getTagById(relation.tagId);
                if (tag) {
                    tags.push(tag);
                }
            }

            dbLogger.info(
                {
                    destinationId,
                    count: tags.length
                },
                'tags retrieved for destination successfully'
            );
            return tags;
        } catch (error) {
            dbLogger.error(error, 'failed to get tags for destination');
            throw error;
        }
    }

    /**
     * Add a tag to a destination.
     * @param destinationId - The ID of the destination.
     * @param tagId - The ID of the tag.
     * @param actor - The user performing the action (must be an admin).
     * @returns The created entity-tag relation record.
     * @throws Error if destination or tag is not found, actor is not authorized, or creation fails.
     */
    async addTag(destinationId: string, tagId: string, actor: UserType): Promise<EntityTagRecord> {
        dbLogger.info(
            {
                destinationId,
                tagId,
                actor: actor.id
            },
            'adding tag to destination'
        );

        // Only admins can add tags to destinations
        DestinationService.assertAdmin(actor);

        // Verify destination exists
        await this.getById(destinationId, actor);

        // Verify tag exists
        const tag = await TagModel.getTagById(tagId);
        if (!tag) {
            throw new Error(`Tag ${tagId} not found`);
        }

        try {
            const relationData: InsertEntityTagRelation = {
                entityType: EntityTypeEnum.DESTINATION,
                entityId: destinationId,
                tagId
            };

            const relation = await EntityTagModel.createRelation(relationData);
            dbLogger.info(
                {
                    destinationId,
                    tagId
                },
                'tag added to destination successfully'
            );
            return relation;
        } catch (error) {
            dbLogger.error(error, 'failed to add tag to destination');
            throw error;
        }
    }

    /**
     * Remove a tag from a destination.
     * @param destinationId - The ID of the destination.
     * @param tagId - The ID of the tag.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if destination or tag is not found, actor is not authorized, or removal fails.
     */
    async removeTag(destinationId: string, tagId: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                destinationId,
                tagId,
                actor: actor.id
            },
            'removing tag from destination'
        );

        // Only admins can remove tags from destinations
        DestinationService.assertAdmin(actor);

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            await EntityTagModel.deleteRelation(EntityTypeEnum.DESTINATION, destinationId, tagId);
            dbLogger.info(
                {
                    destinationId,
                    tagId
                },
                'tag removed from destination successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to remove tag from destination');
            throw error;
        }
    }

    /**
     * Get the number of bookmarks for a destination.
     * @param destinationId - The ID of the destination.
     * @param actor - The user performing the action.
     * @returns The number of bookmarks.
     * @throws Error if destination is not found or count fails.
     */
    async getBookmarkCount(destinationId: string, actor: UserType): Promise<number> {
        dbLogger.info(
            {
                destinationId,
                actor: actor.id
            },
            'getting bookmark count for destination'
        );

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            const bookmarks = await BookmarkModel.selectBookmarks({
                entityType: EntityTypeEnum.DESTINATION,
                entityId: destinationId,
                includeDeleted: false
            });

            dbLogger.info(
                {
                    destinationId,
                    count: bookmarks.length
                },
                'bookmark count retrieved successfully'
            );
            return bookmarks.length;
        } catch (error) {
            dbLogger.error(error, 'failed to get bookmark count for destination');
            throw error;
        }
    }

    /**
     * Check if a destination is bookmarked by a user.
     * @param destinationId - The ID of the destination.
     * @param userId - The ID of the user.
     * @param actor - The user performing the action.
     * @returns Whether the destination is bookmarked by the user.
     * @throws Error if destination is not found or check fails.
     */
    async isBookmarked(destinationId: string, userId: string, actor: UserType): Promise<boolean> {
        dbLogger.info(
            {
                destinationId,
                userId,
                actor: actor.id
            },
            'checking if destination is bookmarked'
        );

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            const exists = await BookmarkModel.exists(
                userId,
                EntityTypeEnum.DESTINATION,
                destinationId
            );

            dbLogger.info(
                {
                    destinationId,
                    userId,
                    isBookmarked: exists
                },
                'bookmark check completed successfully'
            );
            return exists;
        } catch (error) {
            dbLogger.error(error, 'failed to check if destination is bookmarked');
            throw error;
        }
    }
}
