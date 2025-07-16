import { ServiceErrorCode } from '@repo/types';
import type { ZodTypeAny, z } from 'zod';
import type { Actor, ServiceContext, ServiceLogger, ServiceOutput } from '../types';
import { ServiceError } from '../types';
import { logError, logMethodEnd, logMethodStart, validateActor, validateEntity } from '../utils';

/**
 * BaseService: lógica y dependencias genéricas para todos los servicios.
 * No incluye métodos CRUD ni hooks de entidades.
 * @template TNormalizers - Tipo de normalizadores que puede usar el servicio (por defecto, Record<string, unknown>)
 */
export abstract class BaseService<TNormalizers = Record<string, unknown>> {
    /** Logger para el servicio */
    protected readonly logger: ServiceLogger;
    /** Nombre de la entidad (para logs, errores, etc.) */
    protected readonly entityName: string;

    constructor(ctx: ServiceContext, entityName: string) {
        this.logger = ctx.logger;
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
                const error = new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Invalid input data provided.',
                    validationResult.error.flatten()
                );
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
                'An unexpected error occurred.',
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
     * Fetches an entity by ID, validates its existence, y checks permissions.
     * Utility for update/delete/restore operations.
     * @param model - ORM model con método findById
     * @param id - ID de la entidad
     * @param actor - Actor que ejecuta la acción
     * @param entityName - Nombre de la entidad para logs/errores
     * @param permissionCheck - Función de permisos (opcional)
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
        // validateEntity lanza si no existe, así que entity nunca es null
        const entity = validateEntity(entityOrNull, entityName);
        await Promise.resolve(permissionCheck(actor, entity));
        return entity;
    }

    // Métodos utilitarios comunes a todos los servicios pueden agregarse aquí
}
