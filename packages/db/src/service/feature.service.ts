import { dbLogger } from '@repo/db/utils/logger.js';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import { FeatureModel, type FeatureRecord } from '../model/feature.model.js';
import type { InsertFeature, SelectFeatureFilter, UpdateFeatureData } from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

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
            dbLogger.warn({ actorId: actor.id }, 'Admin access required');
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
        dbLogger.info({ actor: actor.id }, 'creating feature');

        // Only admins can create features
        FeatureService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertFeature = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdFeature = await FeatureModel.createFeature(dataWithAudit);
            dbLogger.info({ featureId: createdFeature.id }, 'feature created successfully');
            return createdFeature;
        } catch (error) {
            dbLogger.error(error, 'failed to create feature');
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
        dbLogger.info({ featureId: id, actor: actor.id }, 'fetching feature by id');

        try {
            const feature = await FeatureModel.getFeatureById(id);
            const existingFeature = assertExists(feature, `Feature ${id} not found`);

            dbLogger.info({ featureId: existingFeature.id }, 'feature fetched successfully');
            return existingFeature;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch feature by id');
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
        dbLogger.info({ filter, actor: actor.id }, 'listing features');

        try {
            const features = await FeatureModel.listFeatures(filter);
            dbLogger.info({ count: features.length, filter }, 'features listed successfully');
            return features;
        } catch (error) {
            dbLogger.error(error, 'failed to list features');
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
        dbLogger.info({ featureId: id, actor: actor.id }, 'updating feature');

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

            dbLogger.info({ featureId: updatedFeature.id }, 'feature updated successfully');
            return updatedFeature;
        } catch (error) {
            dbLogger.error(error, 'failed to update feature');
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
        dbLogger.info({ featureId: id, actor: actor.id }, 'soft deleting feature');

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

            dbLogger.info({ featureId: id }, 'feature soft deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete feature');
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
        dbLogger.info({ featureId: id, actor: actor.id }, 'restoring feature');

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

            dbLogger.info({ featureId: id }, 'feature restored successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to restore feature');
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
        dbLogger.info({ featureId: id, actor: actor.id }, 'hard deleting feature');

        // Only admins can hard delete
        FeatureService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await FeatureModel.hardDeleteFeature(id);
            dbLogger.info({ featureId: id }, 'feature hard deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete feature');
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
        dbLogger.info({ actor: actor.id, filter }, 'fetching built-in features');

        try {
            const featureFilter: SelectFeatureFilter = {
                ...filter,
                isBuiltin: true,
                includeDeleted: false
            };

            const features = await FeatureModel.listFeatures(featureFilter);
            dbLogger.info({ count: features.length }, 'built-in features fetched successfully');
            return features;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch built-in features');
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
        dbLogger.info({ actor: actor.id, filter }, 'fetching custom features');

        try {
            const featureFilter: SelectFeatureFilter = {
                ...filter,
                isBuiltin: false,
                includeDeleted: false
            };

            const features = await FeatureModel.listFeatures(featureFilter);
            dbLogger.info({ count: features.length }, 'custom features fetched successfully');
            return features;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch custom features');
            throw error;
        }
    }
}
