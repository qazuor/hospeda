import { ServiceErrorCode } from '@repo/schemas';
import type { ZodTypeAny, z } from 'zod';
import type {
    Actor,
    DrizzleClient,
    ServiceConfig,
    ServiceContext,
    ServiceLogger,
    ServiceOutput
} from '../types';
import { ServiceError } from '../types';
import {
    logError,
    logMethodEnd,
    logMethodStart,
    maskForeignRowRefusal,
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

    constructor(config: ServiceConfig, entityName: string) {
        this.logger = config.logger ?? serviceLogger;
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
        ctx,
        execute
    }: {
        methodName: string;
        input: { actor: Actor } & Record<string, unknown>;
        schema: TInput;
        ctx?: ServiceContext;
        execute: (data: z.infer<TInput>, actor: Actor, ctx: ServiceContext) => Promise<TOutput>;
    }): Promise<ServiceOutput<TOutput>> {
        const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };
        const { actor, ...params } = input;
        this.logMethodStart(methodName, params, actor);
        try {
            validateActor(actor);
            // biome-ignore lint/suspicious/noImplicitAnyLet: type is inferred after safeParseAsync which returns a discriminated union that cannot be annotated ahead of time
            let validationResult;
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
                    if (Array.isArray(errors) && errors.length > 0) {
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
            const result = await execute(validData, actor, resolvedCtx);
            logMethodEnd(`${this.entityName}.${methodName}`, result);
            return { data: result };
        } catch (error) {
            if (error instanceof ServiceError) {
                logError(`${this.entityName}.${methodName}`, error, params, actor);
                if (ctx?.tx) {
                    throw error;
                }
                return { error };
            }

            // Re-throw database errors to preserve their type for proper HTTP status mapping
            if (error && typeof error === 'object' && 'name' in error && error.name === 'DbError') {
                throw error;
            }

            const serviceError = new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`,
                error
            );
            logError(`${this.entityName}.${methodName}`, serviceError, params, actor);
            if (ctx?.tx) {
                throw serviceError;
            }
            return { error: serviceError };
        }
    }

    private logMethodStart(method: string, input: unknown, actor: Actor): void {
        logMethodStart(`${this.entityName}.${method}`, input, actor);
    }

    /**
     * Runs a write-path permission hook against an ALREADY-FETCHED row, and
     * masks a refusal that would confirm the row exists (HOS-706).
     *
     * This is the single place the write pipeline evaluates `_canUpdate` /
     * `_canSoftDelete` / `_canHardDelete` / `_canRestore` / `_canUpdateVisibility`,
     * so it is also the single place the disclosure can be closed. HOS-600 fixed
     * the READ paths and left this family open as an owner decision: a caller
     * holding `*_UPDATE_OWN` learned from a 403 that a foreign id was real, while
     * an invented id answered 404.
     *
     * The boundary does not move — the caller is still refused. See
     * {@link maskForeignRowRefusal} for the three cases that stay 403, the most
     * important being a refusal aimed at the row's OWNER (a state rule, not an
     * existence one).
     *
     * @param params - Parameters object.
     * @param params.actor - The actor performing the write.
     * @param params.entity - The row fetched before the check.
     * @param params.entityName - Entity name used to compose the 404.
     * @param params.check - The permission hook to evaluate.
     * @throws {ServiceError} The hook's own error, or the canonical NOT_FOUND.
     */
    protected async _assertWritePermission<TEntity>({
        actor,
        entity,
        entityName,
        check
    }: {
        readonly actor: Actor;
        readonly entity: TEntity;
        readonly entityName: string;
        readonly check: (actor: Actor, entity: TEntity) => Promise<void> | void;
    }): Promise<void> {
        try {
            await Promise.resolve(check(actor, entity));
        } catch (error) {
            throw maskForeignRowRefusal({ error, actor, entity, entityName });
        }
    }

    /**
     * Fetches an entity by ID, validates its existence, and checks permissions.
     * Utility for update/delete/restore operations.
     *
     * The permission hook runs through {@link _assertWritePermission}, so a
     * refusal on a row the actor does not own answers the SAME 404 as a row that
     * does not exist (HOS-706). `validateEntity` composes `${entityName} not
     * found` and so does `entityNotFoundError`, which is what keeps the two
     * branches byte-identical rather than merely equal in status.
     *
     * @param model - ORM model with findById method
     * @param id - Entity ID
     * @param actor - Actor performing the action
     * @param entityName - Entity name for logs/errors
     * @param permissionCheck - Permission function (optional)
     * @param ctx - Service context. When provided with a transaction, findById uses it.
     */
    protected async _getAndValidateEntity<
        TEntity,
        TModel extends { findById: (id: string, tx?: DrizzleClient) => Promise<TEntity | null> }
    >(
        model: TModel,
        id: string,
        actor: Actor,
        entityName: string,
        permissionCheck: (actor: Actor, entity: TEntity) => Promise<void> | void = async () =>
            Promise.resolve(),
        ctx?: ServiceContext
    ): Promise<TEntity> {
        const entityOrNull = await model.findById(id, ctx?.tx);
        // validateEntity throws if not exists, so entity is never null
        const entity = validateEntity(entityOrNull, entityName);
        await this._assertWritePermission({
            actor,
            entity,
            entityName,
            check: permissionCheck
        });
        return entity;
    }

    // Common utility methods for all services can be added here
}
