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
 * Service result type
 */
interface ServiceResult {
    data?: { id?: string };
    error?: { message: string; code: string; details?: Record<string, unknown> };
}

/**
 * Configuration for creating a seed factory
 */
export interface SeedFactoryConfig<T = unknown, R = unknown> {
    // Basic configuration
    entityName: string;
    serviceClass: ServiceConstructor;
    folder: string;
    files: string[];

    // Customizable callbacks
    normalizer?: (data: Record<string, unknown>) => R;
    getEntityInfo?: (item: unknown) => string;
    preProcess?: (item: T, context: SeedContext) => Promise<void>;
    postProcess?: (result: unknown, item: T, context: SeedContext) => Promise<void>;
    errorHandler?: (item: unknown, index: number, error: Error) => void;
    relationBuilder?: (result: unknown, item: T, context: SeedContext) => Promise<void>;

    // Advanced configuration
    continueOnError?: boolean;
    validateBeforeCreate?: (data: Record<string, unknown> | R) => boolean | Promise<boolean>;
    transformResult?: (result: unknown) => unknown;
}

/**
 * Validates that the actor exists in the context
 */
const validateActor = (context: SeedContext): Actor => {
    if (!context.actor) {
        throw new Error(
            `${STATUS_ICONS.Error} Actor no disponible en el contexto. El super admin debe cargarse primero.`
        );
    }
    return context.actor;
};

/**
 * Default normalizer that passes through the data
 */
const defaultNormalizer = (data: Record<string, unknown>) => data;

/**
 * Default entity info formatter
 */
const defaultGetEntityInfo = (item: unknown) => {
    const itemData = item as Record<string, unknown>;
    const name = itemData.name as string;
    return `"${name}"`;
};

/**
 * Default error handler
 */

/**
 * Creates a seed factory with customizable callbacks
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
                        throw new Error('Validación personalizada falló');
                    }
                }

                // Create entity with proper service context
                const serviceContext = { logger };
                const service = new config.serviceClass(serviceContext) as {
                    create: (actor: Actor, data: unknown) => Promise<ServiceResult>;
                };
                const result = await service.create(
                    context.actor as Actor,
                    normalizedData as Record<string, unknown>
                );

                // Handle creation errors
                if (result?.error) {
                    const error = result.error;
                    let errorMessage = `${STATUS_ICONS.Error} ${config.entityName} creation failed:\n`;
                    errorMessage += `Error: ${error.message}\n`;

                    // Add detailed error information
                    if (error.details) {
                        const details = error.details as Record<string, unknown>;

                        // Field errors
                        if (details.fieldErrors) {
                            const fieldErrors = details.fieldErrors as Record<string, string[]>;
                            errorMessage += '\nField Errors:\n';
                            for (const [field, errors] of Object.entries(fieldErrors)) {
                                errorMessage += `  • ${field}: ${errors.join(', ')}\n`;
                            }
                        }

                        // Form errors
                        if (details.formErrors) {
                            const formErrors = details.formErrors as string[];
                            if (formErrors.length > 0) {
                                errorMessage += '\nForm Errors:\n';
                                for (const formError of formErrors) {
                                    errorMessage += `  • ${formError}\n`;
                                }
                            }
                        }

                        // Validation issues
                        if (details.issues) {
                            const issues = details.issues as Array<{
                                path: string[];
                                message: string;
                                code: string;
                            }>;
                            errorMessage += '\nValidation Issues:\n';
                            for (const issue of issues) {
                                const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
                                errorMessage += `  • ${path}: ${issue.message} (code: ${issue.code})\n`;
                            }
                        }

                        // Input data
                        if (details.input) {
                            errorMessage += '\nInput Data:\n';
                            errorMessage += `  ${JSON.stringify(details.input, null, 2)}\n`;
                        }
                    }

                    errorMessage += `\nError Code: ${error.code}`;

                    // Track error and throw it for seedRunner to handle
                    summaryTracker.trackError(
                        config.entityName,
                        context.currentFile || 'unknown',
                        error.message
                    );

                    // 🔍 LOG DISTINTIVO: seedFactory
                    console.error(
                        `${STATUS_ICONS.Debug} [SEED_FACTORY] Lanzando error con detalles completos`
                    );

                    throw new Error(errorMessage);
                }

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
                            `${STATUS_ICONS.Error} [SEED_FACTORY] No se pudo obtener el ID del item ${itemData.id}`
                        );
                    }
                    context.idMapper.setMapping(
                        config.entityName.toLowerCase(),
                        seedId,
                        serviceResult.data.id
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
