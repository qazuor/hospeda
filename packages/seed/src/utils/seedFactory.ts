import type { Actor } from '@repo/service-core';
import { STATUS_ICONS } from './icons.js';
import { loadJsonFiles } from './loadJsonFile.js';
import { logger } from './logger.js';
import type { SeedContext } from './seedContext.js';
import { seedRunner } from './seedRunner.js';
import { summaryTracker } from './summaryTracker.js';

/**
 * Service constructor type - compatible with service constructors
 */
// biome-ignore lint/suspicious/noExplicitAny: Service constructors have varying signatures
type ServiceConstructor<T = unknown> = new (ctx: any, ...args: any[]) => T;

/**
 * Service result type with optional data and error information
 */
interface ServiceResult {
    /** Result data containing the created entity */
    data?: { id?: string };
    /** Error information if the operation failed */
    error?: { message: string; code: string; details?: Record<string, unknown> };
}

/**
 * Configuration for creating a seed factory.
 *
 * This interface defines all the options available for customizing
 * the behavior of a seed factory, including callbacks for different
 * stages of the seeding process.
 */
export interface SeedFactoryConfig<T = unknown, R = unknown> {
    // Basic configuration
    /** Name of the entity being seeded */
    entityName: string;
    /** Service class to use for creating entities */
    serviceClass: ServiceConstructor;
    /** Folder path containing the JSON files */
    folder: string;
    /** Array of JSON file names to process */
    files: string[];

    // Customizable callbacks
    /** Function to normalize data before creation */
    normalizer?: (data: Record<string, unknown>) => R;
    /** Function to get display information for an entity */
    getEntityInfo?: (item: unknown) => string;
    /** Function called before processing each item */
    preProcess?: (item: T, context: SeedContext) => Promise<void>;
    /** Function called after processing each item */
    postProcess?: (result: unknown, item: T, context: SeedContext) => Promise<void>;
    /** Custom error handler for individual items */
    errorHandler?: (item: unknown, index: number, error: Error) => void;
    /** Function to build relationships after entity creation */
    relationBuilder?: (result: unknown, item: T, context: SeedContext) => Promise<void>;

    // Advanced configuration
    /** Whether to continue processing when encountering errors */
    continueOnError?: boolean;
    /** Function to validate data before creation */
    validateBeforeCreate?: (data: Record<string, unknown> | R) => boolean | Promise<boolean>;
    /** Function to transform the result after creation */
    transformResult?: (result: unknown) => unknown;
}

/**
 * Validates that the actor exists in the context.
 *
 * @param context - Seed context containing the actor
 * @returns The validated actor
 * @throws {Error} When actor is not available in context
 */
const validateActor = (context: SeedContext): Actor => {
    if (!context.actor) {
        throw new Error(
            `${STATUS_ICONS.Error} Actor not available in context. Super admin must be loaded first.`
        );
    }
    return context.actor;
};

/**
 * Default normalizer that passes through the data unchanged.
 *
 * @param data - Input data to normalize
 * @returns The same data without modification
 */
const defaultNormalizer = (data: Record<string, unknown>) => data;

/**
 * Default entity info formatter that extracts the name field.
 *
 * @param item - Entity item to format
 * @returns Formatted string with the entity name
 */
const defaultGetEntityInfo = (item: unknown) => {
    const itemData = item as Record<string, unknown>;
    const name = itemData.name as string;
    return `"${name}"`;
};

/**
 * Creates a seed factory with customizable callbacks.
 *
 * This factory function provides a complete seeding solution with:
 * - JSON file loading and processing
 * - Progress tracking and logging
 * - Error handling and recovery
 * - Relationship building
 * - Customizable data transformation
 * - ID mapping and persistence
 *
 * @param config - Configuration for the seed factory
 * @returns A function that can be called with a seed context to execute the seeding
 *
 * @example
 * ```typescript
 * const seedUsers = createSeedFactory({
 *   entityName: 'Users',
 *   serviceClass: UserService,
 *   folder: 'src/data/users',
 *   files: ['users.json'],
 *   normalizer: (data) => ({ ...data, email: data.email.toLowerCase() }),
 *   getEntityInfo: (user) => `${user.name} (${user.email})`,
 *   relationBuilder: async (result, user, context) => {
 *     // Build user relationships
 *   }
 * });
 *
 * await seedUsers(seedContext);
 * ```
 */
export const createSeedFactory = <T = unknown, R = unknown>(config: SeedFactoryConfig<T, R>) => {
    return async (context: SeedContext) => {
        // Validate actor
        validateActor(context);

        // Set current entity for error tracking
        context.currentEntity = config.entityName;

        // Load JSON files
        const items = await loadJsonFiles(config.folder, config.files);

        await seedRunner({
            entityName: config.entityName,
            items,
            context,

            // Use custom callback or default
            getEntityInfo: config.getEntityInfo || defaultGetEntityInfo,

            async process(item: unknown, index: number) {
                // Set current file for error tracking
                context.currentFile = config.files[index];

                // Pre-process callback
                if (config.preProcess) {
                    await config.preProcess(item as T, context);
                }

                // Normalize data (custom or default)
                const normalizedData = config.normalizer
                    ? config.normalizer(item as Record<string, unknown>)
                    : defaultNormalizer(item as Record<string, unknown>);

                // Custom validation
                if (config.validateBeforeCreate) {
                    const isValid = await config.validateBeforeCreate(normalizedData);
                    if (!isValid) {
                        throw new Error('Custom validation failed');
                    }
                }

                // Create entity with proper service context
                const serviceContext = { logger };
                const service = new config.serviceClass(serviceContext) as {
                    create: (actor: Actor, data: unknown) => Promise<ServiceResult>;
                };

                const actor = validateActor(context);
                const result = await service.create(actor, normalizedData);

                // Transform result if needed
                const finalResult = config.transformResult
                    ? config.transformResult(result)
                    : result;

                // Save ID mapping if available
                const serviceResult = finalResult as ServiceResult;
                if (serviceResult?.data?.id) {
                    const itemData = item as Record<string, unknown>;
                    const seedId = itemData.id as string;
                    if (!seedId) {
                        throw new Error(
                            `${STATUS_ICONS.Error} [SEED_FACTORY] Could not get ID from item ${itemData.id}`
                        );
                    }

                    // Get entity name for better logging
                    const entityName = config.getEntityInfo
                        ? config.getEntityInfo(item)
                        : undefined;

                    context.idMapper.setMapping(
                        config.entityName.toLowerCase(),
                        seedId,
                        serviceResult.data.id,
                        entityName
                    );
                }

                // Post-process callback
                if (config.postProcess) {
                    await config.postProcess(finalResult, item as T, context);
                }

                // Relation builder callback
                if (config.relationBuilder) {
                    await config.relationBuilder(finalResult, item as T, context);
                }

                // Track success
                summaryTracker.trackSuccess(config.entityName);
            },

            onError: config.errorHandler
        });
    };
};
