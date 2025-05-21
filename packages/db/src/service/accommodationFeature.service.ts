import { dbLogger } from '@repo/db/utils/logger.js';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    AccommodationFeatureModel,
    type AccommodationFeatureRecord,
    AccommodationModel,
    FeatureModel,
    type FeatureRecord
} from '../model/index.js';
import type { PaginationParams, SelectAccommodationFeatureFilter } from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

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
     * Create a new accommodation-feature relationship.
     * @param accommodationId - The ID of the accommodation.
     * @param featureId - The ID of the feature.
     * @param hostReWriteName - Optional custom name for the feature.
     * @param comments - Optional comments about the feature.
     * @param actor - The user creating the relationship.
     * @returns The created relationship record and the feature.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(
        accommodationId: string,
        featureId: string,
        hostReWriteName: string | null,
        comments: string | null,
        actor: UserType
    ): Promise<{ relation: AccommodationFeatureRecord; feature: FeatureRecord }> {
        dbLogger.info(
            {
                accommodationId,
                featureId,
                actor: actor.id
            },
            'creating accommodation feature relationship'
        );

        try {
            // Verify accommodation exists
            const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
            if (!accommodation) {
                throw new Error(`Accommodation ${accommodationId} not found`);
            }

            // Verify feature exists
            const feature = await FeatureModel.getFeatureById(featureId);
            if (!feature) {
                throw new Error(`Feature ${featureId} not found`);
            }

            // Check if actor is owner or admin
            AccommodationFeatureService.assertOwnerOrAdmin(accommodation.ownerId, actor);

            const relationData = {
                accommodationId,
                featureId,
                hostReWriteName,
                comments,
                createdById: actor.id,
                updatedById: actor.id
            };

            const relation = await AccommodationFeatureModel.createFeatureRelation(relationData);

            dbLogger.info(
                {
                    relationId: `${relation.accommodationId}-${relation.featureId}`
                },
                'accommodation feature relationship created successfully'
            );

            return {
                relation,
                feature
            };
        } catch (error) {
            dbLogger.error(error, 'failed to create accommodation feature relationship');
            throw error;
        }
    }

    /**
     * Get a single accommodation-feature relationship by IDs.
     * @param accommodationId - The accommodation ID.
     * @param featureId - The feature ID.
     * @param actor - The user performing the action.
     * @returns The relationship record.
     * @throws Error if relationship is not found or actor is not authorized.
     */
    async getByIds(
        accommodationId: string,
        featureId: string,
        actor: UserType
    ): Promise<AccommodationFeatureRecord> {
        dbLogger.info(
            {
                accommodationId,
                featureId,
                actor: actor.id
            },
            'fetching accommodation feature relationship by IDs'
        );

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationFeatureService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            const relation = await AccommodationFeatureModel.getFeatureRelation(
                accommodationId,
                featureId
            );
            const existingRelation = assertExists(
                relation,
                `Relationship between accommodation ${accommodationId} and feature ${featureId} not found`
            );

            dbLogger.info(
                {
                    relationId: `${existingRelation.accommodationId}-${existingRelation.featureId}`
                },
                'accommodation feature relationship fetched successfully'
            );

            return existingRelation;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch accommodation feature relationship by IDs');
            throw error;
        }
    }

    /**
     * List accommodation-feature relationships for a specific accommodation.
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
    ): Promise<AccommodationFeatureRecord[]> {
        dbLogger.info(
            {
                accommodationId,
                actor: actor.id,
                filter
            },
            'listing feature relationships for accommodation'
        );

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

            const relations = await AccommodationFeatureModel.listFeatureRelations(featureFilter);
            dbLogger.info(
                {
                    accommodationId,
                    count: relations.length
                },
                'feature relationships listed successfully'
            );

            return relations;
        } catch (error) {
            dbLogger.error(error, 'failed to list feature relationships for accommodation');
            throw error;
        }
    }

    /**
     * Update fields on an existing accommodation-feature relationship.
     * @param accommodationId - The accommodation ID.
     * @param featureId - The feature ID.
     * @param changes - The changes to apply.
     * @param actor - The user performing the action.
     * @returns The updated relationship record.
     * @throws Error if relationship is not found, actor is not authorized, or update fails.
     */
    async update(
        accommodationId: string,
        featureId: string,
        changes: Partial<AccommodationFeatureRecord>,
        actor: UserType
    ): Promise<AccommodationFeatureRecord> {
        dbLogger.info(
            {
                accommodationId,
                featureId,
                actor: actor.id
            },
            'updating accommodation feature relationship'
        );

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationFeatureService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            // Add the updatedById to the update data
            const updateData = {
                ...dataToUpdate,
                updatedById: actor.id
            };

            // Use the model to update
            const updatedRelation = await AccommodationFeatureModel.updateFeatureRelation(
                accommodationId,
                featureId,
                updateData
            );

            dbLogger.info(
                {
                    relationId: `${updatedRelation.accommodationId}-${updatedRelation.featureId}`
                },
                'accommodation feature relationship updated successfully'
            );

            return updatedRelation;
        } catch (error) {
            dbLogger.error(error, 'failed to update accommodation feature relationship');
            throw error;
        }
    }

    /**
     * Soft-delete an accommodation-feature relationship.
     * @param accommodationId - The accommodation ID.
     * @param featureId - The feature ID.
     * @param actor - The user performing the action.
     * @throws Error if relationship is not found, actor is not authorized, or deletion fails.
     */
    async delete(accommodationId: string, featureId: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                accommodationId,
                featureId,
                actor: actor.id
            },
            'soft deleting accommodation feature relationship'
        );

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationFeatureService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationFeatureModel.softDeleteFeatureRelation(accommodationId, featureId);
            dbLogger.info(
                {
                    accommodationId,
                    featureId
                },
                'accommodation feature relationship soft deleted successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete accommodation feature relationship');
            throw error;
        }
    }

    /**
     * Restore a soft-deleted accommodation-feature relationship.
     * @param accommodationId - The accommodation ID.
     * @param featureId - The feature ID.
     * @param actor - The user performing the action.
     * @throws Error if relationship is not found, actor is not authorized, or restoration fails.
     */
    async restore(accommodationId: string, featureId: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                accommodationId,
                featureId,
                actor: actor.id
            },
            'restoring accommodation feature relationship'
        );

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationFeatureService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationFeatureModel.restoreFeatureRelation(accommodationId, featureId);
            dbLogger.info(
                {
                    accommodationId,
                    featureId
                },
                'accommodation feature relationship restored successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to restore accommodation feature relationship');
            throw error;
        }
    }

    /**
     * Hard-delete an accommodation-feature relationship.
     * @param accommodationId - The accommodation ID.
     * @param featureId - The feature ID.
     * @param actor - The user performing the action.
     * @throws Error if relationship is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(accommodationId: string, featureId: string, actor: UserType): Promise<void> {
        dbLogger.info(
            {
                accommodationId,
                featureId,
                actor: actor.id
            },
            'hard deleting accommodation feature relationship'
        );

        // Only admins can hard delete
        if (!AccommodationFeatureService.isAdmin(actor)) {
            throw new Error('Forbidden: Only admins can permanently delete relationships');
        }

        // Get the accommodation to check existence
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        try {
            await AccommodationFeatureModel.hardDeleteFeatureRelation(accommodationId, featureId);
            dbLogger.info(
                {
                    accommodationId,
                    featureId
                },
                'accommodation feature relationship hard deleted successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete accommodation feature relationship');
            throw error;
        }
    }

    /**
     * Remove all feature relationships for a specific accommodation.
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
            'removing all feature relationships from accommodation'
        );

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationFeatureService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationFeatureModel.deleteAllByAccommodation(accommodationId);
            dbLogger.info(
                {
                    accommodationId
                },
                'all feature relationships removed from accommodation successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to remove all feature relationships from accommodation');
            throw error;
        }
    }
}
