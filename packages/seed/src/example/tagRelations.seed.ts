import path from 'node:path';
import { TagService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import requiredManifest from '../manifest-required.json';
import { errorHistory } from '../utils/errorHistory.js';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Entity type mapping for tag relations
 */
const ENTITY_TYPE_MAP: Record<string, string> = {
    posts: 'POST',
    events: 'EVENT',
    accommodations: 'ACCOMMODATION',
    destinations: 'DESTINATION',
    users: 'USER'
};

/**
 * Map plural entity types to singular directory names
 */
const ENTITY_DIRECTORY_MAP: Record<string, string> = {
    posts: 'post',
    events: 'event',
    accommodations: 'accommodation',
    destinations: 'destination',
    users: 'user'
};

/**
 * Interface for entity data with tagIds
 */
interface EntityWithTags {
    id: string;
    tagIds?: string[];
    name?: string;
    title?: string;
    [key: string]: unknown;
}

/**
 * Processes tag relations for a specific entity type
 */
async function processTagRelations(
    entityType: string,
    entityFiles: string[],
    context: SeedContext
): Promise<void> {
    const dbEntityType = ENTITY_TYPE_MAP[entityType];
    if (!dbEntityType) {
        logger.warn(`${STATUS_ICONS.Warning} Unknown entity type: ${entityType}`);
        return;
    }

    logger.info(`📎 Processing tag relations for ${entityType} (${entityFiles.length} files)`);

    const tagService = new TagService({ logger: undefined }); // Simplified logger for service context
    let errorCount = 0;
    let totalRelations = 0;
    let successfulRelations = 0;

    // First pass: count total relations
    for (const fileName of entityFiles) {
        try {
            const directoryName = ENTITY_DIRECTORY_MAP[entityType];
            const filePath = path.resolve(`src/data/${directoryName}/${fileName}`);
            const entityData = await import(filePath, { assert: { type: 'json' } });
            const entity = entityData.default as EntityWithTags;

            if (entity.tagIds && entity.tagIds.length > 0) {
                totalRelations += entity.tagIds.length;
            }
        } catch (_error) {
            // Ignore errors in counting phase
        }
    }

    // Second pass: process relations
    for (const fileName of entityFiles) {
        try {
            const directoryName = ENTITY_DIRECTORY_MAP[entityType];
            const filePath = path.resolve(`src/data/${directoryName}/${fileName}`);
            const entityData = await import(filePath, { assert: { type: 'json' } });
            const entity = entityData.default as EntityWithTags;

            if (!entity.tagIds || entity.tagIds.length === 0) {
                continue;
            }

            const realEntityId = context.idMapper.getRealId(entityType, entity.id);
            if (!realEntityId) {
                logger.warn(
                    `${STATUS_ICONS.Warning} No mapping found for ${entityType} ID: ${entity.id}`
                );
                continue;
            }

            // Process each tag relation
            for (const seedTagId of entity.tagIds) {
                const realTagId = context.idMapper.getRealId('tags', seedTagId);
                if (!realTagId) {
                    logger.warn(
                        `${STATUS_ICONS.Warning} No mapping found for tag ID: ${seedTagId}`
                    );
                    continue;
                }

                try {
                    if (!context.actor) {
                        throw new Error('No actor available for tag relation creation');
                    }

                    await tagService.addTagToEntity(context.actor, {
                        tagId: realTagId,
                        entityId: realEntityId,
                        entityType: dbEntityType
                    });

                    const entityName = entity.name || entity.title || entity.id;
                    const tagName = context.idMapper.getDisplayName('tags', seedTagId);
                    successfulRelations++;
                    logger.success(
                        `[${successfulRelations} of ${totalRelations}] - ${STATUS_ICONS.Success} Linked tag "${tagName}" to ${entityType} "${entityName}"`
                    );
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.error(
                        `${STATUS_ICONS.Error} Failed to link tag ${seedTagId} to ${entityType} ${entity.id}: ${errorMessage}`
                    );

                    // Track error in summary and error history
                    summaryTracker.trackError(
                        'Tag Relations',
                        `${entityType}-${entity.id}-${seedTagId}`,
                        errorMessage
                    );
                    errorHistory.recordError(
                        'Tag Relations',
                        `${entityType}-${entity.id}-${seedTagId}`,
                        `Failed to link tag ${seedTagId} to ${entityType} ${entity.id}: ${errorMessage}`,
                        error
                    );
                    errorCount++;
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(
                `${STATUS_ICONS.Error} Error processing ${entityType} file ${fileName}: ${errorMessage}`
            );

            // Track error in summary and error history
            summaryTracker.trackError('Tag Relations', `${entityType}-${fileName}`, errorMessage);
            errorHistory.recordError(
                'Tag Relations',
                `${entityType}-${fileName}`,
                `Error processing ${entityType} file ${fileName}: ${errorMessage}`,
                error
            );
            errorCount++;
        }
    }

    logger.info(
        `${STATUS_ICONS.Info} ${entityType}: ${successfulRelations} relations processed, ${errorCount} errors`
    );
}

/**
 * Seeds tag relations for all entities that have tagIds.
 * This seed should be executed after all other seeds (required + example) are complete.
 *
 * @param context - Seed context with configuration and utilities
 */
export async function seedTagRelations(context: SeedContext): Promise<void> {
    const separator = '#'.repeat(90);
    const subSeparator = '─'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Process} PROCESSING TAG RELATIONS`);
    logger.info(`${subSeparator}`);

    try {
        // Process required entities
        if (requiredManifest.destinations) {
            await processTagRelations('destinations', requiredManifest.destinations, context);
        }

        // Process example entities
        const exampleEntities = [
            { type: 'posts', files: exampleManifest.posts },
            { type: 'events', files: exampleManifest.events },
            { type: 'accommodations', files: exampleManifest.accommodations }
        ];

        for (const { type, files } of exampleEntities) {
            if (files && files.length > 0) {
                await processTagRelations(type, files, context);
            }
        }

        logger.info(`${subSeparator}`);
        logger.success(`${STATUS_ICONS.Success} Tag relations processing completed`);
    } catch (error) {
        logger.info(`${subSeparator}`);
        logger.error(`${STATUS_ICONS.Error} Tag relations processing failed`);
        logger.error(`   Error: ${(error as Error).message}`);

        if (!context.continueOnError) {
            throw error;
        }
    }

    logger.info(`${separator}\n`);
}
