import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import { and, eq } from 'drizzle-orm';
import { db } from '../client.js';
import {
    AccommodationAmenityModel,
    type AccommodationAmenityRecord,
    AccommodationModel,
    AmenityModel
} from '../model/index.js';
import { accommodationAmenities } from '../schema/index.js';
import type {
    InsertAccommodationAmenity,
    PaginationParams,
    SelectAccommodationAmenityFilter,
    UpdateAccommodationAmenityData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

const log = logger.createLogger('AccommodationAmenityService');

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
            log.warn('Forbidden access attempt', 'assertOwnerOrAdmin', {
                actorId: actor.id,
                requiredOwnerId: ownerId
            });
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
        log.info('creating accommodation amenity relationship', 'create', { actor: actor.id });

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
            log.info('accommodation amenity relationship created successfully', 'create', {
                relationId: `${createdRelation.accommodationId}-${createdRelation.amenityId}`
            });

            return createdRelation;
        } catch (error) {
            log.error('failed to create accommodation amenity relationship', 'create', error, {
                actor: actor.id
            });
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
        log.info('fetching accommodation amenity relationship by IDs', 'getByIds', {
            accommodationId,
            amenityId,
            actor: actor.id
        });

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

            log.info('accommodation amenity relationship fetched successfully', 'getByIds', {
                relationId: `${existingRelation.accommodationId}-${existingRelation.amenityId}`
            });

            return existingRelation;
        } catch (error) {
            log.error(
                'failed to fetch accommodation amenity relationship by IDs',
                'getByIds',
                error,
                {
                    accommodationId,
                    amenityId,
                    actor: actor.id
                }
            );
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
        log.info('listing amenity relationships for accommodation', 'listByAccommodation', {
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

            const amenityFilter: SelectAccommodationAmenityFilter = {
                accommodationId,
                ...filter,
                includeDeleted: false
            };

            const relations = await AccommodationAmenityModel.listAmenityRelations(amenityFilter);
            log.info('amenity relationships listed successfully', 'listByAccommodation', {
                accommodationId,
                count: relations.length
            });

            return relations;
        } catch (error) {
            log.error(
                'failed to list amenity relationships for accommodation',
                'listByAccommodation',
                error,
                {
                    accommodationId,
                    actor: actor.id
                }
            );
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
        log.info('updating accommodation amenity relationship', 'update', {
            accommodationId,
            amenityId,
            actor: actor.id
        });

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationAmenityService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            // First, update the regular fields
            await AccommodationAmenityModel.updateAmenityRelation(
                accommodationId,
                amenityId,
                dataToUpdate
            );

            // Then update the audit field with a direct query
            await db
                .update(accommodationAmenities)
                .set({ updatedById: actor.id })
                .where(
                    and(
                        eq(accommodationAmenities.accommodationId, accommodationId),
                        eq(accommodationAmenities.amenityId, amenityId)
                    )
                );

            // Fetch the updated record
            const relation = await AccommodationAmenityModel.getAmenityRelation(
                accommodationId,
                amenityId
            );
            if (!relation) {
                throw new Error(
                    `Failed to retrieve updated relation for accommodation ${accommodationId} and amenity ${amenityId}`
                );
            }

            log.info('accommodation amenity relationship updated successfully', 'update', {
                relationId: `${relation.accommodationId}-${relation.amenityId}`
            });

            return relation;
        } catch (error) {
            log.error('failed to update accommodation amenity relationship', 'update', error, {
                accommodationId,
                amenityId,
                actor: actor.id
            });
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
        log.info('soft deleting accommodation amenity relationship', 'delete', {
            accommodationId,
            amenityId,
            actor: actor.id
        });

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationAmenityService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationAmenityModel.softDeleteAmenityRelation(accommodationId, amenityId);
            log.info('accommodation amenity relationship soft deleted successfully', 'delete', {
                accommodationId,
                amenityId
            });
        } catch (error) {
            log.error('failed to soft delete accommodation amenity relationship', 'delete', error, {
                accommodationId,
                amenityId,
                actor: actor.id
            });
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
        log.info('restoring accommodation amenity relationship', 'restore', {
            accommodationId,
            amenityId,
            actor: actor.id
        });

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationAmenityService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationAmenityModel.restoreAmenityRelation(accommodationId, amenityId);
            log.info('accommodation amenity relationship restored successfully', 'restore', {
                accommodationId,
                amenityId
            });
        } catch (error) {
            log.error('failed to restore accommodation amenity relationship', 'restore', error, {
                accommodationId,
                amenityId,
                actor: actor.id
            });
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
        log.info('hard deleting accommodation amenity relationship', 'hardDelete', {
            accommodationId,
            amenityId,
            actor: actor.id
        });

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
            log.info('accommodation amenity relationship hard deleted successfully', 'hardDelete', {
                accommodationId,
                amenityId
            });
        } catch (error) {
            log.error(
                'failed to hard delete accommodation amenity relationship',
                'hardDelete',
                error,
                {
                    accommodationId,
                    amenityId,
                    actor: actor.id
                }
            );
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
        log.info(
            'removing all amenity relationships from accommodation',
            'removeAllFromAccommodation',
            {
                accommodationId,
                actor: actor.id
            }
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
            log.info(
                'all amenity relationships removed from accommodation successfully',
                'removeAllFromAccommodation',
                {
                    accommodationId
                }
            );
        } catch (error) {
            log.error(
                'failed to remove all amenity relationships from accommodation',
                'removeAllFromAccommodation',
                error,
                {
                    accommodationId,
                    actor: actor.id
                }
            );
            throw error;
        }
    }
}
