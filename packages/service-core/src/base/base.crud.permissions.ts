import type { VisibilityEnum } from '@repo/schemas';
import type { ZodObject } from 'zod';
import type { z } from 'zod';
import type { Actor, BaseModel, PaginatedListOutput, ServiceContext } from '../types';
import type { CrudNormalizersFromSchemas } from './base.crud.types';
import { BaseService } from './base.service';

/**
 * Abstract base class containing all permission hook declarations for CRUD services.
 *
 * This class defines the contract for permission checks that concrete services must implement.
 * Each method corresponds to a specific CRUD operation and is called before the operation executes.
 *
 * Consumers should not extend this class directly. Extend `BaseCrudService` instead.
 *
 * @template TEntity - The primary entity type this service manages.
 * @template TModel - The Drizzle ORM model type for the entity.
 * @template TCreateSchema - The Zod schema for validating entity creation input.
 * @template TUpdateSchema - The Zod schema for validating entity update input.
 * @template TSearchSchema - The Zod schema for validating entity search input.
 */
export abstract class BaseCrudPermissions<
    TEntity extends { id: string; deletedAt?: Date | null },
    TModel extends BaseModel<TEntity>,
    TCreateSchema extends ZodObject,
    TUpdateSchema extends ZodObject,
    TSearchSchema extends ZodObject
> extends BaseService<CrudNormalizersFromSchemas<TCreateSchema, TUpdateSchema, TSearchSchema>> {
    /** The Drizzle ORM model instance for database operations. */
    protected abstract readonly model: TModel;

    /** Zod schema for validating the input of the `create` method. */
    protected abstract readonly createSchema: TCreateSchema;

    /** Zod schema for validating the input of the `update` method. */
    protected abstract readonly updateSchema: TUpdateSchema;

    /** Zod schema for validating the input of the `search` method. */
    protected abstract readonly searchSchema: TSearchSchema;

    /**
     * Default relations configuration for list operations.
     * Concrete services can override to specify which relations should be included by default.
     * @returns Relations configuration object or undefined for no relations
     */
    protected abstract getDefaultListRelations(): import('@repo/schemas').ListRelationsConfig;

    /**
     * Returns column names to search against when the `search` query param is provided.
     * @returns Array of column names to apply ILIKE search on
     */
    protected getSearchableColumns(): string[] {
        return ['name'];
    }

    protected declare normalizers?: CrudNormalizersFromSchemas<
        TCreateSchema,
        TUpdateSchema,
        TSearchSchema
    >;

    // biome-ignore lint/complexity/noUselessConstructor: required for proper prototype chain
    constructor(ctx: ServiceContext, entityName: string) {
        super(ctx, entityName);
    }

    // --- Abstract Permission Hooks ---

    /**
     * Checks if the actor has permission to create an entity with the given data.
     * Should throw a `ServiceError` with `FORBIDDEN` code if permission is denied.
     *
     * @param actor - The user or system performing the action.
     * @param data - The validated input data for the new entity.
     * @throws {ServiceError} If the permission check fails.
     */
    protected abstract _canCreate(actor: Actor, data: z.infer<TCreateSchema>): Promise<void> | void;

    /**
     * Checks if the actor has permission to update a given entity.
     * Should throw a `ServiceError` with `FORBIDDEN` code if permission is denied.
     *
     * @param actor - The user or system performing the action.
     * @param entity - The entity that is about to be updated.
     * @throws {ServiceError} If the permission check fails.
     */
    protected abstract _canUpdate(actor: Actor, entity: TEntity): Promise<void> | void;

    /**
     * Checks if the actor has permission to soft-delete an entity.
     * Should throw a `ServiceError` with `FORBIDDEN` code if permission is denied.
     *
     * @param actor - The user or system performing the action.
     * @param entity - The entity that is about to be soft-deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected abstract _canSoftDelete(actor: Actor, entity: TEntity): Promise<void> | void;

    /**
     * Checks if the actor has permission to permanently delete an entity.
     * Should throw a `ServiceError` with `FORBIDDEN` code if permission is denied.
     *
     * @param actor - The user or system performing the action.
     * @param entity - The entity that is about to be hard-deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected abstract _canHardDelete(actor: Actor, entity: TEntity): Promise<void> | void;

    /**
     * Checks if the actor has permission to restore a soft-deleted entity.
     * Should throw a `ServiceError` with `FORBIDDEN` code if permission is denied.
     *
     * @param actor - The user or system performing the action.
     * @param entity - The entity that is about to be restored.
     * @throws {ServiceError} If the permission check fails.
     */
    protected abstract _canRestore(actor: Actor, entity: TEntity): Promise<void> | void;

    /**
     * Checks if the actor has permission to view a specific entity.
     * Should throw a `ServiceError` with `FORBIDDEN` code if permission is denied.
     *
     * @param actor - The user or system performing the action.
     * @param entity - The entity that has been fetched.
     * @throws {ServiceError} If the permission check fails.
     */
    protected abstract _canView(actor: Actor, entity: TEntity): Promise<void> | void;

    /**
     * Checks if the actor has permission to list entities.
     * Should throw a `ServiceError` with `FORBIDDEN` code if permission is denied.
     *
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected abstract _canList(actor: Actor): Promise<void> | void;

    /**
     * Checks if the actor has permission to search for entities.
     * Should throw a `ServiceError` with `FORBIDDEN` code if permission is denied.
     *
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected abstract _canSearch(actor: Actor): Promise<void> | void;

    /**
     * Checks if the actor has permission to count entities.
     * Should throw a `ServiceError` with `FORBIDDEN` code if permission is denied.
     *
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected abstract _canCount(actor: Actor): Promise<void> | void;

    /**
     * Checks if an actor can update the visibility of a specific entity.
     * Should throw a `ServiceError` with `FORBIDDEN` code if permission is denied.
     *
     * @param actor - The user or system performing the action.
     * @param entity - The entity being updated.
     * @param newVisibility - The new visibility state being applied.
     * @throws {ServiceError} If the permission check fails.
     */
    protected abstract _canUpdateVisibility(
        actor: Actor,
        entity: TEntity,
        newVisibility: VisibilityEnum
    ): Promise<void> | void;

    // --- Abstract Core Logic Methods ---

    /**
     * Abstract method to execute the actual search query.
     * Responsible for translating validated search parameters into a database query.
     *
     * @param params - The validated and processed search parameters.
     * @param actor - The user or system performing the action.
     * @returns A paginated list of entities matching the search criteria.
     */
    protected abstract _executeSearch(
        params: z.infer<TSearchSchema>,
        actor: Actor
    ): Promise<PaginatedListOutput<TEntity>>;

    /**
     * Abstract method to execute the count query.
     *
     * @param params - The validated search parameters (filters).
     * @param actor - The user or system performing the action.
     * @returns The total count of entities matching the criteria.
     */
    protected abstract _executeCount(
        params: z.infer<TSearchSchema>,
        actor: Actor
    ): Promise<{ count: number }>;
}
