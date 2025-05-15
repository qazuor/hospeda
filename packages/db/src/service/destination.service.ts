import { logger } from '@repo/logger';
import {
    BuiltinRoleTypeEnum,
    type DestinationRatingType,
    EntityTypeEnum,
    type UserType
} from '@repo/types';
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
} from '../model';
import { BookmarkModel } from '../model/bookmark.model';
import type {
    InsertDestination,
    InsertDestinationAttraction,
    InsertDestinationReview,
    InsertEntityTagRelation,
    PaginationParams,
    SelectDestinationAttractionFilter,
    SelectDestinationFilter,
    UpdateDestinationData
} from '../types/db-types';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils';

const log = logger.createLogger('DestinationService');

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
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
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
        log.info('creating destination', 'create', { actor: actor.id });

        // Only admins can create destinations
        DestinationService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertDestination = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdDestination = await DestinationModel.createDestination(dataWithAudit);
            log.info('destination created successfully', 'create', {
                destinationId: createdDestination.id
            });
            return createdDestination;
        } catch (error) {
            log.error('failed to create destination', 'create', error, { actor: actor.id });
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
        log.info('fetching destination by id', 'getById', {
            destinationId: id,
            actor: actor.id
        });

        try {
            const destination = await DestinationModel.getDestinationById(id);
            const existingDestination = assertExists(destination, `Destination ${id} not found`);

            log.info('destination fetched successfully', 'getById', {
                destinationId: existingDestination.id
            });
            return existingDestination;
        } catch (error) {
            log.error('failed to fetch destination by id', 'getById', error, {
                destinationId: id,
                actor: actor.id
            });
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
        log.info('fetching destination by slug', 'getBySlug', {
            slug,
            actor: actor.id
        });

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

            log.info('destination fetched by slug successfully', 'getBySlug', {
                destinationId: existingDestination.id,
                slug
            });
            return existingDestination;
        } catch (error) {
            log.error('failed to fetch destination by slug', 'getBySlug', error, {
                slug,
                actor: actor.id
            });
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
        log.info('listing destinations', 'list', { filter, actor: actor.id });

        try {
            const destinations = await DestinationModel.listDestinations(filter);
            log.info('destinations listed successfully', 'list', {
                count: destinations.length,
                filter
            });
            return destinations;
        } catch (error) {
            log.error('failed to list destinations', 'list', error, {
                filter,
                actor: actor.id
            });
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
        log.info('updating destination', 'update', {
            destinationId: id,
            actor: actor.id
        });

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
            log.info('destination updated successfully', 'update', {
                destinationId: updatedDestination.id
            });
            return updatedDestination;
        } catch (error) {
            log.error('failed to update destination', 'update', error, {
                destinationId: id,
                actor: actor.id
            });
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
        log.info('soft deleting destination', 'delete', { destinationId: id, actor: actor.id });

        // Only admins can delete destinations
        DestinationService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await DestinationModel.softDeleteDestination(id);
            log.info('destination soft deleted successfully', 'delete', { destinationId: id });
        } catch (error) {
            log.error('failed to soft delete destination', 'delete', error, {
                destinationId: id,
                actor: actor.id
            });
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
        log.info('restoring destination', 'restore', { destinationId: id, actor: actor.id });

        // Only admins can restore destinations
        DestinationService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await DestinationModel.restoreDestination(id);
            log.info('destination restored successfully', 'restore', { destinationId: id });
        } catch (error) {
            log.error('failed to restore destination', 'restore', error, {
                destinationId: id,
                actor: actor.id
            });
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
        log.info('hard deleting destination', 'hardDelete', { destinationId: id, actor: actor.id });

        // Only admins can hard delete
        DestinationService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await DestinationModel.hardDeleteDestination(id);
            log.info('destination hard deleted successfully', 'hardDelete', { destinationId: id });
        } catch (error) {
            log.error('failed to hard delete destination', 'hardDelete', error, {
                destinationId: id,
                actor: actor.id
            });
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
        log.info('fetching destinations by visibility', 'getByVisibility', {
            visibility,
            actor: actor.id,
            filter
        });

        try {
            const destinationFilter: SelectDestinationFilter = {
                visibility,
                ...filter,
                includeDeleted: false
            };

            const destinations = await DestinationModel.listDestinations(destinationFilter);
            log.info('destinations fetched by visibility successfully', 'getByVisibility', {
                visibility,
                count: destinations.length
            });
            return destinations;
        } catch (error) {
            log.error('failed to fetch destinations by visibility', 'getByVisibility', error, {
                visibility,
                actor: actor.id
            });
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
        log.info('adding attraction to destination', 'addAttraction', {
            destinationId,
            actor: actor.id
        });

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
            log.info('attraction added to destination successfully', 'addAttraction', {
                destinationId,
                attractionId: attraction.id
            });
            return attraction;
        } catch (error) {
            log.error('failed to add attraction to destination', 'addAttraction', error, {
                destinationId,
                actor: actor.id
            });
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
        log.info('removing attraction from destination', 'removeAttraction', {
            destinationId,
            attractionId,
            actor: actor.id
        });

        // Only admins can remove attractions
        DestinationService.assertAdmin(actor);

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            await DestinationAttractionModel.softDeleteAttraction(attractionId);
            log.info('attraction removed from destination successfully', 'removeAttraction', {
                destinationId,
                attractionId
            });
        } catch (error) {
            log.error('failed to remove attraction from destination', 'removeAttraction', error, {
                destinationId,
                attractionId,
                actor: actor.id
            });
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
        log.info('listing attractions for destination', 'listAttractions', {
            destinationId,
            actor: actor.id,
            filter
        });

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            const attractionFilter: SelectDestinationAttractionFilter = {
                ...filter,
                includeDeleted: false
            };

            const attractions = await DestinationAttractionModel.listAttractions(attractionFilter);
            log.info('attractions listed for destination successfully', 'listAttractions', {
                destinationId,
                count: attractions.length
            });
            return attractions;
        } catch (error) {
            log.error('failed to list attractions for destination', 'listAttractions', error, {
                destinationId,
                actor: actor.id
            });
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
        log.info('adding review to destination', 'addReview', {
            destinationId,
            actor: actor.id
        });

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
            log.info('review added to destination successfully', 'addReview', {
                destinationId,
                reviewId: review.id
            });
            return review;
        } catch (error) {
            log.error('failed to add review to destination', 'addReview', error, {
                destinationId,
                actor: actor.id
            });
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
        log.info('removing review from destination', 'removeReview', {
            destinationId,
            reviewId,
            actor: actor.id
        });

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
            log.info('review removed from destination successfully', 'removeReview', {
                destinationId,
                reviewId
            });
        } catch (error) {
            log.error('failed to remove review from destination', 'removeReview', error, {
                destinationId,
                reviewId,
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
    async listReviews(
        destinationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<DestinationReviewRecord[]> {
        log.info('listing reviews for destination', 'listReviews', {
            destinationId,
            actor: actor.id,
            filter
        });

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            const reviews = await DestinationReviewModel.listReviews({
                destinationId,
                ...filter,
                includeDeleted: false
            });
            log.info('reviews listed for destination successfully', 'listReviews', {
                destinationId,
                count: reviews.length
            });
            return reviews;
        } catch (error) {
            log.error('failed to list reviews for destination', 'listReviews', error, {
                destinationId,
                actor: actor.id
            });
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
        log.info('getting destination stats', 'getStats', {
            destinationId,
            actor: actor.id
        });

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

            log.info('destination stats retrieved successfully', 'getStats', {
                destinationId,
                stats
            });
            return stats;
        } catch (error) {
            log.error('failed to get destination stats', 'getStats', error, {
                destinationId,
                actor: actor.id
            });
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
        log.info('finding destinations nearby', 'findNearby', {
            latitude,
            longitude,
            radiusKm,
            actor: actor.id,
            filter
        });

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

            log.info('nearby destinations found successfully', 'findNearby', {
                count: nearbyDestinations.length,
                latitude,
                longitude,
                radiusKm
            });
            return nearbyDestinations;
        } catch (error) {
            log.error('failed to find destinations nearby', 'findNearby', error, {
                latitude,
                longitude,
                radiusKm,
                actor: actor.id
            });
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
        log.info('listing top destinations', 'listTop', {
            limit,
            actor: actor.id
        });

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

            log.info('top destinations listed successfully', 'listTop', {
                count: topDestinations.length
            });
            return topDestinations;
        } catch (error) {
            log.error('failed to list top destinations', 'listTop', error, {
                limit,
                actor: actor.id
            });
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
        log.info('updating destination visibility', 'updateVisibility', {
            destinationId: id,
            visibility,
            actor: actor.id
        });

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
            log.info('destination visibility updated successfully', 'updateVisibility', {
                destinationId: updatedDestination.id,
                visibility
            });
            return updatedDestination;
        } catch (error) {
            log.error('failed to update destination visibility', 'updateVisibility', error, {
                destinationId: id,
                visibility,
                actor: actor.id
            });
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
        log.info('getting featured destinations', 'getFeatured', {
            limit,
            actor: actor.id
        });

        try {
            const destinationFilter: SelectDestinationFilter = {
                isFeatured: true,
                limit,
                includeDeleted: false
            };

            const destinations = await DestinationModel.listDestinations(destinationFilter);
            log.info('featured destinations retrieved successfully', 'getFeatured', {
                count: destinations.length
            });
            return destinations;
        } catch (error) {
            log.error('failed to get featured destinations', 'getFeatured', error, {
                limit,
                actor: actor.id
            });
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
        log.info('getting tags for destination', 'getTags', {
            destinationId,
            actor: actor.id
        });

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

            log.info('tags retrieved for destination successfully', 'getTags', {
                destinationId,
                count: tags.length
            });
            return tags;
        } catch (error) {
            log.error('failed to get tags for destination', 'getTags', error, {
                destinationId,
                actor: actor.id
            });
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
        log.info('adding tag to destination', 'addTag', {
            destinationId,
            tagId,
            actor: actor.id
        });

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
            log.info('tag added to destination successfully', 'addTag', {
                destinationId,
                tagId
            });
            return relation;
        } catch (error) {
            log.error('failed to add tag to destination', 'addTag', error, {
                destinationId,
                tagId,
                actor: actor.id
            });
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
        log.info('removing tag from destination', 'removeTag', {
            destinationId,
            tagId,
            actor: actor.id
        });

        // Only admins can remove tags from destinations
        DestinationService.assertAdmin(actor);

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            await EntityTagModel.deleteRelation(EntityTypeEnum.DESTINATION, destinationId, tagId);
            log.info('tag removed from destination successfully', 'removeTag', {
                destinationId,
                tagId
            });
        } catch (error) {
            log.error('failed to remove tag from destination', 'removeTag', error, {
                destinationId,
                tagId,
                actor: actor.id
            });
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
        log.info('getting bookmark count for destination', 'getBookmarkCount', {
            destinationId,
            actor: actor.id
        });

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            const bookmarks = await BookmarkModel.selectBookmarks({
                entityType: EntityTypeEnum.DESTINATION,
                entityId: destinationId,
                includeDeleted: false
            });

            log.info('bookmark count retrieved successfully', 'getBookmarkCount', {
                destinationId,
                count: bookmarks.length
            });
            return bookmarks.length;
        } catch (error) {
            log.error('failed to get bookmark count for destination', 'getBookmarkCount', error, {
                destinationId,
                actor: actor.id
            });
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
        log.info('checking if destination is bookmarked', 'isBookmarked', {
            destinationId,
            userId,
            actor: actor.id
        });

        // Verify destination exists
        await this.getById(destinationId, actor);

        try {
            const exists = await BookmarkModel.exists(
                userId,
                EntityTypeEnum.DESTINATION,
                destinationId
            );

            log.info('bookmark check completed successfully', 'isBookmarked', {
                destinationId,
                userId,
                isBookmarked: exists
            });
            return exists;
        } catch (error) {
            log.error('failed to check if destination is bookmarked', 'isBookmarked', error, {
                destinationId,
                userId,
                actor: actor.id
            });
            throw error;
        }
    }
}
