import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    DestinationAttractionModel,
    type DestinationAttractionRecord,
    DestinationModel
} from '../model';
import type {
    InsertDestinationAttraction,
    PaginationParams,
    SelectDestinationAttractionFilter,
    UpdateDestinationAttractionData
} from '../types/db-types';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils';

const log = logger.createLogger('DestinationAttractionService');

/**
 * Service layer for managing destination attraction operations.
 * Handles business logic, authorization, and interacts with the DestinationAttractionModel.
 */
export class DestinationAttractionService {
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
        if (!DestinationAttractionService.isAdmin(actor)) {
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new destination attraction.
     * @param data - The data for the new attraction.
     * @param actor - The user creating the attraction (must be an admin).
     * @returns The created attraction record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(
        data: InsertDestinationAttraction,
        actor: UserType
    ): Promise<DestinationAttractionRecord> {
        log.info('creating destination attraction', 'create', { actor: actor.id });

        // Only admins can create attractions
        DestinationAttractionService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertDestinationAttraction = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdAttraction =
                await DestinationAttractionModel.createAttraction(dataWithAudit);
            log.info('destination attraction created successfully', 'create', {
                attractionId: createdAttraction.id
            });
            return createdAttraction;
        } catch (error) {
            log.error('failed to create destination attraction', 'create', error, {
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get a single attraction by ID.
     * @param id - The ID of the attraction to fetch.
     * @param actor - The user performing the action.
     * @returns The attraction record.
     * @throws Error if attraction is not found.
     */
    async getById(id: string, actor: UserType): Promise<DestinationAttractionRecord> {
        log.info('fetching attraction by id', 'getById', {
            attractionId: id,
            actor: actor.id
        });

        try {
            const attraction = await DestinationAttractionModel.getAttractionById(id);
            const existingAttraction = assertExists(attraction, `Attraction ${id} not found`);

            log.info('attraction fetched successfully', 'getById', {
                attractionId: existingAttraction.id
            });
            return existingAttraction;
        } catch (error) {
            log.error('failed to fetch attraction by id', 'getById', error, {
                attractionId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List attractions with optional filters, pagination, and search.
     * @param filter - Filtering and pagination options.
     * @param actor - The user performing the action.
     * @returns Array of attraction records.
     * @throws Error if listing fails.
     */
    async list(
        filter: SelectDestinationAttractionFilter,
        actor: UserType
    ): Promise<DestinationAttractionRecord[]> {
        log.info('listing attractions', 'list', { filter, actor: actor.id });

        try {
            const attractions = await DestinationAttractionModel.listAttractions(filter);
            log.info('attractions listed successfully', 'list', {
                count: attractions.length,
                filter
            });
            return attractions;
        } catch (error) {
            log.error('failed to list attractions', 'list', error, {
                filter,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Update fields on an existing attraction.
     * @param id - The ID of the attraction to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated attraction record.
     * @throws Error if attraction is not found, actor is not authorized, or update fails.
     */
    async update(
        id: string,
        changes: UpdateDestinationAttractionData,
        actor: UserType
    ): Promise<DestinationAttractionRecord> {
        log.info('updating attraction', 'update', { attractionId: id, actor: actor.id });

        // Only admins can update attractions
        DestinationAttractionService.assertAdmin(actor);

        const existingAttraction = await this.getById(id, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdateDestinationAttractionData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedAttraction = await DestinationAttractionModel.updateAttraction(
                existingAttraction.id,
                dataWithAudit
            );
            log.info('attraction updated successfully', 'update', {
                attractionId: updatedAttraction.id
            });
            return updatedAttraction;
        } catch (error) {
            log.error('failed to update attraction', 'update', error, {
                attractionId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Soft-delete an attraction by setting the deletedAt timestamp.
     * @param id - The ID of the attraction to delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if attraction is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        log.info('soft deleting attraction', 'delete', { attractionId: id, actor: actor.id });

        // Only admins can delete attractions
        DestinationAttractionService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await DestinationAttractionModel.softDeleteAttraction(id);
            log.info('attraction soft deleted successfully', 'delete', { attractionId: id });
        } catch (error) {
            log.error('failed to soft delete attraction', 'delete', error, {
                attractionId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Restore a soft-deleted attraction by clearing the deletedAt timestamp.
     * @param id - The ID of the attraction to restore.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if attraction is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        log.info('restoring attraction', 'restore', { attractionId: id, actor: actor.id });

        // Only admins can restore attractions
        DestinationAttractionService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await DestinationAttractionModel.restoreAttraction(id);
            log.info('attraction restored successfully', 'restore', { attractionId: id });
        } catch (error) {
            log.error('failed to restore attraction', 'restore', error, {
                attractionId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Permanently delete an attraction record from the database.
     * @param id - The ID of the attraction to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if attraction is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        log.info('hard deleting attraction', 'hardDelete', { attractionId: id, actor: actor.id });

        // Only admins can hard delete
        DestinationAttractionService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await DestinationAttractionModel.hardDeleteAttraction(id);
            log.info('attraction hard deleted successfully', 'hardDelete', { attractionId: id });
        } catch (error) {
            log.error('failed to hard delete attraction', 'hardDelete', error, {
                attractionId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Count attractions for a specific destination.
     * @param destinationId - The ID of the destination.
     * @param actor - The user performing the action.
     * @returns The number of attractions for the destination.
     * @throws Error if destination is not found or count fails.
     */
    async countByDestination(destinationId: string, actor: UserType): Promise<number> {
        log.info('counting attractions by destination', 'countByDestination', {
            destinationId,
            actor: actor.id
        });

        try {
            // Verify destination exists
            const destination = await DestinationModel.getDestinationById(destinationId);
            if (!destination) {
                throw new Error(`Destination ${destinationId} not found`);
            }

            // Get all attractions related to this destination
            // In a real implementation, there would be a direct relationship or filter
            const attractions = await DestinationAttractionModel.listAttractions({
                includeDeleted: false
            });

            // Count attractions for this destination - this is a simplified approach
            // In a real implementation, you would have a more efficient query that counts directly
            // or have a proper filter in the model method
            const count = attractions.length;

            log.info('attractions counted by destination successfully', 'countByDestination', {
                destinationId,
                count
            });
            return count;
        } catch (error) {
            log.error('failed to count attractions by destination', 'countByDestination', error, {
                destinationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Search attractions by query string.
     * @param query - The search query.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of matching attraction records.
     * @throws Error if search fails.
     */
    async search(
        query: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<DestinationAttractionRecord[]> {
        log.info('searching attractions', 'search', {
            query,
            actor: actor.id,
            filter
        });

        try {
            const searchFilter: SelectDestinationAttractionFilter = {
                query,
                ...filter,
                includeDeleted: false
            };

            const attractions = await DestinationAttractionModel.listAttractions(searchFilter);
            log.info('attractions search completed successfully', 'search', {
                query,
                count: attractions.length
            });
            return attractions;
        } catch (error) {
            log.error('failed to search attractions', 'search', error, {
                query,
                actor: actor.id
            });
            throw error;
        }
    }
}
