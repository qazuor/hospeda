import type { DrizzleClient } from '@repo/db';
import { ServiceErrorCode, VisibilityEnum } from '@repo/schemas';
import type { ZodObject } from 'zod';
import { z } from 'zod';
import {
    type Actor,
    type BaseModel,
    ServiceError,
    type ServiceInput,
    type ServiceOutput
} from '../types';
import { validateEntity } from '../utils';
import { BaseCrudRead } from './base.crud.read';

/**
 * Abstract base class providing write/mutation operations for CRUD services.
 *
 * Includes the following public API methods:
 * - `create` - Insert a new entity with full lifecycle pipeline
 * - `update` - Update an existing entity by ID
 * - `softDelete` - Mark an entity as deleted (reversible)
 * - `hardDelete` - Permanently remove an entity from the database
 * - `restore` - Reverse a soft-delete
 * - `updateVisibility` - Change the visibility state of an entity
 * - `setFeaturedStatus` - Toggle the featured flag on an entity
 *
 * Admin metadata methods (`getAdminInfo`, `setAdminInfo`) are in `BaseCrudAdmin`.
 *
 * @template TEntity - The primary entity type this service manages.
 * @template TModel - The Drizzle ORM model type for the entity.
 * @template TCreateSchema - The Zod schema for validating entity creation input.
 * @template TUpdateSchema - The Zod schema for validating entity update input.
 * @template TSearchSchema - The Zod schema for validating entity search input.
 */
export abstract class BaseCrudWrite<
    TEntity extends { id: string; deletedAt?: Date | null },
    TModel extends BaseModel<TEntity>,
    TCreateSchema extends ZodObject,
    TUpdateSchema extends ZodObject,
    TSearchSchema extends ZodObject
> extends BaseCrudRead<TEntity, TModel, TCreateSchema, TUpdateSchema, TSearchSchema> {
    /**
     * Creates a new entity following a full lifecycle pipeline.
     *
     * Lifecycle steps:
     * 1. **Validation**: Validates the input data against `createSchema`.
     * 2. **Permissions**: Calls `_canCreate` to check actor permissions.
     * 3. **Normalization**: Applies the `create` normalizer, if defined.
     * 4. **beforeCreate Hook**: Calls `_beforeCreate` for pre-processing.
     * 5. **Database Operation**: Inserts the final payload into the database.
     * 6. **afterCreate Hook**: Calls `_afterCreate` for post-processing.
     *
     * @param actor - The user or system performing the action.
     * @param data - The input data for the new entity, matching `TCreateSchema`.
     * @param tx - Optional transaction client. When provided, the operation participates in the existing transaction.
     * @returns A `ServiceOutput` containing the created entity or a `ServiceError`.
     */
    public async create(
        actor: Actor,
        data: z.infer<TCreateSchema>,
        tx?: DrizzleClient
    ): Promise<ServiceOutput<TEntity>> {
        return this.runWithLoggingAndValidation({
            methodName: 'create',
            input: { actor, ...data },
            schema: this.createSchema,
            execute: async (validatedData, validatedActor) => {
                await this._canCreate(validatedActor, validatedData);

                const normalizedData =
                    (await this.normalizers?.create?.(validatedData, validatedActor)) ??
                    validatedData;

                const processedData =
                    tx !== undefined
                        ? await this._beforeCreate(normalizedData, validatedActor, tx)
                        : await this._beforeCreate(normalizedData, validatedActor);

                const finalData = { ...normalizedData, ...processedData };

                const { bookmarks, ...payload } = finalData as Record<string, unknown> & {
                    bookmarks?: unknown;
                };
                payload.createdById = validatedActor.id;
                payload.updatedById = validatedActor.id;

                const entity =
                    tx !== undefined
                        ? await this.model.create(payload as unknown as Partial<TEntity>, tx)
                        : await this.model.create(payload as unknown as Partial<TEntity>);
                if (!entity) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        `Failed to create ${this.entityName}. The operation returned no result.`
                    );
                }
                return tx !== undefined
                    ? this._afterCreate(entity, validatedActor, tx)
                    : this._afterCreate(entity, validatedActor);
            }
        });
    }

    /**
     * Updates an existing entity by its ID, following a full lifecycle pipeline.
     *
     * Lifecycle steps:
     * 1. **Validation**: Validates the input data against `updateSchema`.
     * 2. **Fetch & Permissions**: Retrieves the entity and calls `_canUpdate`.
     * 3. **Normalization**: Applies the `update` normalizer, if defined.
     * 4. **beforeUpdate Hook**: Calls `_beforeUpdate`.
     * 5. **Database Operation**: Updates the entity in the database.
     * 6. **afterUpdate Hook**: Calls `_afterUpdate`.
     *
     * @param actor - The user or system performing the action.
     * @param id - The ID of the entity to update.
     * @param data - The update data, matching `TUpdateSchema`.
     * @param tx - Optional transaction client. When provided, the operation participates in the existing transaction.
     * @returns A `ServiceOutput` containing the updated entity or a `ServiceError`.
     */
    public async update(
        actor: Actor,
        id: string,
        data: z.infer<TUpdateSchema>,
        tx?: DrizzleClient
    ): Promise<ServiceOutput<TEntity>> {
        const methodName = `update(id=${id})`;
        return this.runWithLoggingAndValidation({
            methodName,
            input: { actor, ...data },
            schema: this.updateSchema,
            execute: async (validData, validActor) => {
                const updateId = id;
                await this._getAndValidateEntity(
                    this.model,
                    updateId,
                    validActor,
                    this.entityName,
                    this._canUpdate.bind(this)
                );

                const normalizedData = this.normalizers?.update
                    ? await this.normalizers.update(validData, validActor)
                    : validData;

                const processedData =
                    tx !== undefined
                        ? await this._beforeUpdate(normalizedData, validActor, tx)
                        : await this._beforeUpdate(normalizedData, validActor);

                const payload = {
                    ...normalizedData,
                    ...processedData,
                    updatedById: validActor.id
                } as unknown as Partial<TEntity>;

                const where = { id: updateId };

                const auditFields = [
                    'updatedById',
                    'createdById',
                    'createdAt',
                    'updatedAt',
                    'deletedAt',
                    'deletedById'
                ];

                const filteredPayload = Object.fromEntries(
                    Object.entries(payload).filter(([_, v]) => v !== undefined)
                ) as Partial<TEntity>;

                const filteredPayloadKeys = Object.keys(filteredPayload).filter(
                    (k) => !auditFields.includes(k)
                );

                const hasValidField = filteredPayloadKeys.length > 0;

                const finalPayload = hasValidField
                    ? filteredPayload
                    : ({ updatedById: validActor.id } as unknown as Partial<TEntity>);

                const updatedEntity =
                    tx !== undefined
                        ? await this.model.update(
                              where as Record<string, unknown>,
                              finalPayload,
                              tx
                          )
                        : await this.model.update(where as Record<string, unknown>, finalPayload);

                if (!updatedEntity) {
                    const entityExists = await this.model.findById(updateId);
                    if (!entityExists) {
                        throw new ServiceError(
                            ServiceErrorCode.NOT_FOUND,
                            `${this.entityName} not found`
                        );
                    }
                    if (filteredPayloadKeys.length === 0) {
                        throw new ServiceError(
                            ServiceErrorCode.VALIDATION_ERROR,
                            'No valid fields provided for update.'
                        );
                    }
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        `Failed to update ${this.entityName} with id ${updateId}. The operation returned no result.`
                    );
                }

                return tx !== undefined
                    ? this._afterUpdate(updatedEntity, validActor, tx)
                    : this._afterUpdate(updatedEntity, validActor);
            }
        });
    }

    /**
     * Soft-deletes an entity by its ID.
     *
     * Marks the entity as deleted by setting `deletedAt` without physical removal.
     * If the entity is already deleted, returns `{ count: 0 }` without error.
     *
     * @param actor - The user or system performing the action.
     * @param id - The ID of the entity to soft-delete.
     * @param tx - Optional transaction client. When provided, the operation participates in the existing transaction.
     * @returns A `ServiceOutput` with the count of affected rows or a `ServiceError`.
     */
    public async softDelete(
        actor: Actor,
        id: string,
        tx?: DrizzleClient
    ): Promise<ServiceOutput<{ count: number }>> {
        const methodName = `softDelete(id=${id})`;
        return this.runWithLoggingAndValidation({
            methodName,
            input: { actor },
            schema: z.object({}),
            execute: async (_, validActor) => {
                const entity = await this._getAndValidateEntity(
                    this.model,
                    id,
                    validActor,
                    this.entityName,
                    this._canSoftDelete.bind(this)
                );
                if ((entity as TEntity).deletedAt) {
                    return { count: 0 };
                }
                const processedId =
                    tx !== undefined
                        ? await this._beforeSoftDelete(id, validActor, tx)
                        : await this._beforeSoftDelete(id, validActor);
                const where = { id: processedId };
                const result = {
                    count:
                        tx !== undefined
                            ? await this.model.softDelete(where as Record<string, unknown>, tx)
                            : await this.model.softDelete(where as Record<string, unknown>)
                };
                return tx !== undefined
                    ? this._afterSoftDelete(result, validActor, tx)
                    : this._afterSoftDelete(result, validActor);
            }
        });
    }

    /**
     * Permanently deletes an entity by its ID from the database.
     *
     * This is an irreversible, destructive operation. Follows the standard lifecycle
     * including permission checks and hooks.
     *
     * @param actor - The user or system performing the action.
     * @param id - The ID of the entity to hard-delete.
     * @returns A `ServiceOutput` with the count of affected rows or a `ServiceError`.
     */
    public async hardDelete(actor: Actor, id: string): Promise<ServiceOutput<{ count: number }>> {
        const methodName = `hardDelete(id=${id})`;
        return this.runWithLoggingAndValidation({
            methodName,
            input: { actor },
            schema: z.object({}),
            execute: async (_, validActor) => {
                const entity = await this._getAndValidateEntity(
                    this.model,
                    id,
                    validActor,
                    this.entityName,
                    this._canHardDelete.bind(this)
                );
                if ((entity as TEntity).deletedAt) {
                    return { count: 0 };
                }
                const processedId = await this._beforeHardDelete(id, validActor);
                const where = { id: processedId };
                // biome-ignore lint/suspicious/noExplicitAny: This is a safe use of any in a generic base class.
                const result = { count: await this.model.hardDelete(where as any) };
                return this._afterHardDelete(result, validActor);
            }
        });
    }

    /**
     * Restores a soft-deleted entity by its ID.
     *
     * Reverses a soft-delete by clearing the `deletedAt` timestamp.
     * If the entity is not deleted, returns `{ count: 0 }` without error.
     *
     * @param actor - The user or system performing the action.
     * @param id - The ID of the entity to restore.
     * @param tx - Optional transaction client. When provided, the operation participates in the existing transaction.
     * @returns A `ServiceOutput` with the count of affected rows or a `ServiceError`.
     */
    public async restore(
        actor: Actor,
        id: string,
        tx?: DrizzleClient
    ): Promise<ServiceOutput<{ count: number }>> {
        const methodName = `restore(id=${id})`;
        return this.runWithLoggingAndValidation({
            methodName,
            input: { actor },
            schema: z.object({}),
            execute: async (_, validActor) => {
                const entity = await this._getAndValidateEntity(
                    this.model,
                    id,
                    validActor,
                    this.entityName,
                    this._canRestore.bind(this)
                );
                if (!(entity as TEntity).deletedAt) {
                    return { count: 0 };
                }
                let processedId: string;
                try {
                    processedId =
                        tx !== undefined
                            ? await this._beforeRestore(id, validActor, tx)
                            : await this._beforeRestore(id, validActor);
                } catch (err) {
                    if (err instanceof ServiceError && err.code === ServiceErrorCode.INTERNAL_ERROR)
                        throw err;
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Error in _beforeRestore hook',
                        err
                    );
                }
                let count: number;
                try {
                    count =
                        tx !== undefined
                            ? await this.model.restore(
                                  { id: processedId } as Record<string, unknown>,
                                  tx
                              )
                            : await this.model.restore({ id: processedId } as Record<
                                  string,
                                  unknown
                              >);
                } catch (err) {
                    if (err instanceof ServiceError && err.code === ServiceErrorCode.INTERNAL_ERROR)
                        throw err;
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Error in model.restore',
                        err
                    );
                }
                const result = { count };
                try {
                    await (tx !== undefined
                        ? this._afterRestore(result, validActor, tx)
                        : this._afterRestore(result, validActor));
                } catch (err) {
                    if (err instanceof ServiceError && err.code === ServiceErrorCode.INTERNAL_ERROR)
                        throw err;
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Error in _afterRestore hook',
                        err
                    );
                }
                return result;
            }
        });
    }

    /**
     * Updates the visibility of a specific entity.
     *
     * Provides a dedicated, permission-controlled endpoint for this common operation.
     *
     * @param actor - The user or system performing the action.
     * @param id - The ID of the entity to update.
     * @param visibility - The new visibility state.
     * @returns A `ServiceOutput` containing the updated entity or a `ServiceError`.
     */
    public async updateVisibility(
        actor: Actor,
        id: string,
        visibility: VisibilityEnum
    ): Promise<ServiceOutput<TEntity>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateVisibility',
            input: { actor, visibility },
            schema: z.object({ visibility: z.nativeEnum(VisibilityEnum) }),
            execute: async (validData, validActor) => {
                const entity = await this._getAndValidateEntity<TEntity, typeof this.model>(
                    this.model,
                    id,
                    validActor,
                    this.entityName,
                    async () => {}
                );
                if (!entity) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `${this.entityName} not found`
                    );
                }
                validateEntity(entity, this.entityName);

                await this._canUpdateVisibility(validActor, entity, validData.visibility);

                let processedVisibility: VisibilityEnum;
                try {
                    processedVisibility = await this._beforeUpdateVisibility(
                        entity,
                        validData.visibility,
                        validActor
                    );
                } catch (err) {
                    if (
                        err instanceof ServiceError &&
                        err.code === ServiceErrorCode.INTERNAL_ERROR
                    ) {
                        throw err;
                    }
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Error in _beforeUpdateVisibility hook',
                        err
                    );
                }

                let updatedEntity: TEntity | null;
                try {
                    updatedEntity = await this.model.update({ id }, {
                        visibility: processedVisibility
                    } as unknown as Partial<TEntity>);
                    if (!updatedEntity) {
                        throw new ServiceError(
                            ServiceErrorCode.INTERNAL_ERROR,
                            `Failed to update ${this.entityName} with id ${id}. The operation returned no result.`
                        );
                    }
                } catch (err) {
                    if (
                        err instanceof ServiceError &&
                        err.code === ServiceErrorCode.INTERNAL_ERROR
                    ) {
                        throw err;
                    }
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Error in model.update',
                        err
                    );
                }

                try {
                    await this._afterUpdateVisibility(updatedEntity, validActor);
                } catch (err) {
                    if (
                        err instanceof ServiceError &&
                        err.code === ServiceErrorCode.INTERNAL_ERROR
                    ) {
                        throw err;
                    }
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Error in _afterUpdateVisibility hook',
                        err
                    );
                }

                return updatedEntity;
            }
        });
    }

    /**
     * Sets the featured status of an entity.
     *
     * Checks current `isFeatured` value and returns `{ updated: false }` if unchanged,
     * avoiding unnecessary database writes.
     *
     * @param input - ServiceInput containing `id` and `isFeatured` flag.
     * @returns `ServiceOutput<{ updated: boolean }>` indicating whether the entity was updated.
     */
    public async setFeaturedStatus(
        input: ServiceInput<{ id: string; isFeatured: boolean }>
    ): Promise<ServiceOutput<{ updated: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: `setFeaturedStatus(id=${input.id}, isFeatured=${input.isFeatured})`,
            input,
            schema: z.object({ id: z.string(), isFeatured: z.boolean() }),
            execute: async (validData, actor) => {
                const entity = await this._getAndValidateEntity(
                    this.model,
                    validData.id,
                    actor,
                    this.entityName,
                    this._canUpdate.bind(this)
                );
                if (!('isFeatured' in entity)) {
                    throw new Error('Entity does not have isFeatured property');
                }
                const isFeatured = (entity as { isFeatured: boolean }).isFeatured;
                if (isFeatured === validData.isFeatured) return { updated: false };
                await this.model.update({ id: validData.id }, {
                    isFeatured: validData.isFeatured
                } as unknown as Partial<TEntity>);
                return { updated: true };
            }
        });
    }
}
