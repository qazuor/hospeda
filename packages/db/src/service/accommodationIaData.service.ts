import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    AccommodationIaDataModel,
    type AccommodationIaDataRecord,
    AccommodationModel,
    type SelectAccommodationIaDataFilter
} from '../model/index.js';
import type {
    InsertAccommodationIaData,
    PaginationParams,
    UpdateAccommodationIaData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

const log = logger.createLogger('AccommodationIaDataService');

/**
 * Service layer for managing accommodation IA data operations.
 * Handles business logic, authorization, and interacts with the AccommodationIaDataModel.
 */
export class AccommodationIaDataService {
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
        if (actor.id !== ownerId && !AccommodationIaDataService.isAdmin(actor)) {
            log.warn('Forbidden access attempt', 'assertOwnerOrAdmin', {
                actorId: actor.id,
                requiredOwnerId: ownerId
            });
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new IA data entry.
     * @param data - The data for the new IA data entry.
     * @param actor - The user creating the IA data entry.
     * @returns The created IA data record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(
        data: InsertAccommodationIaData,
        actor: UserType
    ): Promise<AccommodationIaDataRecord> {
        log.info('creating accommodation IA data', 'create', { actor: actor.id });

        try {
            // Verify accommodation exists
            const accommodation = await AccommodationModel.getAccommodationById(
                data.accommodationId
            );
            if (!accommodation) {
                throw new Error(`Accommodation ${data.accommodationId} not found`);
            }

            // Check if actor is owner or admin
            AccommodationIaDataService.assertOwnerOrAdmin(accommodation.ownerId, actor);

            const dataWithAudit: InsertAccommodationIaData = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdIaData = await AccommodationIaDataModel.createIaData(dataWithAudit);
            log.info('accommodation IA data created successfully', 'create', {
                iaDataId: createdIaData.id
            });
            return createdIaData;
        } catch (error) {
            log.error('failed to create accommodation IA data', 'create', error, {
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get a single IA data entry by ID.
     * @param id - The ID of the IA data entry to fetch.
     * @param actor - The user performing the action.
     * @returns The IA data record.
     * @throws Error if IA data entry is not found or actor is not authorized.
     */
    async getById(id: string, actor: UserType): Promise<AccommodationIaDataRecord> {
        log.info('fetching IA data by id', 'getById', { iaDataId: id, actor: actor.id });

        try {
            const iaData = await AccommodationIaDataModel.getIaDataById(id);
            const existingIaData = assertExists(iaData, `IA data ${id} not found`);

            // Get the accommodation to check ownership
            const accommodation = await AccommodationModel.getAccommodationById(
                existingIaData.accommodationId
            );
            if (!accommodation) {
                throw new Error(`Accommodation ${existingIaData.accommodationId} not found`);
            }

            // Check if actor is owner or admin
            AccommodationIaDataService.assertOwnerOrAdmin(accommodation.ownerId, actor);

            log.info('IA data fetched successfully', 'getById', {
                iaDataId: existingIaData.id
            });
            return existingIaData;
        } catch (error) {
            log.error('failed to fetch IA data by id', 'getById', error, {
                iaDataId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List IA data entries for an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of IA data records.
     * @throws Error if accommodation is not found, actor is not authorized, or listing fails.
     */
    async list(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationIaDataRecord[]> {
        log.info('listing IA data for accommodation', 'list', {
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

            // Check if actor is owner or admin
            AccommodationIaDataService.assertOwnerOrAdmin(accommodation.ownerId, actor);

            const iaDataFilter: SelectAccommodationIaDataFilter = {
                accommodationId,
                ...filter,
                includeDeleted: false
            };

            const iaDataEntries = await AccommodationIaDataModel.listIaData(iaDataFilter);

            log.info('IA data listed successfully', 'list', {
                accommodationId,
                count: iaDataEntries.length
            });
            return iaDataEntries;
        } catch (error) {
            log.error('failed to list IA data', 'list', error, {
                accommodationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Update fields on an existing IA data entry.
     * @param id - The ID of the IA data entry to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action.
     * @returns The updated IA data record.
     * @throws Error if IA data entry is not found, actor is not authorized, or update fails.
     */
    async update(
        id: string,
        changes: UpdateAccommodationIaData,
        actor: UserType
    ): Promise<AccommodationIaDataRecord> {
        log.info('updating IA data', 'update', { iaDataId: id, actor: actor.id });

        const existingIaData = await this.getById(id, actor);

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(
            existingIaData.accommodationId
        );
        if (!accommodation) {
            throw new Error(`Accommodation ${existingIaData.accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationIaDataService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdateAccommodationIaData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedIaData = await AccommodationIaDataModel.updateIaData(
                existingIaData.id,
                dataWithAudit
            );
            log.info('IA data updated successfully', 'update', {
                iaDataId: updatedIaData.id
            });
            return updatedIaData;
        } catch (error) {
            log.error('failed to update IA data', 'update', error, {
                iaDataId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Soft-delete an IA data entry by setting the deletedAt timestamp.
     * @param id - The ID of the IA data entry to delete.
     * @param actor - The user performing the action.
     * @throws Error if IA data entry is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        log.info('soft deleting IA data', 'delete', { iaDataId: id, actor: actor.id });

        const existingIaData = await this.getById(id, actor);

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(
            existingIaData.accommodationId
        );
        if (!accommodation) {
            throw new Error(`Accommodation ${existingIaData.accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationIaDataService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationIaDataModel.softDeleteIaData(id);
            log.info('IA data soft deleted successfully', 'delete', { iaDataId: id });
        } catch (error) {
            log.error('failed to soft delete IA data', 'delete', error, {
                iaDataId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Restore a soft-deleted IA data entry by clearing the deletedAt timestamp.
     * @param id - The ID of the IA data entry to restore.
     * @param actor - The user performing the action.
     * @throws Error if IA data entry is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        log.info('restoring IA data', 'restore', { iaDataId: id, actor: actor.id });

        const existingIaData = await this.getById(id, actor);

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(
            existingIaData.accommodationId
        );
        if (!accommodation) {
            throw new Error(`Accommodation ${existingIaData.accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationIaDataService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationIaDataModel.restoreIaData(id);
            log.info('IA data restored successfully', 'restore', { iaDataId: id });
        } catch (error) {
            log.error('failed to restore IA data', 'restore', error, {
                iaDataId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Permanently delete an IA data entry record from the database.
     * @param id - The ID of the IA data entry to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if IA data entry is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        log.info('hard deleting IA data', 'hardDelete', { iaDataId: id, actor: actor.id });

        // Only admins can hard delete
        if (!AccommodationIaDataService.isAdmin(actor)) {
            throw new Error('Forbidden: Only admins can permanently delete IA data');
        }

        await this.getById(id, actor);

        try {
            await AccommodationIaDataModel.hardDeleteIaData(id);
            log.info('IA data hard deleted successfully', 'hardDelete', { iaDataId: id });
        } catch (error) {
            log.error('failed to hard delete IA data', 'hardDelete', error, {
                iaDataId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Search IA data entries by keyword.
     * @param accommodationId - The ID of the accommodation.
     * @param query - The keyword to search for.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of matching IA data records.
     * @throws Error if accommodation is not found, actor is not authorized, or search fails.
     */
    async search(
        accommodationId: string,
        query: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationIaDataRecord[]> {
        log.info('searching IA data by keyword', 'search', {
            accommodationId,
            query,
            actor: actor.id,
            filter
        });

        try {
            // Verify accommodation exists
            const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
            if (!accommodation) {
                throw new Error(`Accommodation ${accommodationId} not found`);
            }

            // Check if actor is owner or admin
            AccommodationIaDataService.assertOwnerOrAdmin(accommodation.ownerId, actor);

            const searchFilter: SelectAccommodationIaDataFilter = {
                accommodationId,
                query,
                ...filter,
                includeDeleted: false
            };

            const iaDataEntries = await AccommodationIaDataModel.listIaData(searchFilter);

            log.info('IA data search completed successfully', 'search', {
                accommodationId,
                query,
                count: iaDataEntries.length
            });
            return iaDataEntries;
        } catch (error) {
            log.error('failed to search IA data', 'search', error, {
                accommodationId,
                query,
                actor: actor.id
            });
            throw error;
        }
    }
}
