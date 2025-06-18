import { createPublicUser } from '@repo/types';
import type { z } from 'zod';
import {
    type Actor,
    type BaseModel,
    type CanCreateResult,
    type CanDeleteResult,
    type CanHardDeleteResult,
    type CanRestoreResult,
    type CanUpdateResult,
    type CanViewResult,
    EntityPermissionReasonEnum,
    ServiceError,
    ServiceErrorCode,
    type ServiceInput,
    type ServiceOutput
} from '../types';
import {
    logDenied,
    logError,
    logGrant,
    logMethodEnd,
    logMethodStart,
    logPermission
} from '../utils/logging';
import { validateActor, validateInput } from '../utils/validation';

/**
 * Abstract base class for all services.
 * Provides common functionality for CRUD operations, permission checks, normalization, and error handling.
 *
 * @template T - The type of the entity
 * @template CreateInput - The type of the create input
 * @template UpdateInput - The type of the update input
 * @template ListInput - The type of the list input
 * @template ListOutput - The type of the list output
 */
export abstract class BaseService<T, CreateInput, UpdateInput, ListInput, ListOutput> {
    /**
     * Creates a new BaseService.
     * @param entityName - The name of the entity for logging and error messages
     */
    constructor(protected readonly entityName: string) {}

    /**
     * The model instance for database operations.
     */
    protected abstract model: BaseModel<T>;
    /**
     * The Zod schema for input validation.
     */
    protected abstract inputSchema: z.ZodSchema<CreateInput>;

    // --- Abstract Methods ---

    /**
     * Checks if an actor can view an entity.
     * @param actor - The actor to check
     * @param entity - The entity to check
     * @returns The result of the permission check
     */
    protected abstract canViewEntity(actor: Actor, entity: T): Promise<CanViewResult>;

    /**
     * Checks if an actor can update an entity.
     * @param actor - The actor to check
     * @param entity - The entity to check
     * @returns The result of the permission check
     */
    protected abstract canUpdateEntity(actor: Actor, entity: T): Promise<CanUpdateResult>;

    /**
     * Checks if an actor can delete an entity.
     * @param actor - The actor to check
     * @param entity - The entity to check
     * @returns The result of the permission check
     */
    protected abstract canDeleteEntity(actor: Actor, entity: T): Promise<CanDeleteResult>;

    /**
     * Checks if an actor can create an entity.
     * @param actor - The actor to check
     * @returns The result of the permission check
     */
    protected abstract canCreateEntity(actor: Actor): Promise<CanCreateResult>;

    /**
     * Checks if an actor can restore an entity.
     * @param actor - The actor to check
     * @param entity - The entity to check
     * @returns The result of the permission check
     */
    protected abstract canRestoreEntity(actor: Actor, entity: T): Promise<CanRestoreResult>;

    /**
     * Checks if an actor can hard delete an entity.
     * @param actor - The actor to check
     * @param entity - The entity to check
     * @returns The result of the permission check
     */
    protected abstract canHardDeleteEntity(actor: unknown, entity: T): CanHardDeleteResult;

    /**
     * Normalizes the input for creating an entity. Override if you need to transform or enrich the input.
     * @param input - The input to normalize
     * @returns The normalized input
     */
    protected async normalizeCreateInput(input: CreateInput): Promise<CreateInput> {
        return input;
    }

    /**
     * Normalizes the input for updating an entity. Override if you need to transform or enrich the input.
     * @param input - The input to normalize
     * @returns The normalized input
     */
    protected async normalizeUpdateInput(input: UpdateInput): Promise<UpdateInput> {
        return input;
    }

    /**
     * Normalizes the input for listing entities. Override if you need to transform or enrich the input.
     * @param input - The input to normalize
     * @returns The normalized input
     */
    protected async normalizeListInput(input: ListInput): Promise<ListInput> {
        return input;
    }

    /**
     * Default implementation for soft delete update.
     *
     * This cast is safe because all domain models are expected to have 'deletedAt' and 'deletedById' fields for soft deletion.
     * If your model does not have these fields, override this method in your service.
     *
     * @param actor - The actor performing the soft delete
     * @returns Partial<T> with soft delete fields set
     */
    protected buildSoftDeleteUpdate(actor: { id: string }): Partial<T> {
        // Safe cast: all domain models are expected to have deletedAt and deletedById for soft deletion
        return { deletedAt: new Date(), deletedById: actor.id } as unknown as Partial<T>;
    }

    /**
     * Default implementation for restore update.
     *
     * This cast is safe because all domain models are expected to have 'deletedAt' and 'deletedById' fields for restoration.
     * If your model does not have these fields, override this method in your service.
     *
     * @param _actor - The actor performing the restore
     * @returns Partial<T> with restore fields set
     */
    protected buildRestoreUpdate(_actor: { id: string }): Partial<T> {
        // Safe cast: all domain models are expected to have deletedAt and deletedById for restoration
        return { deletedAt: null, deletedById: null } as unknown as Partial<T>;
    }

    /**
     * Generates a URL-friendly slug for an entity. Must be implemented by each service.
     * @param args - Arguments required to generate the slug (domain-specific)
     * @returns The generated slug
     */
    public abstract generateSlug(...args: unknown[]): string;

    // --- Protected Methods ---

    /**
     * Validates the actor object. Throws if invalid.
     * @param actor - The actor to validate
     */
    protected async validateActor(actor: unknown): Promise<void> {
        validateActor(actor);
    }

    /**
     * Logs the start of a method execution.
     * @param method - The method name
     * @param input - The input data
     * @param actor - The actor
     */
    protected logMethodStart(method: string, input: unknown, actor: Actor): void {
        logMethodStart(method, input, actor);
    }

    /**
     * Logs the end of a method execution.
     * @param method - The method name
     * @param output - The output data
     */
    protected logMethodEnd(method: string, output: unknown): void {
        logMethodEnd(method, output);
    }

    /**
     * Logs an error during method execution.
     * @param method - The method name
     * @param error - The error
     * @param input - The input data
     * @param actor - The actor
     */
    protected logError(method: string, error: Error, input: unknown, actor: Actor): void {
        logError(method, error, input, actor);
    }

    /**
     * Logs a permission check.
     * @param permission - The permission name
     * @param actor - The actor
     * @param input - The input data
     * @param error - The error message (if any)
     */
    protected logPermission(
        permission: string,
        actor: Actor,
        input?: unknown,
        error?: string
    ): void {
        logPermission(permission, actor, input, error);
    }

    /**
     * Logs a denied permission.
     * @param actor - The actor
     * @param input - The input data
     * @param entity - The entity
     * @param reason - The reason for denial
     * @param permission - The permission name (optional)
     */
    protected logDenied(
        actor: Actor,
        input: unknown,
        entity: unknown,
        reason: string,
        permission?: string
    ): void {
        logDenied(actor, input, entity, reason, permission ?? '');
    }

    /**
     * Logs a granted permission.
     * @param actor - The actor
     * @param input - The input data
     * @param entity - The entity
     * @param permission - The permission name
     * @param reason - The reason for grant
     */
    protected logGrant(
        actor: Actor,
        input: unknown,
        entity: unknown,
        permission: string,
        reason: string
    ): void {
        logGrant(actor, input, entity, permission, reason);
    }

    /**
     * Executes a handler with logging, actor validation, and input validation (optional).
     * Centralizes try/catch/log/validate pattern for public methods.
     *
     * @param methodName - The name of the method
     * @param input - The input data
     * @param handler - The handler function
     * @param schema - Optional Zod schema for input validation
     * @returns ServiceOutput<R> with data or error
     */
    protected async runWithLoggingAndValidation<I, R>(
        methodName: string,
        input: ServiceInput<I>,
        handler: (actor: Actor, input: ServiceInput<I>) => Promise<R>,
        schema?: z.ZodType
    ): Promise<ServiceOutput<R>> {
        this.logMethodStart(methodName, input, input.actor);
        try {
            this.validateActor(input.actor);
            if (schema) {
                validateInput(schema, input, methodName);
            }
            const result = await handler(input.actor, input);
            this.logMethodEnd(methodName, result);
            return { data: result };
        } catch (error) {
            this.logError(
                methodName,
                error as Error,
                input,
                this.getSafeActor({ actor: input.actor })
            );
            if (error instanceof ServiceError) {
                return this.makeErrorOutput(error.code, error.message);
            }
            return this.makeErrorOutput(ServiceErrorCode.INTERNAL_ERROR, (error as Error).message);
        }
    }

    /**
     * Returns a safe actor object, defaulting to a public user if missing or invalid.
     * @param input - The input containing the actor
     * @returns The safe actor
     */
    protected getSafeActor(input: { actor?: Actor }): Actor {
        const actor = input.actor ?? createPublicUser();
        // Type guard: if the actor does not have id or role, return a public user
        if (!actor || !actor.id || !actor.role) return createPublicUser();
        return actor;
    }

    /**
     * Creates a ServiceOutput error object.
     * @param code - The error code
     * @param message - The error message
     * @returns ServiceOutput<T> with error
     */
    protected makeErrorOutput<T>(code: ServiceErrorCode, message: string): ServiceOutput<T> {
        return {
            error: {
                code,
                message
            }
        };
    }

    // --- Permission Helpers ---

    /**
     * Checks if the actor is an admin.
     * @param actor - The actor to check
     * @returns True if admin
     */
    protected isAdmin(actor: Actor): boolean {
        return actor.role === 'ADMIN';
    }

    /**
     * Checks if the actor is the owner of the entity.
     * @param actor - The actor to check
     * @param entity - The entity to check
     * @returns True if owner
     */
    protected isOwner(actor: Actor, entity: { ownerId?: string }): boolean {
        return !!entity.ownerId && entity.ownerId === actor.id;
    }

    /**
     * Default permission check for view.
     * @param actor - The actor
     * @param entity - The entity
     * @returns CanViewResult
     */
    protected defaultCanView(
        actor: Actor,
        entity: { ownerId?: string; isFeatured?: boolean }
    ): CanViewResult {
        if (this.isAdmin(actor)) return { canView: true, reason: EntityPermissionReasonEnum.ADMIN };
        if (this.isOwner(actor, entity))
            return { canView: true, reason: EntityPermissionReasonEnum.ADMIN };
        if ('isFeatured' in entity && entity.isFeatured)
            return { canView: true, reason: EntityPermissionReasonEnum.ADMIN };
        return { canView: false, reason: EntityPermissionReasonEnum.DENIED };
    }

    /**
     * Default permission check for update.
     * @param actor - The actor
     * @param entity - The entity
     * @returns CanUpdateResult
     */
    protected defaultCanUpdate(actor: Actor, entity: { ownerId?: string }): CanUpdateResult {
        if (this.isAdmin(actor))
            return { canUpdate: true, reason: EntityPermissionReasonEnum.ADMIN };
        if (this.isOwner(actor, entity))
            return { canUpdate: true, reason: EntityPermissionReasonEnum.ADMIN };
        return { canUpdate: false, reason: EntityPermissionReasonEnum.DENIED };
    }

    /**
     * Default permission check for delete.
     * @param actor - The actor
     * @param entity - The entity
     * @returns CanDeleteResult
     */
    protected defaultCanDelete(actor: Actor, entity: { ownerId?: string }): CanDeleteResult {
        if (this.isAdmin(actor))
            return { canDelete: true, reason: EntityPermissionReasonEnum.ADMIN };
        if (this.isOwner(actor, entity))
            return { canDelete: true, reason: EntityPermissionReasonEnum.ADMIN };
        return { canDelete: false, reason: EntityPermissionReasonEnum.DENIED };
    }

    /**
     * Default permission check for create.
     * @param actor - The actor
     * @returns CanCreateResult
     */
    protected defaultCanCreate(actor: Actor): CanCreateResult {
        if (this.isAdmin(actor))
            return { canCreate: true, reason: EntityPermissionReasonEnum.ADMIN };
        return { canCreate: false, reason: EntityPermissionReasonEnum.DENIED };
    }

    /**
     * Default permission check for restore.
     * @param actor - The actor
     * @param entity - The entity
     * @returns CanRestoreResult
     */
    protected defaultCanRestore(actor: Actor, entity: { ownerId?: string }): CanRestoreResult {
        if (this.isAdmin(actor))
            return { canRestore: true, reason: EntityPermissionReasonEnum.ADMIN };
        if (this.isOwner(actor, entity))
            return { canRestore: true, reason: EntityPermissionReasonEnum.ADMIN };
        return { canRestore: false, reason: EntityPermissionReasonEnum.DENIED };
    }

    // --- Public Methods ---

    /**
     * Finds an entity by any unique field.
     * @param field - The field name
     * @param value - The value to search for
     * @param input - The original input (with actor and the searched key)
     */
    protected async getByField(
        field: string,
        value: unknown,
        input: ServiceInput<Record<string, unknown>>
    ): Promise<ServiceOutput<T>> {
        const methodName = `getBy${field.charAt(0).toUpperCase() + field.slice(1)}`;
        try {
            this.logMethodStart(methodName, input, input.actor);
            this.validateActor(input.actor);
            const entity = (await this.model.findOne({ [field]: value })) ?? null;
            if (!entity) {
                return this.makeErrorOutput(
                    ServiceErrorCode.NOT_FOUND,
                    `${this.entityName} not found`
                );
            }
            validateInput(this.inputSchema, input, methodName);
            const canView = await this.canViewEntity(input.actor, entity);
            if (!canView.canView) {
                logDenied(input.actor, input, entity, canView.reason, 'view');
                return this.makeErrorOutput(
                    ServiceErrorCode.FORBIDDEN,
                    `Cannot view ${this.entityName}`
                );
            }
            logGrant(input.actor, input, entity, 'view', canView.reason);
            this.logMethodEnd(methodName, entity);
            return { data: entity };
        } catch (error) {
            this.logError(
                methodName,
                error as Error,
                input,
                this.getSafeActor({ actor: input.actor })
            );
            if (error instanceof ServiceError) {
                return this.makeErrorOutput(error.code, error.message);
            }
            return this.makeErrorOutput(ServiceErrorCode.INTERNAL_ERROR, (error as Error).message);
        }
    }

    public async getById(input: ServiceInput<{ id: string }>): Promise<ServiceOutput<T>> {
        return this.getByField('id', input.id, { actor: input.actor, id: input.id });
    }

    public async getBySlug(input: ServiceInput<{ slug: string }>): Promise<ServiceOutput<T>> {
        return this.getByField('slug', input.slug, { actor: input.actor, slug: input.slug });
    }

    public async getByName(input: ServiceInput<{ name: string }>): Promise<ServiceOutput<T>> {
        return this.getByField('name', input.name, { actor: input.actor, name: input.name });
    }

    /**
     * Lists entities based on input criteria.
     * @param {ServiceInput<ListInput>} input - The input containing list criteria
     * @returns {Promise<ServiceOutput<ListOutput>>} The list of entities or an error
     */
    public async list(input: ServiceInput<ListInput>): Promise<ServiceOutput<ListOutput>> {
        try {
            logMethodStart('list', input, this.getSafeActor(input));
            validateActor(this.getSafeActor(input));

            const normalizedInput = await this.normalizeListInput(input);
            const canCreate = await this.canCreateEntity(this.getSafeActor(input));
            if (!canCreate.canCreate) {
                logDenied(this.getSafeActor(input), input, null, canCreate.reason, 'list');
                logMethodEnd('list', { entities: [] });
                return this.makeErrorOutput(
                    ServiceErrorCode.FORBIDDEN,
                    `Cannot list ${this.entityName}s`
                );
            }

            const result = await this.listEntities(normalizedInput);
            logMethodEnd('list', { entities: result });
            return { data: result };
        } catch (error) {
            logError('list', error as Error, input, this.getSafeActor(input));
            return this.makeErrorOutput(
                (error as ServiceError).code ?? ServiceErrorCode.INTERNAL_ERROR,
                (error as Error).message
            );
        }
    }

    /**
     * Creates a new entity.
     * @param {ServiceInput<CreateInput>} input - The input for creating the entity
     * @returns {Promise<ServiceOutput<T>>} The created entity or an error
     */
    public async create(input: ServiceInput<CreateInput>): Promise<ServiceOutput<T>> {
        try {
            logMethodStart('create', input, this.getSafeActor(input));
            validateActor(this.getSafeActor(input));
            const canCreate = await this.canCreateEntity(this.getSafeActor(input));
            if (!canCreate.canCreate) {
                logDenied(this.getSafeActor(input), input, null, canCreate.reason, 'create');
                logMethodEnd('create', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.FORBIDDEN,
                    `Cannot create ${this.entityName}`
                );
            }
            const normalizedInput = await this.normalizeCreateInput(input);
            if (!normalizedInput) {
                logMethodEnd('create', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.VALIDATION_ERROR,
                    `Invalid input for ${this.entityName}`
                );
            }
            const entity = await this.model.create(normalizedInput as Partial<T>);
            if (!entity) {
                logMethodEnd('create', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.INTERNAL_ERROR,
                    `Failed to create ${this.entityName}`
                );
            }
            logGrant(this.getSafeActor(input), input, entity, 'create', canCreate.reason);
            logMethodEnd('create', { entity });
            return { data: entity };
        } catch (error) {
            logError('create', error as Error, input, this.getSafeActor(input));
            return this.makeErrorOutput(
                (error as ServiceError).code ?? ServiceErrorCode.INTERNAL_ERROR,
                (error as Error).message
            );
        }
    }

    /**
     * Updates an existing entity.
     * @param {ServiceInput<UpdateInput & { id: string }>} input - The input for updating the entity
     * @returns {Promise<ServiceOutput<T>>} The updated entity or an error
     */
    public async update(
        input: ServiceInput<UpdateInput & { id: string }>
    ): Promise<ServiceOutput<T>> {
        try {
            logMethodStart('update', input, this.getSafeActor(input));
            validateActor(this.getSafeActor(input));
            const entity = await this.model.findById(input.id);
            if (!entity) {
                logMethodEnd('update', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.NOT_FOUND,
                    `${this.entityName} not found`
                );
            }
            validateInput(this.inputSchema, input, 'update');
            const { canUpdate, reason } = await this.canUpdateEntity(
                this.getSafeActor(input),
                entity
            );
            if (!canUpdate) {
                logDenied(this.getSafeActor(input), input, entity, reason, 'update');
                logMethodEnd('update', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.FORBIDDEN,
                    `Cannot update ${this.entityName}`
                );
            }
            const normalizedInput = await this.normalizeUpdateInput(input);
            if (!normalizedInput || typeof normalizedInput !== 'object') {
                logMethodEnd('update', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.VALIDATION_ERROR,
                    `Invalid input for ${this.entityName}`
                );
            }
            const updatedEntity = await this.model.update(
                { id: input.id },
                normalizedInput as Partial<T>
            );
            if (!updatedEntity) {
                logMethodEnd('update', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.NOT_FOUND,
                    `${this.entityName} not found after update`
                );
            }
            logGrant(this.getSafeActor(input), input, updatedEntity, 'update', reason);
            logMethodEnd('update', { entity: updatedEntity });
            return { data: updatedEntity };
        } catch (error) {
            logError('update', error as Error, input, this.getSafeActor(input));
            return this.makeErrorOutput(
                (error as ServiceError).code ?? ServiceErrorCode.INTERNAL_ERROR,
                (error as Error).message
            );
        }
    }

    /**
     * Soft deletes an entity.
     * @param {ServiceInput<{ id: string }>} input - The input containing the ID
     * @returns {Promise<ServiceOutput<T>>} The deleted entity or an error
     */
    public async softDelete(input: ServiceInput<{ id: string }>): Promise<ServiceOutput<T>> {
        try {
            logMethodStart('softDelete', input, this.getSafeActor(input));
            validateActor(this.getSafeActor(input));
            const entity = await this.model.findById(input.id);
            if (!entity) {
                logMethodEnd('softDelete', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.NOT_FOUND,
                    `${this.entityName} not found`
                );
            }
            validateInput(this.inputSchema, input, 'softDelete');
            const { canDelete, reason } = await this.canDeleteEntity(
                this.getSafeActor(input),
                entity
            );
            if (!canDelete) {
                logDenied(this.getSafeActor(input), input, entity, reason, 'delete');
                logMethodEnd('softDelete', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.FORBIDDEN,
                    `Cannot delete ${this.entityName}`
                );
            }
            const updateInput = this.buildSoftDeleteUpdate(this.getSafeActor(input));
            if (!updateInput || typeof updateInput !== 'object') {
                logMethodEnd('softDelete', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.VALIDATION_ERROR,
                    `Invalid input for ${this.entityName}`
                );
            }
            const deletedEntity = await this.model.update(
                { id: input.id },
                updateInput as Partial<T>
            );
            if (!deletedEntity) {
                logMethodEnd('softDelete', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.NOT_FOUND,
                    `${this.entityName} not found after delete`
                );
            }
            logGrant(this.getSafeActor(input), input, deletedEntity, 'delete', reason);
            logMethodEnd('softDelete', { entity: deletedEntity });
            return { data: deletedEntity };
        } catch (error) {
            logError('softDelete', error as Error, input, this.getSafeActor(input));
            return this.makeErrorOutput(
                (error as ServiceError).code ?? ServiceErrorCode.INTERNAL_ERROR,
                (error as Error).message
            );
        }
    }

    /**
     * Restores a soft-deleted entity.
     * @param {ServiceInput<{ id: string }>} input - The input containing the ID
     * @returns {Promise<ServiceOutput<T>>} The restored entity or an error
     */
    public async restore(input: ServiceInput<{ id: string }>): Promise<ServiceOutput<T>> {
        try {
            logMethodStart('restore', input, this.getSafeActor(input));
            validateActor(this.getSafeActor(input));
            const entity = await this.model.findById(input.id);
            if (!entity) {
                logMethodEnd('restore', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.NOT_FOUND,
                    `${this.entityName} not found`
                );
            }
            validateInput(this.inputSchema, input, 'restore');
            const { canRestore, reason } = await this.canRestoreEntity(
                this.getSafeActor(input),
                entity
            );
            if (!canRestore) {
                logDenied(this.getSafeActor(input), input, entity, reason, 'restore');
                logMethodEnd('restore', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.FORBIDDEN,
                    `Cannot restore ${this.entityName}`
                );
            }
            const updateInput = this.buildRestoreUpdate(this.getSafeActor(input));
            if (!updateInput || typeof updateInput !== 'object') {
                logMethodEnd('restore', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.VALIDATION_ERROR,
                    `Invalid input for ${this.entityName}`
                );
            }
            const restoredEntity = await this.model.update(
                { id: input.id },
                updateInput as Partial<T>
            );
            if (!restoredEntity) {
                logMethodEnd('restore', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.NOT_FOUND,
                    `${this.entityName} not found after restore`
                );
            }
            logGrant(this.getSafeActor(input), input, restoredEntity, 'restore', reason);
            logMethodEnd('restore', { entity: restoredEntity });
            return { data: restoredEntity };
        } catch (error) {
            logError('restore', error as Error, input, this.getSafeActor(input));
            return this.makeErrorOutput(
                (error as ServiceError).code ?? ServiceErrorCode.INTERNAL_ERROR,
                (error as Error).message
            );
        }
    }

    /**
     * Hard deletes an entity.
     * @param {ServiceInput<{ id: string }>} input - The input containing the ID
     * @returns {Promise<ServiceOutput<T>>} The deleted entity or an error
     */
    public async hardDelete(input: ServiceInput<{ id: string }>): Promise<ServiceOutput<T>> {
        try {
            logMethodStart('hardDelete', input, this.getSafeActor(input));
            validateActor(this.getSafeActor(input));
            const entity = await this.model.findById(input.id);
            if (!entity) {
                logMethodEnd('hardDelete', { entity: null });
                return this.makeErrorOutput(
                    ServiceErrorCode.NOT_FOUND,
                    `${this.entityName} not found`
                );
            }
            validateInput(this.inputSchema, input, 'hardDelete');
            const { canHardDelete, reason } = this.canHardDeleteEntity(
                this.getSafeActor(input),
                entity
            );
            if (!canHardDelete) {
                logDenied(this.getSafeActor(input), input, entity, reason, 'delete');
                logMethodEnd('hardDelete', { success: false });
                return this.makeErrorOutput(
                    ServiceErrorCode.FORBIDDEN,
                    `Cannot delete ${this.entityName}`
                );
            }
            const success = await this.model.hardDelete({ id: input.id as string });
            if (!success) {
                logMethodEnd('hardDelete', { success: false });
                return this.makeErrorOutput(
                    ServiceErrorCode.INTERNAL_ERROR,
                    `Failed to hard delete ${this.entityName}`
                );
            }
            logGrant(this.getSafeActor(input), input, entity, 'delete', reason);
            logMethodEnd('hardDelete', { success });
            return { data: entity };
        } catch (error) {
            logError('hardDelete', error as Error, input, this.getSafeActor(input));
            return this.makeErrorOutput(
                (error as ServiceError).code ?? ServiceErrorCode.INTERNAL_ERROR,
                (error as Error).message
            );
        }
    }

    /**
     * Lists entities based on input criteria.
     * @param {ListInput} input - The input containing list criteria
     * @returns {Promise<ListOutput>} The list of entities
     */
    protected abstract listEntities(input: ListInput): Promise<ListOutput>;
}
