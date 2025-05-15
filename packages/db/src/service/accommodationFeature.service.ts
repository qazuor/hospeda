import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    AccommodationFeatureModel,
    type AccommodationFeatureRecord,
    AccommodationModel,
    type SelectAccommodationFeatureFilter
} from '../model';
import type {
    InsertAccommodationFeature,
    PaginationParams,
    UpdateAccommodationFeatureData
} from '../types/db-types';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils';

const log = logger.createLogger('AccommodationFeatureService');

/**
 * Service layer for managing accommodation feature operations.
 * Handles business logic, authorization, and interacts with the AccommodationFeatureModel.
 */
export class AccommodationFeatureService {
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
        if (actor.id !== ownerId && !AccommodationFeatureService.isAdmin(actor)) {
            log.warn('Forbidden access attempt', 'assertOwnerOrAdmin', {
                actorId: actor.id,
                requiredOwnerId: ownerId
            });
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new feature entry.
     * @param data - The data for the new feature entry.
     * @param actor - The user creating the feature entry.
     * @returns The created feature record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(
        data: InsertAccommodationFeature,
        actor: UserType
    ): Promise<AccommodationFeatureRecord> {
        log.info('creating accommodation feature', 'create', { actor: actor.id });

        try {
            // Verify accommodation exists
            const accommodation = await AccommodationModel.getAccommodationById(
                data.accommodationId
            );
            if (!accommodation) {
                throw new Error(`Accommodation ${data.accommodationId} not found`);
            }

            // Check if actor is owner or admin
            AccommodationFeatureService.assertOwnerOrAdmin(accommodation.ownerId, actor);

            const dataWithAudit: InsertAccommodationFeature = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdFeature = await AccommodationFeatureModel.createFeature(dataWithAudit);
            log.info('accommodation feature created successfully', 'create', {
                featureId: createdFeature.id
            });
            return createdFeature;
        } catch (error) {
            log.error('failed to create accommodation feature', 'create', error, {
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get a single feature entry by ID.
     * @param id - The ID of the feature entry to fetch.
     * @param actor - The user performing the action.
     * @returns The feature record.
     * @throws Error if feature entry is not found or actor is not authorized.
     */
    async getById(id: string, actor: UserType): Promise<AccommodationFeatureRecord> {
        log.info('fetching feature by id', 'getById', { featureId: id, actor: actor.id });

        try {
            const feature = await AccommodationFeatureModel.getFeatureById(id);
            const existingFeature = assertExists(feature, `Feature ${id} not found`);

            // Get the accommodation to check ownership
            const accommodation = await AccommodationModel.getAccommodationById(
                existingFeature.accommodationId
            );
            if (!accommodation) {
                throw new Error(`Accommodation ${existingFeature.accommodationId} not found`);
            }

            // Check if actor is owner or admin
            AccommodationFeatureService.assertOwnerOrAdmin(accommodation.ownerId, actor);

            log.info('feature fetched successfully', 'getById', {
                featureId: existingFeature.id
            });
            return existingFeature;
        } catch (error) {
            log.error('failed to fetch feature by id', 'getById', error, {
                featureId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List feature entries for an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of feature records.
     * @throws Error if accommodation is not found, actor is not authorized, or listing fails.
     */
    async list(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationFeatureRecord[]> {
        log.info('listing features for accommodation', 'list', {
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

            const featureFilter: SelectAccommodationFeatureFilter = {
                accommodationId,
                ...filter,
                includeDeleted: false
            };

            const features = await AccommodationFeatureModel.listFeatures(featureFilter);
            log.info('features listed successfully', 'list', {
                accommodationId,
                count: features.length
            });
            return features;
        } catch (error) {
            log.error('failed to list features', 'list', error, {
                accommodationId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Update fields on an existing feature entry.
     * @param id - The ID of the feature entry to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action.
     * @returns The updated feature record.
     * @throws Error if feature entry is not found, actor is not authorized, or update fails.
     */
    async update(
        id: string,
        changes: UpdateAccommodationFeatureData,
        actor: UserType
    ): Promise<AccommodationFeatureRecord> {
        log.info('updating feature', 'update', { featureId: id, actor: actor.id });

        const existingFeature = await this.getById(id, actor);

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(
            existingFeature.accommodationId
        );
        if (!accommodation) {
            throw new Error(`Accommodation ${existingFeature.accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationFeatureService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdateAccommodationFeatureData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedFeature = await AccommodationFeatureModel.updateFeature(
                existingFeature.id,
                dataWithAudit
            );
            log.info('feature updated successfully', 'update', {
                featureId: updatedFeature.id
            });
            return updatedFeature;
        } catch (error) {
            log.error('failed to update feature', 'update', error, {
                featureId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Soft-delete a feature entry by setting the deletedAt timestamp.
     * @param id - The ID of the feature entry to delete.
     * @param actor - The user performing the action.
     * @throws Error if feature entry is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        log.info('soft deleting feature', 'delete', { featureId: id, actor: actor.id });

        const existingFeature = await this.getById(id, actor);

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(
            existingFeature.accommodationId
        );
        if (!accommodation) {
            throw new Error(`Accommodation ${existingFeature.accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationFeatureService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationFeatureModel.softDeleteFeature(id);
            log.info('feature soft deleted successfully', 'delete', { featureId: id });
        } catch (error) {
            log.error('failed to soft delete feature', 'delete', error, {
                featureId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Restore a soft-deleted feature entry by clearing the deletedAt timestamp.
     * @param id - The ID of the feature entry to restore.
     * @param actor - The user performing the action.
     * @throws Error if feature entry is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        log.info('restoring feature', 'restore', { featureId: id, actor: actor.id });

        const existingFeature = await this.getById(id, actor);

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(
            existingFeature.accommodationId
        );
        if (!accommodation) {
            throw new Error(`Accommodation ${existingFeature.accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationFeatureService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationFeatureModel.restoreFeature(id);
            log.info('feature restored successfully', 'restore', { featureId: id });
        } catch (error) {
            log.error('failed to restore feature', 'restore', error, {
                featureId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Permanently delete a feature entry record from the database.
     * @param id - The ID of the feature entry to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if feature entry is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        log.info('hard deleting feature', 'hardDelete', { featureId: id, actor: actor.id });

        // Only admins can hard delete
        if (!AccommodationFeatureService.isAdmin(actor)) {
            throw new Error('Forbidden: Only admins can permanently delete features');
        }

        await this.getById(id, actor);

        try {
            await AccommodationFeatureModel.hardDeleteFeature(id);
            log.info('feature hard deleted successfully', 'hardDelete', { featureId: id });
        } catch (error) {
            log.error('failed to hard delete feature', 'hardDelete', error, {
                featureId: id,
                actor: actor.id
            });
            throw error;
        }
    }
}
