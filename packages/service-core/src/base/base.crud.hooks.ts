import type { DrizzleClient } from '@repo/db';
import type { VisibilityEnum } from '@repo/schemas';
import type { ZodObject } from 'zod';
import type { z } from 'zod';
import type { Actor, BaseModel, ListOptions, PaginatedListOutput } from '../types';
import { BaseCrudPermissions } from './base.crud.permissions';

/**
 * Abstract base class providing default lifecycle hook implementations for CRUD operations.
 *
 * Each hook has a sensible no-op default that simply returns the input unchanged.
 * Concrete services can override individual hooks to add custom behavior such as
 * cache invalidation, audit logging, data transformations, or side effects.
 *
 * The hooks are organized in before/after pairs for each CRUD operation:
 * - `_beforeCreate` / `_afterCreate`
 * - `_beforeUpdate` / `_afterUpdate`
 * - `_beforeGetByField` / `_afterGetByField`
 * - `_beforeList` / `_afterList`
 * - `_beforeSoftDelete` / `_afterSoftDelete`
 * - `_beforeHardDelete` / `_afterHardDelete`
 * - `_beforeRestore` / `_afterRestore`
 * - `_beforeSearch` / `_afterSearch`
 * - `_beforeCount` / `_afterCount`
 * - `_beforeUpdateVisibility` / `_afterUpdateVisibility`
 *
 * @template TEntity - The primary entity type this service manages.
 * @template TModel - The Drizzle ORM model type for the entity.
 * @template TCreateSchema - The Zod schema for validating entity creation input.
 * @template TUpdateSchema - The Zod schema for validating entity update input.
 * @template TSearchSchema - The Zod schema for validating entity search input.
 */
export abstract class BaseCrudHooks<
    TEntity extends { id: string; deletedAt?: Date | null },
    TModel extends BaseModel<TEntity>,
    TCreateSchema extends ZodObject,
    TUpdateSchema extends ZodObject,
    TSearchSchema extends ZodObject
> extends BaseCrudPermissions<TEntity, TModel, TCreateSchema, TUpdateSchema, TSearchSchema> {
    /**
     * Lifecycle hook executed after data normalization but before the `create` operation.
     * Override to add custom pre-insert logic (e.g., hashing passwords, generating slugs).
     *
     * @param data - The normalized data for the new entity.
     * @param _actor - The user or system performing the action.
     * @param _tx - Optional transaction client. When provided, hook runs within the transaction.
     * @returns A partial entity object with the processed data to merge before insertion.
     */
    protected async _beforeCreate(
        data: z.infer<TCreateSchema>,
        _actor: Actor,
        _tx?: DrizzleClient
    ): Promise<Partial<TEntity>> {
        return data as Partial<TEntity>;
    }

    /**
     * Lifecycle hook executed after an entity has been successfully created.
     * Override to perform side effects (e.g., notifications, audit trails).
     *
     * @param entity - The newly created entity.
     * @param _actor - The user or system performing the action.
     * @param _tx - Optional transaction client. When provided, hook runs within the transaction.
     * @returns The created entity, allowing for final modifications if needed.
     */
    protected async _afterCreate(
        entity: TEntity,
        _actor: Actor,
        _tx?: DrizzleClient
    ): Promise<TEntity> {
        return entity;
    }

    /**
     * Lifecycle hook executed after data normalization but before the `update` operation.
     * Override to add custom pre-update logic (e.g., field transformations).
     *
     * @param data - The normalized update data.
     * @param _actor - The user or system performing the action.
     * @param _tx - Optional transaction client. When provided, hook runs within the transaction.
     * @returns A partial entity object with the processed data to merge before the update.
     */
    protected async _beforeUpdate(
        data: z.infer<TUpdateSchema>,
        _actor: Actor,
        _tx?: DrizzleClient
    ): Promise<Partial<TEntity>> {
        return data as Partial<TEntity>;
    }

    /**
     * Lifecycle hook executed after an entity has been successfully updated.
     * Override to perform side effects (e.g., cache invalidation, notifications).
     *
     * @param entity - The updated entity.
     * @param _actor - The user or system performing the action.
     * @param _tx - Optional transaction client. When provided, hook runs within the transaction.
     * @returns The updated entity.
     */
    protected async _afterUpdate(
        entity: TEntity,
        _actor: Actor,
        _tx?: DrizzleClient
    ): Promise<TEntity> {
        return entity;
    }

    /**
     * Lifecycle hook executed after data normalization but before fetching an entity.
     * Override to modify query parameters before the database is hit.
     *
     * @param field - The field to query by.
     * @param value - The value to match.
     * @param _actor - The user or system performing the action.
     * @returns An object with the (potentially modified) field and value.
     */
    protected async _beforeGetByField(
        field: string,
        value: unknown,
        _actor: Actor
    ): Promise<{ field: string; value: unknown }> {
        return { field, value };
    }

    /**
     * Lifecycle hook executed after an entity has been fetched.
     *
     * @param entity - The fetched entity, or null if not found.
     * @param _actor - The user or system performing the action.
     * @returns The fetched entity or null.
     */
    protected async _afterGetByField(
        entity: TEntity | null,
        _actor: Actor
    ): Promise<TEntity | null> {
        return entity;
    }

    /**
     * Lifecycle hook executed after normalization but before listing entities.
     * Override to transform list options before the database query.
     *
     * @param options - The pagination and relations options for the query.
     * @param _actor - The user or system performing the action.
     * @returns The processed options.
     */
    protected async _beforeList(options: ListOptions, _actor: Actor): Promise<ListOptions> {
        return options;
    }

    /**
     * Lifecycle hook executed after a list of entities has been fetched.
     * Override to transform or augment the result set.
     *
     * @param result - The paginated list of entities.
     * @param _actor - The user or system performing the action.
     * @returns The paginated list of entities.
     */
    protected async _afterList(
        result: PaginatedListOutput<TEntity>,
        _actor: Actor
    ): Promise<PaginatedListOutput<TEntity>> {
        return result;
    }

    /**
     * Lifecycle hook executed before an entity is soft-deleted.
     *
     * @param id - The ID of the entity to soft-delete.
     * @param _actor - The user or system performing the action.
     * @param _tx - Optional transaction client. When provided, hook runs within the transaction.
     * @returns The ID of the entity.
     */
    protected async _beforeSoftDelete(
        id: string,
        _actor: Actor,
        _tx?: DrizzleClient
    ): Promise<string> {
        return id;
    }

    /**
     * Lifecycle hook executed after an entity is soft-deleted.
     *
     * @param result - An object containing the count of affected rows.
     * @param _actor - The user or system performing the action.
     * @param _tx - Optional transaction client. When provided, hook runs within the transaction.
     * @returns The result object.
     */
    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor,
        _tx?: DrizzleClient
    ): Promise<{ count: number }> {
        return result;
    }

    /**
     * Lifecycle hook executed before an entity is permanently deleted.
     *
     * @param id - The ID of the entity to hard-delete.
     * @param _actor - The user or system performing the action.
     * @param _tx - Optional transaction client. When provided, hook runs within the transaction.
     * @returns The ID of the entity.
     */
    protected async _beforeHardDelete(
        id: string,
        _actor: Actor,
        _tx?: DrizzleClient
    ): Promise<string> {
        return id;
    }

    /**
     * Lifecycle hook executed after an entity is permanently deleted.
     *
     * @param result - An object containing the count of affected rows.
     * @param _actor - The user or system performing the action.
     * @param _tx - Optional transaction client. When provided, hook runs within the transaction.
     * @returns The result object.
     */
    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor,
        _tx?: DrizzleClient
    ): Promise<{ count: number }> {
        return result;
    }

    /**
     * Lifecycle hook executed before an entity is restored.
     *
     * @param id - The ID of the entity to restore.
     * @param _actor - The user or system performing the action.
     * @param _tx - Optional transaction client. When provided, hook runs within the transaction.
     * @returns The ID of the entity.
     */
    protected async _beforeRestore(
        id: string,
        _actor: Actor,
        _tx?: DrizzleClient
    ): Promise<string> {
        return id;
    }

    /**
     * Lifecycle hook executed after an entity is restored.
     *
     * @param result - An object containing the count of affected rows.
     * @param _actor - The user or system performing the action.
     * @param _tx - Optional transaction client. When provided, hook runs within the transaction.
     * @returns The result object.
     */
    protected async _afterRestore(
        result: { count: number },
        _actor: Actor,
        _tx?: DrizzleClient
    ): Promise<{ count: number }> {
        return result;
    }

    /**
     * Lifecycle hook executed before searching for entities.
     * Override to transform or augment search parameters.
     *
     * @param params - The search parameters.
     * @param _actor - The user or system performing the action.
     * @returns The processed search parameters.
     */
    protected async _beforeSearch(
        params: z.infer<TSearchSchema>,
        _actor: Actor
    ): Promise<z.infer<TSearchSchema>> {
        return params;
    }

    /**
     * Lifecycle hook executed after a search has been performed.
     * Override to transform or augment the search result.
     *
     * @param result - The paginated list of found entities.
     * @param _actor - The user or system performing the action.
     * @returns The paginated list of entities.
     */
    protected async _afterSearch(
        result: PaginatedListOutput<TEntity>,
        _actor: Actor
    ): Promise<PaginatedListOutput<TEntity>> {
        return result;
    }

    /**
     * Lifecycle hook executed before counting entities.
     * Override to transform filter parameters before the count query.
     *
     * @param params - The search parameters (only filters are typically used).
     * @param _actor - The user or system performing the action.
     * @returns The processed parameters.
     */
    protected async _beforeCount(
        params: z.infer<TSearchSchema>,
        _actor: Actor
    ): Promise<z.infer<TSearchSchema>> {
        return params;
    }

    /**
     * Lifecycle hook executed after a count has been performed.
     *
     * @param result - The count result.
     * @param _actor - The user or system performing the action.
     * @returns The count result.
     */
    protected async _afterCount(
        result: { count: number },
        _actor: Actor
    ): Promise<{ count: number }> {
        return result;
    }

    /**
     * Lifecycle hook executed before updating an entity's visibility.
     *
     * @param _entity - The entity being updated.
     * @param newVisibility - The new visibility state.
     * @param _actor - The user or system performing the action.
     * @returns The new visibility state.
     */
    protected async _beforeUpdateVisibility(
        _entity: TEntity,
        newVisibility: VisibilityEnum,
        _actor: Actor
    ): Promise<VisibilityEnum> {
        return newVisibility;
    }

    /**
     * Lifecycle hook executed after updating an entity's visibility.
     *
     * @param entity - The updated entity.
     * @param _actor - The user or system performing the action.
     * @returns The updated entity.
     */
    protected async _afterUpdateVisibility(entity: TEntity, _actor: Actor): Promise<TEntity> {
        return entity;
    }
}
