import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import { FeatureModel, type FeatureRecord } from '../model/feature.model.js';
import type { InsertFeature, SelectFeatureFilter, UpdateFeatureData } from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

const log = logger.createLogger('FeatureService');

/**
 * Service layer for managing feature operations.
 * Handles business logic, authorization, and interacts with the FeatureModel.
 */
export class FeatureService {
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
        if (!FeatureService.isAdmin(actor)) {
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new feature.
     * @param data - The data for the new feature.
     * @param actor - The user creating the feature (must be an admin).
     * @returns The created feature record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertFeature, actor: UserType): Promise<FeatureRecord> {
        log.info('creating feature', 'create', { actor: actor.id });

        // Only admins can create features
        FeatureService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertFeature = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdFeature = await FeatureModel.createFeature(dataWithAudit);
            log.info('feature created successfully', 'create', { featureId: createdFeature.id });
            return createdFeature;
        } catch (error) {
            log.error('failed to create feature', 'create', error, { actor: actor.id });
            throw error;
        }
    }

    /**
     * Get a single feature by ID.
     * @param id - The ID of the feature to fetch.
     * @param actor - The user performing the action.
     * @returns The feature record.
     * @throws Error if feature is not found.
     */
    async getById(id: string, actor: UserType): Promise<FeatureRecord> {
        log.info('fetching feature by id', 'getById', { featureId: id, actor: actor.id });

        try {
            const feature = await FeatureModel.getFeatureById(id);
            const existingFeature = assertExists(feature, `Feature ${id} not found`);

            log.info('feature fetched successfully', 'getById', { featureId: existingFeature.id });
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
     * List features with optional filters, pagination, and search.
     * @param filter - Filtering and pagination options.
     * @param actor - The user performing the action.
     * @returns Array of feature records.
     * @throws Error if listing fails.
     */
    async list(filter: SelectFeatureFilter, actor: UserType): Promise<FeatureRecord[]> {
        log.info('listing features', 'list', { filter, actor: actor.id });

        try {
            const features = await FeatureModel.listFeatures(filter);
            log.info('features listed successfully', 'list', {
                count: features.length,
                filter
            });
            return features;
        } catch (error) {
            log.error('failed to list features', 'list', error, { filter, actor: actor.id });
            throw error;
        }
    }

    /**
     * Update fields on an existing feature.
     * @param id - The ID of the feature to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated feature record.
     * @throws Error if feature is not found, actor is not authorized, or update fails.
     */
    async update(id: string, changes: UpdateFeatureData, actor: UserType): Promise<FeatureRecord> {
        log.info('updating feature', 'update', { featureId: id, actor: actor.id });

        // Only admins can update features
        FeatureService.assertAdmin(actor);

        const existingFeature = await this.getById(id, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            // Include the updatedById in the update data
            const updateData: UpdateFeatureData = {
                ...dataToUpdate,
                updatedById: actor.id
            };

            // Use the model to update
            const updatedFeature = await FeatureModel.updateFeature(existingFeature.id, updateData);

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
     * Soft-delete a feature by setting the deletedAt timestamp.
     * @param id - The ID of the feature to delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if feature is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        log.info('soft deleting feature', 'delete', { featureId: id, actor: actor.id });

        // Only admins can delete features
        FeatureService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            // Use the model to update deletedAt and deletedById
            const updateData: UpdateFeatureData = {
                deletedAt: new Date(),
                deletedById: actor.id
            };

            await FeatureModel.updateFeature(id, updateData);

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
     * Restore a soft-deleted feature by clearing the deletedAt timestamp.
     * @param id - The ID of the feature to restore.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if feature is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        log.info('restoring feature', 'restore', { featureId: id, actor: actor.id });

        // Only admins can restore features
        FeatureService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            // Use the model to clear deletedAt and deletedById
            const updateData: UpdateFeatureData = {
                deletedAt: null,
                deletedById: null
            };

            await FeatureModel.updateFeature(id, updateData);

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
     * Permanently delete a feature record from the database.
     * @param id - The ID of the feature to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if feature is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        log.info('hard deleting feature', 'hardDelete', { featureId: id, actor: actor.id });

        // Only admins can hard delete
        FeatureService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await FeatureModel.hardDeleteFeature(id);
            log.info('feature hard deleted successfully', 'hardDelete', { featureId: id });
        } catch (error) {
            log.error('failed to hard delete feature', 'hardDelete', error, {
                featureId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get built-in features.
     * @param actor - The user performing the action.
     * @param filter - Additional filter and pagination options.
     * @returns Array of built-in feature records.
     * @throws Error if listing fails.
     */
    async getBuiltIn(
        actor: UserType,
        filter: Omit<SelectFeatureFilter, 'isBuiltin'> = {}
    ): Promise<FeatureRecord[]> {
        log.info('fetching built-in features', 'getBuiltIn', {
            actor: actor.id,
            filter
        });

        try {
            const featureFilter: SelectFeatureFilter = {
                ...filter,
                isBuiltin: true,
                includeDeleted: false
            };

            const features = await FeatureModel.listFeatures(featureFilter);
            log.info('built-in features fetched successfully', 'getBuiltIn', {
                count: features.length
            });
            return features;
        } catch (error) {
            log.error('failed to fetch built-in features', 'getBuiltIn', error, {
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Get custom (non-built-in) features.
     * @param actor - The user performing the action.
     * @param filter - Additional filter and pagination options.
     * @returns Array of custom feature records.
     * @throws Error if listing fails.
     */
    async getCustom(
        actor: UserType,
        filter: Omit<SelectFeatureFilter, 'isBuiltin'> = {}
    ): Promise<FeatureRecord[]> {
        log.info('fetching custom features', 'getCustom', {
            actor: actor.id,
            filter
        });

        try {
            const featureFilter: SelectFeatureFilter = {
                ...filter,
                isBuiltin: false,
                includeDeleted: false
            };

            const features = await FeatureModel.listFeatures(featureFilter);
            log.info('custom features fetched successfully', 'getCustom', {
                count: features.length
            });
            return features;
        } catch (error) {
            log.error('failed to fetch custom features', 'getCustom', error, {
                actor: actor.id
            });
            throw error;
        }
    }
}
