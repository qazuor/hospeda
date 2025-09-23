import { ServiceErrorCode } from '@repo/schemas';
import type { ServiceContext } from '@repo/service-core';
import { errorHistory } from './errorHistory.js';
import { STATUS_ICONS } from './icons.js';
import { logger } from './logger.js';
import type { SeedContext } from './seedContext.js';
import { summaryTracker } from './summaryTracker.js';

// Service constructor type - compatible with service constructors
// biome-ignore lint/suspicious/noExplicitAny: Service constructors have varying signatures
type ServiceConstructor<T = unknown> = new (ctx: ServiceContext, ...args: any[]) => T;

/**
 * Configuration for creating a service-based relation builder
 */
export interface ServiceRelationBuilderConfig<TEntity> {
    /** Service class to use for creating relations */
    serviceClass: ServiceConstructor;
    /** Method name to call on the service */
    methodName: string;
    /** Function to extract relation IDs from the entity */
    extractIds: (entity: TEntity) => string[];
    /** Entity type for mapping (e.g., 'attractions', 'amenities') */
    entityType: string;
    /** Relation type for logging (e.g., 'attractions', 'amenities') */
    relationType: string;
    /** Function to build parameters for the service method call */
    buildParams: (entityId: string, relationId: string) => Record<string, string>;
    /** Optional function to get display info for the main entity */
    getMainEntityInfo?: (entity: TEntity) => string;
    /** Optional function to get display info for related entities */
    getRelatedEntityInfo?: (seedId: string, context: SeedContext) => string;
    /** Optional custom error handler */
    errorHandler?: (error: unknown, entityId: string, relationId: string) => void;
}

/**
 * Creates a generic relation builder that uses services to create relationships.
 *
 * This factory function creates a relation builder that:
 * - Uses service classes instead of direct model access
 * - Provides progress tracking with counters
 * - Supports custom entity information display
 * - Handles errors gracefully with configurable behavior
 * - Tracks success/error statistics
 *
 * @param config - Configuration for the relation builder
 * @returns A relation builder function that can be used in seed factories
 *
 * @example
 * ```typescript
 * const attractionsBuilder = createServiceRelationBuilder({
 *   serviceClass: AttractionService,
 *   methodName: 'addAttractionToDestination',
 *   extractIds: (destination) => destination.attractionIds || [],
 *   entityType: 'attractions',
 *   relationType: 'attractions',
 *   buildParams: (destinationId, attractionId) => ({
 *     destinationId,
 *     attractionId
 *   }),
 *   getMainEntityInfo: (destination) => `"${destination.name}"`,
 *   getRelatedEntityInfo: (seedId, context) =>
 *     context.idMapper.getDisplayName('attractions', seedId)
 * });
 * ```
 */
export const createServiceRelationBuilder = <TEntity>(
    config: ServiceRelationBuilderConfig<TEntity>
) => {
    return async (result: unknown, item: TEntity, context: SeedContext) => {
        const entityId = (result as { data?: { id?: string } })?.data?.id;
        if (!entityId) {
            logger.warn(`No entity ID found in result for ${config.relationType} relation`);
            return;
        }

        const seedRelationIds = config.extractIds(item);
        if (seedRelationIds.length === 0) {
            logger.info(`No ${config.relationType} to relate for entity ${entityId}`);
            return;
        }

        // Get main entity display info
        const mainEntityInfo = config.getMainEntityInfo ? config.getMainEntityInfo(item) : entityId;

        // Create service instance
        const service = new config.serviceClass({});
        const actor = context.actor;
        if (!actor) {
            throw new Error('Actor not available in context');
        }

        logger.info(
            `Creating ${seedRelationIds.length} ${config.relationType} relations for ${mainEntityInfo}`
        );

        let createdCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // Create relationships for each relation ID
        for (const seedId of seedRelationIds) {
            const realId = context.idMapper.getRealId(config.entityType, seedId);
            if (!realId) {
                logger.warn(
                    `${STATUS_ICONS.Warning} No mapping found for ${config.relationType} ${seedId}`
                );
                continue;
            }

            // Get related entity display info
            const relatedEntityInfo = config.getRelatedEntityInfo
                ? config.getRelatedEntityInfo(seedId, context)
                : context.idMapper.getDisplayName(config.entityType, seedId);

            try {
                // Call the service method dynamically
                const method = (service as Record<string, unknown>)[config.methodName];
                if (typeof method !== 'function') {
                    throw new Error(`Method ${config.methodName} not found on service`);
                }

                const params = config.buildParams(entityId, realId);
                await method.call(service, actor, params);

                createdCount++;
                logger.success({
                    msg: `[${createdCount + skippedCount} of ${seedRelationIds.length}] - Created ${config.relationType} relation: ${mainEntityInfo} → ${relatedEntityInfo}`
                });

                // Track success in summary
                summaryTracker.trackSuccess(`${config.relationType} Relations`);
            } catch (error: unknown) {
                const err = error as { code?: string; message?: string };

                // Handle specific error cases
                if (err.code === ServiceErrorCode.ALREADY_EXISTS) {
                    // Relationship already exists, this is fine
                    skippedCount++;
                    logger.info(
                        `[${createdCount + skippedCount} of ${seedRelationIds.length}] - ${config.relationType} relation ${mainEntityInfo} → ${relatedEntityInfo} already exists, skipping`
                    );
                    continue;
                }

                const errorMessage = `${STATUS_ICONS.Error} Failed to create ${config.relationType} relation: ${err.message}`;

                // Track error in summary
                summaryTracker.trackError(
                    `${config.relationType} Relations`,
                    `${mainEntityInfo}-${relatedEntityInfo}`,
                    err.message || 'Unknown error'
                );

                // Track error in error history
                errorHistory.recordError(
                    `${config.relationType} Relations`,
                    `${mainEntityInfo}-${relatedEntityInfo}`,
                    `Failed to create ${config.relationType} relation: ${err.message}`,
                    error
                );

                errorCount++;

                // Use custom error handler if provided
                if (config.errorHandler) {
                    config.errorHandler(error, entityId, realId);
                } else {
                    // Default error handling
                    if (context.continueOnError) {
                        logger.warn(`${STATUS_ICONS.Warning} ${errorMessage}`);
                    } else {
                        throw new Error(errorMessage);
                    }
                }
            }
        }

        // Log summary for this entity
        if (createdCount > 0 || skippedCount > 0 || errorCount > 0) {
            logger.info(
                `${config.relationType} relations for ${mainEntityInfo}: ${createdCount} created, ${skippedCount} skipped, ${errorCount} errors`
            );
        }
    };
};
