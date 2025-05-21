import { dbLogger } from '@repo/db/utils/logger.js';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    AccommodationAmenityModel,
    type AccommodationAmenityRecord,
    AccommodationModel,
    AmenityModel
} from '../model/index.js';
import type {
    InsertAccommodationAmenity,
    PaginationParams,
    SelectAccommodationAmenityFilter,
    UpdateAccommodationAmenityData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

/**
 * Service layer for managing accommodation amenity operations.
 * Handles business logic, authorization, and interacts with the AccommodationAmenityModel.
 */
export class AccommodationAmenityService {
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
        if (actor.id !== ownerId && !AccommodationAmenityService.isAdmin(actor)) {
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
     * Create a new accommodation-amenity relationship.
     * @param data - The data for the new relationship.
     * @param actor - The user creating the relationship.
     * @returns The created relationship record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(
        data: InsertAccommodationAmenity,
        actor: UserType
    ): Promise<AccommodationAmenityRecord> {
        dbLogger.info({ actor: actor.id }, 'creating accommodation amenity relationship');

        try {
            // Verify accommodation exists
            const accommodation = await AccommodationModel.getAccommodationById(
                data.accommodationId
            );
            if (!accommodation) {
                throw new Error(`Accommodation ${data.accommodationId} not found`);
            }

            // Verify amenity exists
            const amenity = await AmenityModel.getAmenityById(data.amenityId);
            if (!amenity) {
                throw new Error(`Amenity ${data.amenityId} not found`);
            }

            // Check if actor is owner or admin
            AccommodationAmenityService.assertOwnerOrAdmin(accommodation.ownerId, actor);

            const relationData: InsertAccommodationAmenity = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };

            const createdRelation =
                await AccommodationAmenityModel.createAmenityRelation(relationData);
            dbLogger.info(
                {
                    relationId: `${createdRelation.accommodationId}-${createdRelation.amenityId}`
                },
                'accommodation amenity relationship created successfully'
            );

            return createdRelation;
        } catch (error) {
            dbLogger.error(error, 'failed to create accommodation amenity relationship');
            throw error;
        }
    }

    /**
     * Get a single accommodation-amenity relationship by IDs.
     * @param accommodationId - The accommodation ID.
     * @param amenityId - The amenity ID.
     * @param actor - The user performing the action.
     * @returns The relationship record.
     * @throws Error if relationship is not found or actor is not authorized.
     */
    async getByIds(
        accommodationId: string,
        amenityId: string,
        actor: UserType
    ): Promise<AccommodationAmenityRecord> {
        dbLogger.info(
            {
                accommodationId,
                amenityId,
                actor: actor.id
            },
            'fetching accommodation amenity relationship by IDs'
        );

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationAmenityService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            const relation = await AccommodationAmenityModel.getAmenityRelation(
                accommodationId,
                amenityId
            );
            const existingRelation = assertExists(
                relation,
                `Relationship between accommodation ${accommodationId} and amenity ${amenityId} not found`
            );

            dbLogger.info(
                {
                    relationId: `${existingRelation.accommodationId}-${existingRelation.amenityId}`
                },
                'accommodation amenity relationship fetched successfully'
            );

            return existingRelation;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch accommodation amenity relationship by IDs');
            throw error;
        }
    }

    /**
     * List accommodation-amenity relationships for a specific accommodation.
     * @param accommodationId - The accommodation ID.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of relationship records.
     * @throws Error if accommodation is not found, actor is not authorized, or listing fails.
     */
    async listByAccommodation(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationAmenityRecord[]> {
        dbLogger.info(
            {
                accommodationId,
                actor: actor.id,
                filter
            },
            'listing amenity relationships for accommodation'
        );

        try {
            // Verify accommodation exists
            const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
            if (!accommodation) {
                throw new Error(`Accommodation ${accommodationId} not found`);
            }

            const amenityFilter: SelectAccommodationAmenityFilter = {
                accommodationId,
                ...filter,
                includeDeleted: false
            };

            const relations = await AccommodationAmenityModel.listAmenityRelations(amenityFilter);
            dbLogger.info(
                {
                    accommodationId,
                    count: relations.length
                },
                'amenity relationships listed successfully'
            );

            return relations;
        } catch (error) {
            dbLogger.error(error, 'failed to list amenity relationships for accommodation');
            throw error;
        }
    }

    /**
     * Update fields on an existing accommodation-amenity relationship.
     * @param accommodationId - The accommodation ID.
     * @param amenityId - The amenity ID.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action.
     * @returns The updated relationship record.
     * @throws Error if relationship is not found, actor is not authorized, or update fails.
     */
    async update(
        accommodationId: string,
        amenityId: string,
        changes: UpdateAccommodationAmenityData,
        actor: UserType
    ): Promise<AccommodationAmenityRecord> {
        dbLogger.info(
            {
                accommodationId,
                amenityId,
                actor: actor.id
            },
            'updating accommodation amenity relationship'
        );

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationAmenityService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            // Include updatedById in the data to update
            const updateData: UpdateAccommodationAmenityData = {
                ...dataToUpdate,
                updatedById: actor.id
            };

            // Use the model to update
            const updatedRelation = await AccommodationAmenityModel.updateAmenityRelation(
                accommodationId,
                amenityId,
                updateData
            );

            dbLogger.info(
                {
                    relationId: `${updatedRelation.accommodationId}-${updatedRelation.amenityId}`
                },
                'accommodation amenity relationship updated successfully'
            );

            return updatedRelation;
        } catch (error) {
            dbLogger.error(error, 'failed to update accommodation amenity relationship');
            throw error;
        }
    }

    /**
     * Soft-delete an accommodation-amenity relationship.
     * @param accommodationId - The accommodation ID.
     * @param amenityId - The amenity ID.
     * @param actor - The user performing the action.
     * @throws Error if relationship is not found, actor is not authorized, or deletion fails.
     */
    async delete(accommodationId: string, amenityId: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                accommodationId,
                amenityId,
                actor: actor.id
            },
            'soft deleting accommodation amenity relationship'
        );

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationAmenityService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationAmenityModel.softDeleteAmenityRelation(accommodationId, amenityId);
            dbLogger.info(
                {
                    accommodationId,
                    amenityId
                },
                'accommodation amenity relationship soft deleted successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete accommodation amenity relationship');
            throw error;
        }
    }

    /**
     * Restore a soft-deleted accommodation-amenity relationship.
     * @param accommodationId - The accommodation ID.
     * @param amenityId - The amenity ID.
     * @param actor - The user performing the action.
     * @throws Error if relationship is not found, actor is not authorized, or restoration fails.
     */
    async restore(accommodationId: string, amenityId: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                accommodationId,
                amenityId,
                actor: actor.id
            },
            'restoring accommodation amenity relationship'
        );

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationAmenityService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationAmenityModel.restoreAmenityRelation(accommodationId, amenityId);
            dbLogger.info(
                {
                    accommodationId,
                    amenityId
                },
                'accommodation amenity relationship restored successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to restore accommodation amenity relationship');
            throw error;
        }
    }

    /**
     * Hard-delete an accommodation-amenity relationship.
     * @param accommodationId - The accommodation ID.
     * @param amenityId - The amenity ID.
     * @param actor - The user performing the action.
     * @throws Error if relationship is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(accommodationId: string, amenityId: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                accommodationId,
                amenityId,
                actor: actor.id
            },
            'hard deleting accommodation amenity relationship'
        );

        // Only admins can hard delete
        if (!AccommodationAmenityService.isAdmin(actor)) {
            throw new Error('Forbidden: Only admins can permanently delete relationships');
        }

        // Get the accommodation to check existence
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        try {
            await AccommodationAmenityModel.hardDeleteAmenityRelation(accommodationId, amenityId);
            dbLogger.info(
                {
                    accommodationId,
                    amenityId
                },
                'accommodation amenity relationship hard deleted successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete accommodation amenity relationship');
            throw error;
        }
    }

    /**
     * Remove all amenity relationships for a specific accommodation.
     * @param accommodationId - The accommodation ID.
     * @param actor - The user performing the action.
     * @throws Error if accommodation is not found, actor is not authorized, or deletion fails.
     */
    async removeAllFromAccommodation(accommodationId: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                accommodationId,
                actor: actor.id
            },
            'removing all amenity relationships from accommodation'
        );

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationAmenityService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationAmenityModel.deleteAllByAccommodation(accommodationId);
            dbLogger.info(
                {
                    accommodationId
                },
                'all amenity relationships removed from accommodation successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to remove all amenity relationships from accommodation');
            throw error;
        }
    }
}
