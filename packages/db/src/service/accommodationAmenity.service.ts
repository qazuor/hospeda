import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    AccommodationAmenityModel,
    type AccommodationAmenityRecord,
    AccommodationModel,
    type SelectAccommodationAmenityFilter
} from '../model';
import type {
    InsertAccommodationAmenity,
    PaginationParams,
    UpdateAccommodationAmenityData
} from '../types/db-types';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils';

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
     * Create a new amenity entry.
     * @param data - The data for the new amenity entry.
     * @param actor - The user creating the amenity entry.
     * @returns The created amenity record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(
        data: InsertAccommodationAmenity,
        actor: UserType
    ): Promise<AccommodationAmenityRecord> {
        log.info('creating accommodation amenity', 'create', { actor: actor.id });

        try {
            // Verify accommodation exists
            const accommodation = await AccommodationModel.getAccommodationById(
                data.accommodationId
            );
            if (!accommodation) {
                throw new Error(`Accommodation ${data.accommodationId} not found`);
            }

            // Check if actor is owner or admin
            AccommodationAmenityService.assertOwnerOrAdmin(accommodation.ownerId, actor);

            const dataWithAudit: InsertAccommodationAmenity = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdAmenity = await AccommodationAmenityModel.createAmenity(dataWithAudit);
            log.info('accommodation amenity created successfully', 'create', {
                amenityId: createdAmenity.id
            });
            return createdAmenity;
        } catch (error) {
            log.error('failed to create accommodation amenity', 'create', error, {
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get a single amenity entry by ID.
     * @param id - The ID of the amenity entry to fetch.
     * @param actor - The user performing the action.
     * @returns The amenity record.
     * @throws Error if amenity entry is not found or actor is not authorized.
     */
    async getById(id: string, actor: UserType): Promise<AccommodationAmenityRecord> {
        log.info('fetching amenity by id', 'getById', { amenityId: id, actor: actor.id });

        try {
            const amenity = await AccommodationAmenityModel.getAmenityById(id);
            const existingAmenity = assertExists(amenity, `Amenity ${id} not found`);

            // Get the accommodation to check ownership
            const accommodation = await AccommodationModel.getAccommodationById(
                existingAmenity.accommodationId
            );
            if (!accommodation) {
                throw new Error(`Accommodation ${existingAmenity.accommodationId} not found`);
            }

            // Check if actor is owner or admin
            AccommodationAmenityService.assertOwnerOrAdmin(accommodation.ownerId, actor);

            log.info('amenity fetched successfully', 'getById', {
                amenityId: existingAmenity.id
            });
            return existingAmenity;
        } catch (error) {
            log.error('failed to fetch amenity by id', 'getById', error, {
                amenityId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List amenity entries for an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of amenity records.
     * @throws Error if accommodation is not found, actor is not authorized, or listing fails.
     */
    async list(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationAmenityRecord[]> {
        log.info('listing amenities for accommodation', 'list', {
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

            const amenities = await AccommodationAmenityModel.listAmenities(amenityFilter);
            log.info('amenities listed successfully', 'list', {
                accommodationId,
                count: amenities.length
            });
            return amenities;
        } catch (error) {
            log.error('failed to list amenities', 'list', error, {
                accommodationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Update fields on an existing amenity entry.
     * @param id - The ID of the amenity entry to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action.
     * @returns The updated amenity record.
     * @throws Error if amenity entry is not found, actor is not authorized, or update fails.
     */
    async update(
        id: string,
        changes: UpdateAccommodationAmenityData,
        actor: UserType
    ): Promise<AccommodationAmenityRecord> {
        log.info('updating amenity', 'update', { amenityId: id, actor: actor.id });

        const existingAmenity = await this.getById(id, actor);

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(
            existingAmenity.accommodationId
        );
        if (!accommodation) {
            throw new Error(`Accommodation ${existingAmenity.accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationAmenityService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdateAccommodationAmenityData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedAmenity = await AccommodationAmenityModel.updateAmenity(
                existingAmenity.id,
                dataWithAudit
            );
            log.info('amenity updated successfully', 'update', {
                amenityId: updatedAmenity.id
            });
            return updatedAmenity;
        } catch (error) {
            log.error('failed to update amenity', 'update', error, {
                amenityId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Soft-delete an amenity entry by setting the deletedAt timestamp.
     * @param id - The ID of the amenity entry to delete.
     * @param actor - The user performing the action.
     * @throws Error if amenity entry is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        log.info('soft deleting amenity', 'delete', { amenityId: id, actor: actor.id });

        const existingAmenity = await this.getById(id, actor);

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(
            existingAmenity.accommodationId
        );
        if (!accommodation) {
            throw new Error(`Accommodation ${existingAmenity.accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationAmenityService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationAmenityModel.softDeleteAmenity(id);
            log.info('amenity soft deleted successfully', 'delete', { amenityId: id });
        } catch (error) {
            log.error('failed to soft delete amenity', 'delete', error, {
                amenityId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Restore a soft-deleted amenity entry by clearing the deletedAt timestamp.
     * @param id - The ID of the amenity entry to restore.
     * @param actor - The user performing the action.
     * @throws Error if amenity entry is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        log.info('restoring amenity', 'restore', { amenityId: id, actor: actor.id });

        const existingAmenity = await this.getById(id, actor);

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(
            existingAmenity.accommodationId
        );
        if (!accommodation) {
            throw new Error(`Accommodation ${existingAmenity.accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationAmenityService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationAmenityModel.restoreAmenity(id);
            log.info('amenity restored successfully', 'restore', { amenityId: id });
        } catch (error) {
            log.error('failed to restore amenity', 'restore', error, {
                amenityId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Permanently delete an amenity entry record from the database.
     * @param id - The ID of the amenity entry to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if amenity entry is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        log.info('hard deleting amenity', 'hardDelete', { amenityId: id, actor: actor.id });

        // Only admins can hard delete
        if (!AccommodationAmenityService.isAdmin(actor)) {
            throw new Error('Forbidden: Only admins can permanently delete amenities');
        }

        await this.getById(id, actor);

        try {
            await AccommodationAmenityModel.hardDeleteAmenity(id);
            log.info('amenity hard deleted successfully', 'hardDelete', { amenityId: id });
        } catch (error) {
            log.error('failed to hard delete amenity', 'hardDelete', error, {
                amenityId: id,
                actor: actor.id
            });
            throw error;
        }
    }
}
