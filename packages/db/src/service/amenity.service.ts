import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import { AmenityModel, type AmenityRecord } from '../model/amenity.model.js';
import type { InsertAmenity, SelectAmenityFilter, UpdateAmenityData } from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

const log = logger.createLogger('AmenityService');

/**
 * Service layer for managing amenity operations.
 * Handles business logic, authorization, and interacts with the AmenityModel.
 */
export class AmenityService {
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
        if (!AmenityService.isAdmin(actor)) {
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new amenity.
     * @param data - The data for the new amenity.
     * @param actor - The user creating the amenity (must be an admin).
     * @returns The created amenity record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertAmenity, actor: UserType): Promise<AmenityRecord> {
        log.info('creating amenity', 'create', { actor: actor.id });

        // Only admins can create amenities
        AmenityService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertAmenity = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdAmenity = await AmenityModel.createAmenity(dataWithAudit);
            log.info('amenity created successfully', 'create', { amenityId: createdAmenity.id });
            return createdAmenity;
        } catch (error) {
            log.error('failed to create amenity', 'create', error, { actor: actor.id });
            throw error;
        }
    }

    /**
     * Get a single amenity by ID.
     * @param id - The ID of the amenity to fetch.
     * @param actor - The user performing the action.
     * @returns The amenity record.
     * @throws Error if amenity is not found.
     */
    async getById(id: string, actor: UserType): Promise<AmenityRecord> {
        log.info('fetching amenity by id', 'getById', { amenityId: id, actor: actor.id });

        try {
            const amenity = await AmenityModel.getAmenityById(id);
            const existingAmenity = assertExists(amenity, `Amenity ${id} not found`);

            log.info('amenity fetched successfully', 'getById', { amenityId: existingAmenity.id });
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
     * List amenities with optional filters, pagination, and search.
     * @param filter - Filtering and pagination options.
     * @param actor - The user performing the action.
     * @returns Array of amenity records.
     * @throws Error if listing fails.
     */
    async list(filter: SelectAmenityFilter, actor: UserType): Promise<AmenityRecord[]> {
        log.info('listing amenities', 'list', { filter, actor: actor.id });

        try {
            const amenities = await AmenityModel.listAmenities(filter);
            log.info('amenities listed successfully', 'list', {
                count: amenities.length,
                filter
            });
            return amenities;
        } catch (error) {
            log.error('failed to list amenities', 'list', error, { filter, actor: actor.id });
            throw error;
        }
    }

    /**
     * Update fields on an existing amenity.
     * @param id - The ID of the amenity to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated amenity record.
     * @throws Error if amenity is not found, actor is not authorized, or update fails.
     */
    async update(id: string, changes: UpdateAmenityData, actor: UserType): Promise<AmenityRecord> {
        log.info('updating amenity', 'update', { amenityId: id, actor: actor.id });

        // Only admins can update amenities
        AmenityService.assertAdmin(actor);

        const existingAmenity = await this.getById(id, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            // Include updatedById in the update data
            const updateData: UpdateAmenityData = {
                ...dataToUpdate,
                updatedById: actor.id
            };

            // Use the model to perform the update
            const updatedAmenity = await AmenityModel.updateAmenity(existingAmenity.id, updateData);

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
     * Soft-delete an amenity by setting the deletedAt timestamp.
     * @param id - The ID of the amenity to delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if amenity is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        log.info('soft deleting amenity', 'delete', { amenityId: id, actor: actor.id });

        // Only admins can delete amenities
        AmenityService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            // Use the model to update deleteAt and deletedById
            const updateData: UpdateAmenityData = {
                deletedAt: new Date(),
                deletedById: actor.id
            };

            await AmenityModel.updateAmenity(id, updateData);

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
     * Restore a soft-deleted amenity by clearing the deletedAt timestamp.
     * @param id - The ID of the amenity to restore.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if amenity is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        log.info('restoring amenity', 'restore', { amenityId: id, actor: actor.id });

        // Only admins can restore amenities
        AmenityService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            // Use the model to clear deletedAt and deletedById
            const updateData: UpdateAmenityData = {
                deletedAt: null,
                deletedById: null
            };

            await AmenityModel.updateAmenity(id, updateData);

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
     * Permanently delete an amenity record from the database.
     * @param id - The ID of the amenity to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if amenity is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        log.info('hard deleting amenity', 'hardDelete', { amenityId: id, actor: actor.id });

        // Only admins can hard delete
        AmenityService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await AmenityModel.hardDeleteAmenity(id);
            log.info('amenity hard deleted successfully', 'hardDelete', { amenityId: id });
        } catch (error) {
            log.error('failed to hard delete amenity', 'hardDelete', error, {
                amenityId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get amenities by type.
     * @param type - The amenity type to filter by.
     * @param actor - The user performing the action.
     * @param filter - Additional filter and pagination options.
     * @returns Array of amenity records with the specified type.
     * @throws Error if listing fails.
     */
    async getByType(
        type: string,
        actor: UserType,
        filter: Omit<SelectAmenityFilter, 'type'> = {}
    ): Promise<AmenityRecord[]> {
        log.info('fetching amenities by type', 'getByType', {
            type,
            actor: actor.id,
            filter
        });

        try {
            const amenityFilter: SelectAmenityFilter = {
                ...filter,
                type,
                includeDeleted: false
            };

            const amenities = await AmenityModel.listAmenities(amenityFilter);
            log.info('amenities fetched by type successfully', 'getByType', {
                type,
                count: amenities.length
            });
            return amenities;
        } catch (error) {
            log.error('failed to fetch amenities by type', 'getByType', error, {
                type,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get built-in amenities.
     * @param actor - The user performing the action.
     * @param filter - Additional filter and pagination options.
     * @returns Array of built-in amenity records.
     * @throws Error if listing fails.
     */
    async getBuiltIn(
        actor: UserType,
        filter: Omit<SelectAmenityFilter, 'isBuiltin'> = {}
    ): Promise<AmenityRecord[]> {
        log.info('fetching built-in amenities', 'getBuiltIn', {
            actor: actor.id,
            filter
        });

        try {
            const amenityFilter: SelectAmenityFilter = {
                ...filter,
                isBuiltin: true,
                includeDeleted: false
            };

            const amenities = await AmenityModel.listAmenities(amenityFilter);
            log.info('built-in amenities fetched successfully', 'getBuiltIn', {
                count: amenities.length
            });
            return amenities;
        } catch (error) {
            log.error('failed to fetch built-in amenities', 'getBuiltIn', error, {
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get custom (non-built-in) amenities.
     * @param actor - The user performing the action.
     * @param filter - Additional filter and pagination options.
     * @returns Array of custom amenity records.
     * @throws Error if listing fails.
     */
    async getCustom(
        actor: UserType,
        filter: Omit<SelectAmenityFilter, 'isBuiltin'> = {}
    ): Promise<AmenityRecord[]> {
        log.info('fetching custom amenities', 'getCustom', {
            actor: actor.id,
            filter
        });

        try {
            const amenityFilter: SelectAmenityFilter = {
                ...filter,
                isBuiltin: false,
                includeDeleted: false
            };

            const amenities = await AmenityModel.listAmenities(amenityFilter);
            log.info('custom amenities fetched successfully', 'getCustom', {
                count: amenities.length
            });
            return amenities;
        } catch (error) {
            log.error('failed to fetch custom amenities', 'getCustom', error, {
                actor: actor.id
            });
            throw error;
        }
    }
}
