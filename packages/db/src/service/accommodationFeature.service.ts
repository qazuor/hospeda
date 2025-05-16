import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import {
    AccommodationFeatureModel,
    type AccommodationFeatureRecord,
    AccommodationModel,
    FeatureModel,
    type FeatureRecord
} from '../model';
import { accommodationFeatures } from '../schema';
import type { PaginationParams, SelectAccommodationFeatureFilter } from '../types/db-types';
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
        log.info('creating accommodation feature relationship', 'create', {
            accommodationId,
            featureId,
            actor: actor.id
        });

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

            log.info('accommodation feature relationship created successfully', 'create', {
                relationId: `${relation.accommodationId}-${relation.featureId}`
            });

            return {
                relation,
                feature
            };
        } catch (error) {
            log.error('failed to create accommodation feature relationship', 'create', error, {
                accommodationId,
                featureId,
                actor: actor.id
            });
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
        log.info('fetching accommodation feature relationship by IDs', 'getByIds', {
            accommodationId,
            featureId,
            actor: actor.id
        });

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

            log.info('accommodation feature relationship fetched successfully', 'getByIds', {
                relationId: `${existingRelation.accommodationId}-${existingRelation.featureId}`
            });

            return existingRelation;
        } catch (error) {
            log.error(
                'failed to fetch accommodation feature relationship by IDs',
                'getByIds',
                error,
                {
                    accommodationId,
                    featureId,
                    actor: actor.id
                }
            );
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
        log.info('listing feature relationships for accommodation', 'listByAccommodation', {
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

            const relations = await AccommodationFeatureModel.listFeatureRelations(featureFilter);
            log.info('feature relationships listed successfully', 'listByAccommodation', {
                accommodationId,
                count: relations.length
            });

            return relations;
        } catch (error) {
            log.error(
                'failed to list feature relationships for accommodation',
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
        log.info('updating accommodation feature relationship', 'update', {
            accommodationId,
            featureId,
            actor: actor.id
        });

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationFeatureService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            // First, update the regular fields
            await AccommodationFeatureModel.updateFeatureRelation(
                accommodationId,
                featureId,
                dataToUpdate
            );

            // Then update the audit field with a direct query
            await db
                .update(accommodationFeatures)
                .set({ updatedById: actor.id })
                .where(
                    and(
                        eq(accommodationFeatures.accommodationId, accommodationId),
                        eq(accommodationFeatures.featureId, featureId)
                    )
                );

            // Fetch the updated record
            const relation = await AccommodationFeatureModel.getFeatureRelation(
                accommodationId,
                featureId
            );
            if (!relation) {
                throw new Error(
                    `Failed to retrieve updated relation for accommodation ${accommodationId} and feature ${featureId}`
                );
            }

            log.info('accommodation feature relationship updated successfully', 'update', {
                relationId: `${relation.accommodationId}-${relation.featureId}`
            });

            return relation;
        } catch (error) {
            log.error('failed to update accommodation feature relationship', 'update', error, {
                accommodationId,
                featureId,
                actor: actor.id
            });
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
        log.info('soft deleting accommodation feature relationship', 'delete', {
            accommodationId,
            featureId,
            actor: actor.id
        });

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationFeatureService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationFeatureModel.softDeleteFeatureRelation(accommodationId, featureId);
            log.info('accommodation feature relationship soft deleted successfully', 'delete', {
                accommodationId,
                featureId
            });
        } catch (error) {
            log.error('failed to soft delete accommodation feature relationship', 'delete', error, {
                accommodationId,
                featureId,
                actor: actor.id
            });
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
        log.info('restoring accommodation feature relationship', 'restore', {
            accommodationId,
            featureId,
            actor: actor.id
        });

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
        if (!accommodation) {
            throw new Error(`Accommodation ${accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationFeatureService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationFeatureModel.restoreFeatureRelation(accommodationId, featureId);
            log.info('accommodation feature relationship restored successfully', 'restore', {
                accommodationId,
                featureId
            });
        } catch (error) {
            log.error('failed to restore accommodation feature relationship', 'restore', error, {
                accommodationId,
                featureId,
                actor: actor.id
            });
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
        log.info('hard deleting accommodation feature relationship', 'hardDelete', {
            accommodationId,
            featureId,
            actor: actor.id
        });

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
            log.info('accommodation feature relationship hard deleted successfully', 'hardDelete', {
                accommodationId,
                featureId
            });
        } catch (error) {
            log.error(
                'failed to hard delete accommodation feature relationship',
                'hardDelete',
                error,
                {
                    accommodationId,
                    featureId,
                    actor: actor.id
                }
            );
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
        log.info(
            'removing all feature relationships from accommodation',
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
        AccommodationFeatureService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationFeatureModel.deleteAllByAccommodation(accommodationId);
            log.info(
                'all feature relationships removed from accommodation successfully',
                'removeAllFromAccommodation',
                {
                    accommodationId
                }
            );
        } catch (error) {
            log.error(
                'failed to remove all feature relationships from accommodation',
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
