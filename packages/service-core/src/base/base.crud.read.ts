import type { ListRelationsConfig } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import type { ZodObject } from 'zod';
import { z } from 'zod';
import {
    type Actor,
    type BaseModel,
    type PaginatedListOutput,
    ServiceError,
    type ServiceOutput
} from '../types';
import { BaseCrudHooks } from './base.crud.hooks';

/**
 * Abstract base class providing all read/query operations for CRUD services.
 *
 * Includes the following public API methods:
 * - `getByField` - Fetch a single entity by any field/value pair
 * - `getById` - Convenience wrapper for `getByField('id', ...)`
 * - `getBySlug` - Convenience wrapper for `getByField('slug', ...)`
 * - `getByName` - Convenience wrapper for `getByField('name', ...)`
 * - `list` - Paginated listing with optional filtering, sorting, and relations
 * - `search` - Full search with filters and pagination (delegates to `_executeSearch`)
 * - `count` - Count entities matching criteria (delegates to `_executeCount`)
 *
 * @template TEntity - The primary entity type this service manages.
 * @template TModel - The Drizzle ORM model type for the entity.
 * @template TCreateSchema - The Zod schema for validating entity creation input.
 * @template TUpdateSchema - The Zod schema for validating entity update input.
 * @template TSearchSchema - The Zod schema for validating entity search input.
 */
export abstract class BaseCrudRead<
    TEntity extends { id: string; deletedAt?: Date | null },
    TModel extends BaseModel<TEntity>,
    TCreateSchema extends ZodObject,
    TUpdateSchema extends ZodObject,
    TSearchSchema extends ZodObject
> extends BaseCrudHooks<TEntity, TModel, TCreateSchema, TUpdateSchema, TSearchSchema> {
    /**
     * Fetches a single entity by a specific field and value.
     *
     * Lifecycle steps:
     * 1. **Normalization**: Applies `view` normalizer to the field/value pair.
     * 2. **beforeGetByField Hook**: Allows pre-processing of query parameters.
     * 3. **Database Operation**: Fetches the entity from the database.
     * 4. **Permissions**: Calls `_canView` hook if an entity is found.
     * 5. **afterGetByField Hook**: Allows post-processing of the fetched entity.
     *
     * @note Returns a NOT_FOUND ServiceError if the entity is not found.
     *
     * @param actor - The user or system performing the action.
     * @param field - The database field to search by (e.g., `'id'`, `'slug'`).
     * @param value - The value to match for the given field.
     * @returns A `ServiceOutput` containing the found entity or a `ServiceError`.
     */
    public async getByField(
        actor: Actor,
        field: string,
        value: unknown
    ): Promise<ServiceOutput<TEntity | null>> {
        const methodName = `getByField(field=${field}, value=${value})`;
        return this.runWithLoggingAndValidation({
            methodName,
            input: { actor, field, value },
            schema: z.object({ field: z.string(), value: z.unknown() }),
            execute: async ({ field: validatedField, value: validatedValue }, validatedActor) => {
                const normalized = (await this.normalizers?.view?.(
                    validatedField,
                    validatedValue,
                    validatedActor
                )) ?? { field: validatedField, value: validatedValue };

                const processed = await this._beforeGetByField(
                    normalized.field,
                    normalized.value,
                    validatedActor
                );

                const where = { [processed.field]: processed.value };
                // biome-ignore lint/suspicious/noExplicitAny: The computed property is not fully recognized by TypeScript
                const entity = await this.model.findOne(where as any);

                if (!entity) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `${this.entityName} not found`
                    );
                }

                await this._canView(validatedActor, entity as TEntity);

                return await this._afterGetByField(entity as TEntity, validatedActor);
            }
        });
    }

    /**
     * Retrieves an entity by its unique ID. A convenience wrapper around `getByField`.
     *
     * @param actor - The user performing the action.
     * @param id - The ID of the entity.
     * @returns A `ServiceOutput` containing the entity or a `ServiceError`.
     */
    public async getById(actor: Actor, id: string): Promise<ServiceOutput<TEntity | null>> {
        return this.getByField(actor, 'id', id);
    }

    /**
     * Retrieves an entity by its unique slug. A convenience wrapper around `getByField`.
     *
     * @param actor - The user performing the action.
     * @param slug - The slug of the entity.
     * @returns A `ServiceOutput` containing the entity or a `ServiceError`.
     */
    public async getBySlug(actor: Actor, slug: string): Promise<ServiceOutput<TEntity | null>> {
        return this.getByField(actor, 'slug', slug);
    }

    /**
     * Retrieves an entity by its name. A convenience wrapper around `getByField`.
     *
     * @param actor - The user performing the action.
     * @param name - The name of the entity.
     * @returns A `ServiceOutput` containing the entity or a `ServiceError`.
     */
    public async getByName(actor: Actor, name: string): Promise<ServiceOutput<TEntity | null>> {
        return this.getByField(actor, 'name', name);
    }

    /**
     * Fetches a paginated list of all entities.
     *
     * Lifecycle steps:
     * 1. **Permissions**: Calls `_canList` to verify the actor may list entities.
     * 2. **Normalization**: Applies the `list` normalizer if defined.
     * 3. **beforeList Hook**: Allows pre-processing of list options.
     * 4. **Database Operation**: Executes `findAllWithRelations` or `findAll`.
     * 5. **afterList Hook**: Allows post-processing of the result set.
     *
     * @param actor - The user or system performing the action.
     * @param options - Pagination, search, relations, filtering, and sorting options.
     * @returns A `ServiceOutput` containing the paginated list or a `ServiceError`.
     */
    public async list(
        actor: Actor,
        options: {
            page?: number;
            pageSize?: number;
            search?: string;
            relations?: ListRelationsConfig;
            where?: Record<string, unknown>;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
        } = {}
    ): Promise<ServiceOutput<PaginatedListOutput<TEntity>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'list',
            input: { actor, ...options },
            schema: z.object({
                page: z.number().optional(),
                pageSize: z.number().optional(),
                search: z.string().max(200).optional(),
                relations: z
                    .record(z.string(), z.union([z.boolean(), z.record(z.string(), z.unknown())]))
                    .optional(),
                where: z.record(z.string(), z.unknown()).optional(),
                sortBy: z.string().optional(),
                sortOrder: z.enum(['asc', 'desc']).optional()
            }),
            execute: async (validatedOptions, validatedActor) => {
                await this._canList(validatedActor);

                const normalized =
                    (await this.normalizers?.list?.(validatedOptions, validatedActor)) ??
                    validatedOptions;
                const processedOptions = await this._beforeList(normalized, validatedActor);

                const relationsToUse = processedOptions.relations ?? this.getDefaultListRelations();
                const whereClause =
                    ((processedOptions as Record<string, unknown>).where as
                        | Record<string, unknown>
                        | undefined) ?? {};

                const search = (processedOptions as Record<string, unknown>).search as
                    | string
                    | undefined;
                if (search && search.trim().length > 0) {
                    const searchColumns = this.getSearchableColumns();
                    for (const col of searchColumns) {
                        whereClause[`${col}_like`] = search.trim();
                    }
                }

                const sortBy = (processedOptions as Record<string, unknown>).sortBy as
                    | string
                    | undefined;
                const sortOrder = (processedOptions as Record<string, unknown>).sortOrder as
                    | 'asc'
                    | 'desc'
                    | undefined;

                const result = relationsToUse
                    ? await this.model.findAllWithRelations(relationsToUse, whereClause, {
                          page: processedOptions.page,
                          pageSize: processedOptions.pageSize,
                          sortBy,
                          sortOrder
                      })
                    : await this.model.findAll(whereClause, {
                          page: processedOptions.page,
                          pageSize: processedOptions.pageSize,
                          sortBy,
                          sortOrder
                      });

                return this._afterList(result, validatedActor);
            }
        });
    }

    /**
     * Performs a search for entities based on a set of criteria.
     *
     * Lifecycle steps:
     * 1. **Validation**: Validates params against `searchSchema`.
     * 2. **Permissions**: Calls `_canSearch`.
     * 3. **Normalization**: Applies the `search` normalizer if defined.
     * 4. **beforeSearch Hook**: Allows pre-processing of search parameters.
     * 5. **Database Operation**: Delegates to `_executeSearch`.
     * 6. **afterSearch Hook**: Allows post-processing of the result.
     *
     * @param actor - The user or system performing the action.
     * @param params - The search parameters, including filters, sorting, and pagination.
     * @returns A `ServiceOutput` containing a paginated list or a `ServiceError`.
     */
    public async search(
        actor: Actor,
        params: z.infer<TSearchSchema>
    ): Promise<ServiceOutput<PaginatedListOutput<TEntity>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'search',
            input: { actor, ...params },
            schema: this.searchSchema,
            execute: async (validParams, validActor) => {
                await this._canSearch(validActor);

                const normalizedParams = this.normalizers?.search
                    ? await this.normalizers.search(validParams, validActor)
                    : validParams;

                const processedParams = await this._beforeSearch(normalizedParams, validActor);
                const result = await this._executeSearch(processedParams, validActor);
                return this._afterSearch(result, validActor);
            }
        });
    }

    /**
     * Counts entities based on a set of criteria.
     *
     * Lifecycle steps:
     * 1. **Validation**: Validates params against `searchSchema`.
     * 2. **Permissions**: Calls `_canCount`.
     * 3. **beforeCount Hook**: Allows pre-processing of count parameters.
     * 4. **Database Operation**: Delegates to `_executeCount`.
     * 5. **afterCount Hook**: Allows post-processing of the count result.
     *
     * @param actor - The user or system performing the action.
     * @param params - The search parameters (only filters are used for counting).
     * @returns A `ServiceOutput` containing the total count or a `ServiceError`.
     */
    public async count(
        actor: Actor,
        params: z.infer<TSearchSchema>
    ): Promise<ServiceOutput<{ count: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'count',
            input: { actor, ...params },
            schema: this.searchSchema,
            execute: async (validParams, validActor) => {
                await this._canCount(validActor);
                const processedParams = await this._beforeCount(validParams, validActor);
                const result = await this._executeCount(processedParams, validActor);
                return this._afterCount(result, validActor);
            }
        });
    }
}
