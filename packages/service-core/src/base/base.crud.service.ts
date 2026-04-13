import type { ZodObject } from 'zod';
import type { ServiceConfig } from '../types';
import type { BaseModel } from '../types';
import { BaseCrudAdmin } from './base.crud.admin';

/**
 * Abstract base class for all CRUD services in the Hospeda platform.
 *
 * Provides a standardized structure for request processing, including logging,
 * validation, normalization, permission checks, and error handling via a
 * composed mixin chain. Each concrete service must extend this class and
 * implement its abstract properties and methods.
 *
 * ## Inheritance Chain
 * ```
 * BaseService
 *   -> BaseCrudPermissions  (permission hook declarations + abstract schemas/model)
 *     -> BaseCrudHooks      (default no-op lifecycle hooks)
 *       -> BaseCrudRead     (getByField, getById, getBySlug, getByName, list, search, count)
 *         -> BaseCrudWrite  (create, update, softDelete, hardDelete, restore, updateVisibility, setFeaturedStatus)
 *           -> BaseCrudAdmin (getAdminInfo, setAdminInfo)
 *             -> BaseCrudService (public entry point - this class)
 * ```
 *
 * ## Public API Surface
 * All methods below are inherited from the mixin chain:
 *
 * ### Read Operations (BaseCrudRead)
 * - `getByField(actor, field, value)` - Fetch a single entity by any field/value pair
 * - `getById(actor, id)` - Convenience wrapper for `getByField('id', ...)`
 * - `getBySlug(actor, slug)` - Convenience wrapper for `getByField('slug', ...)`
 * - `getByName(actor, name)` - Convenience wrapper for `getByField('name', ...)`
 * - `list(actor, options)` - Paginated listing with optional filtering, sorting, and relations
 * - `search(actor, params)` - Full search with filters and pagination
 * - `count(actor, params)` - Count entities matching criteria
 *
 * ### Write Operations (BaseCrudWrite)
 * - `create(actor, data)` - Insert a new entity with full lifecycle pipeline
 * - `update(actor, id, data)` - Update an existing entity by ID
 * - `softDelete(actor, id)` - Mark an entity as deleted (reversible)
 * - `hardDelete(actor, id)` - Permanently remove an entity from the database
 * - `restore(actor, id)` - Reverse a soft-delete
 * - `updateVisibility(actor, id, visibility)` - Change the visibility state of an entity
 * - `setFeaturedStatus(input)` - Toggle the featured flag on an entity
 *
 * ### Admin Operations (BaseCrudAdmin)
 * - `getAdminInfo(input)` - Retrieve admin-only metadata for an entity
 * - `setAdminInfo(input)` - Set admin-only metadata for an entity
 *
 * ## Abstract Members to Implement
 * Concrete services must implement:
 * - `model` - The Drizzle ORM model instance
 * - `createSchema` - Zod schema for create input validation
 * - `updateSchema` - Zod schema for update input validation
 * - `searchSchema` - Zod schema for search input validation
 * - `getDefaultListRelations()` - Default relations for list queries
 * - `_canCreate(actor, data)` - Permission check for create
 * - `_canUpdate(actor, entity)` - Permission check for update
 * - `_canSoftDelete(actor, entity)` - Permission check for soft-delete
 * - `_canHardDelete(actor, entity)` - Permission check for hard-delete
 * - `_canRestore(actor, entity)` - Permission check for restore
 * - `_canView(actor, entity)` - Permission check for view
 * - `_canList(actor)` - Permission check for list
 * - `_canSearch(actor)` - Permission check for search
 * - `_canCount(actor)` - Permission check for count
 * - `_canUpdateVisibility(actor, entity, newVisibility)` - Permission check for visibility update
 * - `_executeSearch(params, actor)` - Execute the actual search database query
 * - `_executeCount(params, actor)` - Execute the actual count database query
 *
 * @template TEntity - The primary entity type this service manages (e.g., `AccommodationType`).
 * @template TModel - The Drizzle ORM model type for the entity (e.g., `AccommodationModel`).
 * @template TCreateSchema - The Zod schema for validating entity creation input.
 * @template TUpdateSchema - The Zod schema for validating entity update input.
 * @template TSearchSchema - The Zod schema for validating entity search input.
 *
 * @example
 * ```ts
 * export class AccommodationService extends BaseCrudService<
 *   AccommodationType,
 *   AccommodationModel,
 *   typeof createAccommodationSchema,
 *   typeof updateAccommodationSchema,
 *   typeof searchAccommodationSchema
 * > {
 *   protected readonly model = new AccommodationModel(db);
 *   protected readonly createSchema = createAccommodationSchema;
 *   protected readonly updateSchema = updateAccommodationSchema;
 *   protected readonly searchSchema = searchAccommodationSchema;
 *
 *   protected getDefaultListRelations() { return { destination: true }; }
 *
 *   protected async _canCreate(actor: Actor) { ... }
 *   // ... implement remaining abstract members
 * }
 * ```
 */
export abstract class BaseCrudService<
    TEntity extends { id: string; deletedAt?: Date | null },
    TModel extends BaseModel<TEntity>,
    TCreateSchema extends ZodObject,
    TUpdateSchema extends ZodObject,
    TSearchSchema extends ZodObject
> extends BaseCrudAdmin<TEntity, TModel, TCreateSchema, TUpdateSchema, TSearchSchema> {
    /**
     * Initializes a new instance of the BaseCrudService.
     *
     * @param ctx - The service context, containing the logger and other dependencies.
     * @param entityName - The name of the entity, used for logging and error messages.
     */
    // biome-ignore lint/complexity/noUselessConstructor: Required to document constructor params and maintain the public API surface.
    constructor(config: ServiceConfig, entityName: string) {
        super(config, entityName);
    }
}
