import { dbLogger } from '@repo/db/utils/logger.js';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import { AmenityModel, type AmenityRecord } from '../model/amenity.model.js';
import type { InsertAmenity, SelectAmenityFilter, UpdateAmenityData } from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

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
            dbLogger.warn({ actorId: actor.id }, 'Admin access required');
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
        dbLogger.info({ actor: actor.id }, 'creating amenity');

        // Only admins can create amenities
        AmenityService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertAmenity = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdAmenity = await AmenityModel.createAmenity(dataWithAudit);
            dbLogger.info({ amenityId: createdAmenity.id }, 'amenity created successfully');
            return createdAmenity;
        } catch (error) {
            dbLogger.error(error, 'failed to create amenity');
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
        dbLogger.info({ amenityId: id, actor: actor.id }, 'fetching amenity by id');

        try {
            const amenity = await AmenityModel.getAmenityById(id);
            const existingAmenity = assertExists(amenity, `Amenity ${id} not found`);

            dbLogger.info({ amenityId: existingAmenity.id }, 'amenity fetched successfully');
            return existingAmenity;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch amenity by id');
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
        dbLogger.info({ filter, actor: actor.id }, 'listing amenities');

        try {
            const amenities = await AmenityModel.listAmenities(filter);
            dbLogger.info({ count: amenities.length, filter }, 'amenities listed successfully');
            return amenities;
        } catch (error) {
            dbLogger.error(error, 'failed to list amenities');
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
        dbLogger.info({ amenityId: id, actor: actor.id }, 'updating amenity');

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

            dbLogger.info({ amenityId: updatedAmenity.id }, 'amenity updated successfully');
            return updatedAmenity;
        } catch (error) {
            dbLogger.error(error, 'failed to update amenity');
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
        dbLogger.info({ amenityId: id, actor: actor.id }, 'soft deleting amenity');

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

            dbLogger.info({ amenityId: id }, 'amenity soft deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete amenity');
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
        dbLogger.info({ amenityId: id, actor: actor.id }, 'restoring amenity');

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

            dbLogger.info({ amenityId: id }, 'amenity restored successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to restore amenity');
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
        dbLogger.info({ amenityId: id, actor: actor.id }, 'hard deleting amenity');

        // Only admins can hard delete
        AmenityService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await AmenityModel.hardDeleteAmenity(id);
            dbLogger.info({ amenityId: id }, 'amenity hard deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete amenity');
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
        dbLogger.info({ type, actor: actor.id, filter }, 'fetching amenities by type');

        try {
            const amenityFilter: SelectAmenityFilter = {
                ...filter,
                type,
                includeDeleted: false
            };

            const amenities = await AmenityModel.listAmenities(amenityFilter);
            dbLogger.info(
                { type, count: amenities.length },
                'amenities fetched by type successfully'
            );
            return amenities;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch amenities by type');
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
        dbLogger.info({ actor: actor.id, filter }, 'fetching built-in amenities');

        try {
            const amenityFilter: SelectAmenityFilter = {
                ...filter,
                isBuiltin: true,
                includeDeleted: false
            };

            const amenities = await AmenityModel.listAmenities(amenityFilter);
            dbLogger.info({ count: amenities.length }, 'built-in amenities fetched successfully');
            return amenities;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch built-in amenities');
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
        dbLogger.info({ actor: actor.id, filter }, 'fetching custom amenities');

        try {
            const amenityFilter: SelectAmenityFilter = {
                ...filter,
                isBuiltin: false,
                includeDeleted: false
            };

            const amenities = await AmenityModel.listAmenities(amenityFilter);
            dbLogger.info({ count: amenities.length }, 'custom amenities fetched successfully');
            return amenities;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch custom amenities');
            throw error;
        }
    }
}
