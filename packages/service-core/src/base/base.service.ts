import { ServiceErrorCode } from '@repo/types';
import type { ZodTypeAny, z } from 'zod';
import type { Actor, ServiceContext, ServiceLogger, ServiceOutput } from '../types';
import { ServiceError } from '../types';
import {
    logError,
    logMethodEnd,
    logMethodStart,
    serviceLogger,
    validateActor,
    validateEntity
} from '../utils';

/**
 * BaseService: generic logic and dependencies for all services.
 * Does not include CRUD methods or entity hooks.
 * @template TNormalizers - Type of normalizers that the service can use (default: Record<string, unknown>)
 */
export abstract class BaseService<TNormalizers = Record<string, unknown>> {
    /** Logger para el servicio */
    protected readonly logger: ServiceLogger;
    /** Nombre de la entidad (para logs, errores, etc.) */
    protected readonly entityName: string;

    constructor(ctx: ServiceContext, entityName: string) {
        this.logger = ctx.logger ?? serviceLogger;
        this.entityName = entityName;
    }

    /**
     * Generic normalizers registry. Subclasses should override the type parameter to specify their own normalizer set.
     */
    protected normalizers?: TNormalizers;

    /**
     * Wrapper for service method execution with logging, validation, and error handling.
     * Mirrors the implementation in BaseCrudService for 100% homogeneity.
     */
    protected async runWithLoggingAndValidation<TInput extends ZodTypeAny, TOutput>({
        methodName,
        input,
        schema,
        execute
    }: {
        methodName: string;
        input: { actor: Actor } & Record<string, unknown>;
        schema: TInput;
        execute: (data: z.infer<TInput>, actor: Actor) => Promise<TOutput>;
    }): Promise<ServiceOutput<TOutput>> {
        const { actor, ...params } = input;
        this.logMethodStart(methodName, params, actor);
        try {
            validateActor(actor);
            let validationResult: import('zod').SafeParseReturnType<unknown, unknown>;
            try {
                validationResult = await schema.safeParseAsync(params);
            } catch (zodError) {
                const error = new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Invalid input data provided.',
                    zodError instanceof Error ? zodError.message : zodError
                );
                logError(`${this.entityName}.${methodName}`, error, params, actor);
                return { error };
            }
            if (!validationResult.success) {
                const zodError = validationResult.error;
                const fieldErrors = zodError.flatten().fieldErrors;
                const formErrors = zodError.flatten().formErrors;

                const errorMessages = [];

                for (const [field, errors] of Object.entries(fieldErrors)) {
                    if (errors && errors.length > 0) {
                        errorMessages.push(`${field}: ${errors.join(', ')}`);
                    }
                }

                if (formErrors.length > 0) {
                    errorMessages.push(`Form errors: ${formErrors.join(', ')}`);
                }

                const detailedMessage =
                    errorMessages.length > 0
                        ? `Validation failed: ${errorMessages.join('; ')}`
                        : 'Invalid input data provided.';

                const error = new ServiceError(ServiceErrorCode.VALIDATION_ERROR, detailedMessage, {
                    fieldErrors,
                    formErrors,
                    issues: zodError.issues,
                    input: params
                });
                logError(`${this.entityName}.${methodName}`, error, params, actor);
                return { error };
            }
            const validData = validationResult.data;
            const result = await execute(validData, actor);
            logMethodEnd(`${this.entityName}.${methodName}`, result);
            return { data: result };
        } catch (error) {
            if (error instanceof ServiceError) {
                logError(`${this.entityName}.${methodName}`, error, params, actor);
                return { error };
            }
            const serviceError = new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`,
                error
            );
            logError(`${this.entityName}.${methodName}`, serviceError, params, actor);
            return { error: serviceError };
        }
    }

    private logMethodStart(method: string, input: unknown, actor: Actor): void {
        logMethodStart(`${this.entityName}.${method}`, input, actor);
    }

    /**
     * Fetches an entity by ID, validates its existence, and checks permissions.
     * Utility for update/delete/restore operations.
     * @param model - ORM model with findById method
     * @param id - Entity ID
     * @param actor - Actor performing the action
     * @param entityName - Entity name for logs/errors
     * @param permissionCheck - Permission function (optional)
     */
    protected async _getAndValidateEntity<
        TEntity,
        TModel extends { findById: (id: string) => Promise<TEntity | null> }
    >(
        model: TModel,
        id: string,
        actor: Actor,
        entityName: string,
        permissionCheck: (actor: Actor, entity: TEntity) => Promise<void> | void = async () =>
            Promise.resolve()
    ): Promise<TEntity> {
        const entityOrNull = await model.findById(id);
        // validateEntity throws if not exists, so entity is never null
        const entity = validateEntity(entityOrNull, entityName);
        await Promise.resolve(permissionCheck(actor, entity));
        return entity;
    }

    // Common utility methods for all services can be added here
}
