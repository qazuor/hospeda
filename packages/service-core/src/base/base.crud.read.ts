import { buildSearchCondition } from '@repo/db';
import { ServiceErrorCode, parseAdminSort } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import type { ZodObject } from 'zod';
import { z } from 'zod';
import {
    type Actor,
    type AdminSearchExecuteParams,
    type BaseModel,
    type ListOptions,
    type PaginatedListOutput,
    type ServiceContext,
    ServiceError,
    type ServiceOutput,
    listOptionsSchema
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
 * - `adminList` - Admin list with standardized filtering, sorting, and pagination (delegates to `_executeAdminSearch`)
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
     * ## Relation Type Note
     *
     * The return type is `ServiceOutput<TEntity | null>` where `TEntity` is the flat database
     * entity type. At runtime, when relations are loaded via `getDefaultGetByIdRelations()`, the
     * returned object WILL contain relation objects (e.g., `destination`, `amenities`), but these
     * are not reflected in `TEntity`.
     *
     * This is by design: the service layer is relation-agnostic at the type level. Type safety
     * for relation fields is enforced at the API boundary, where routes validate responses against
     * access schemas from `@repo/schemas` (e.g., `AccommodationPublicSchema`,
     * `PostProtectedSchema`). Consumers needing typed access to relation fields should use
     * `z.infer<typeof AccessSchema>` from the appropriate access schema.
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
        value: unknown,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TEntity | null>> {
        const methodName = `getByField(field=${field}, value=${value})`;
        const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };
        return this.runWithLoggingAndValidation({
            methodName,
            input: { actor, field, value },
            schema: z.object({ field: z.string(), value: z.unknown() }),
            ctx: resolvedCtx,
            execute: async (
                { field: validatedField, value: validatedValue },
                validatedActor,
                execCtx
            ) => {
                const normalized = (await this.normalizers?.view?.(
                    validatedField,
                    validatedValue,
                    validatedActor
                )) ?? { field: validatedField, value: validatedValue };

                const processed = await this._beforeGetByField(
                    normalized.field,
                    normalized.value,
                    validatedActor,
                    execCtx
                );

                const where = { [processed.field]: processed.value };
                const relations = this.getDefaultGetByIdRelations();
                // biome-ignore lint/suspicious/noExplicitAny: computed property key is not recognized by TypeScript
                const typedWhere = where as any;
                const entity = relations
                    ? await this.model.findOneWithRelations(typedWhere, relations, execCtx?.tx)
                    : await this.model.findOne(typedWhere, execCtx?.tx);

                if (!entity) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `${this.entityName} not found`
                    );
                }

                await this._canView(validatedActor, entity as TEntity);

                return await this._afterGetByField(entity as TEntity, validatedActor, execCtx);
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
    public async getById(
        actor: Actor,
        id: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TEntity | null>> {
        return this.getByField(actor, 'id', id, ctx);
    }

    /**
     * Retrieves an entity by its unique slug. A convenience wrapper around `getByField`.
     *
     * @param actor - The user performing the action.
     * @param slug - The slug of the entity.
     * @returns A `ServiceOutput` containing the entity or a `ServiceError`.
     */
    public async getBySlug(
        actor: Actor,
        slug: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TEntity | null>> {
        return this.getByField(actor, 'slug', slug, ctx);
    }

    /**
     * Retrieves an entity by its name. A convenience wrapper around `getByField`.
     *
     * @param actor - The user performing the action.
     * @param name - The name of the entity.
     * @returns A `ServiceOutput` containing the entity or a `ServiceError`.
     */
    public async getByName(
        actor: Actor,
        name: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TEntity | null>> {
        return this.getByField(actor, 'name', name, ctx);
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
     * ## Relation Type Note
     *
     * The return type is `ServiceOutput<PaginatedListOutput<TEntity>>` where `TEntity` is the
     * flat database entity type. At runtime, when relations are loaded via
     * `getDefaultListRelations()`, each item in the result WILL contain relation objects (e.g.,
     * `destination`, `author`), but these are not reflected in `TEntity`.
     *
     * This is by design: the service layer is relation-agnostic at the type level. Type safety
     * for relation fields is enforced at the API boundary, where routes validate responses against
     * access schemas from `@repo/schemas` (e.g., `AccommodationPublicSchema`,
     * `PostProtectedSchema`). Consumers needing typed access to relation fields should use
     * `z.infer<typeof AccessSchema>` from the appropriate access schema.
     *
     * @param actor - The user or system performing the action.
     * @param options - Pagination, search, relations, filtering, and sorting options.
     * @returns A `ServiceOutput` containing the paginated list or a `ServiceError`.
     */
    public async list(
        actor: Actor,
        options: ListOptions = {},
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PaginatedListOutput<TEntity>>> {
        const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };
        return this.runWithLoggingAndValidation({
            methodName: 'list',
            input: { actor, ...options },
            schema: listOptionsSchema,
            ctx: resolvedCtx,
            execute: async (validatedOptions, validatedActor, execCtx) => {
                await this._canList(validatedActor);

                const normalized =
                    (await this.normalizers?.list?.(validatedOptions, validatedActor)) ??
                    validatedOptions;
                const processedOptions = await this._beforeList(
                    normalized,
                    validatedActor,
                    execCtx
                );

                // Defensive guard: validate that _beforeList returned valid ListOptions
                const guardResult = listOptionsSchema.safeParse(processedOptions);
                if (!guardResult.success) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        `_beforeList returned invalid options: ${guardResult.error.message}`
                    );
                }

                const relationsToUse = processedOptions.relations ?? this.getDefaultListRelations();
                const whereClause = processedOptions.where ?? {};

                const search = processedOptions.search;
                let searchCondition: SQL | undefined;
                if (search && search.trim().length > 0) {
                    const searchColumns = this.getSearchableColumns();
                    searchCondition = buildSearchCondition(
                        search,
                        searchColumns,
                        this.model.getTable()
                    );
                }

                const additionalConditions = searchCondition ? [searchCondition] : undefined;

                const sortBy = processedOptions.sortBy;
                if (sortBy) {
                    const table = this.model.getTable();
                    const tableRecord = table as unknown as Record<string, unknown>;
                    if (!Object.prototype.hasOwnProperty.call(tableRecord, sortBy)) {
                        throw new ServiceError(
                            ServiceErrorCode.VALIDATION_ERROR,
                            `Invalid sort field "${sortBy}". Field does not exist on ${this.entityName} table.`
                        );
                    }
                }
                const sortOrder = processedOptions.sortOrder;

                const result = relationsToUse
                    ? await this.model.findAllWithRelations(
                          relationsToUse,
                          whereClause,
                          {
                              page: processedOptions.page,
                              pageSize: processedOptions.pageSize,
                              sortBy,
                              sortOrder
                          },
                          additionalConditions,
                          execCtx?.tx
                      )
                    : await this.model.findAll(
                          whereClause,
                          {
                              page: processedOptions.page,
                              pageSize: processedOptions.pageSize,
                              sortBy,
                              sortOrder
                          },
                          additionalConditions,
                          execCtx?.tx
                      );

                return this._afterList(result, validatedActor, execCtx);
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
        params: z.infer<TSearchSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PaginatedListOutput<TEntity>>> {
        const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };
        return this.runWithLoggingAndValidation({
            methodName: 'search',
            input: { actor, ...params },
            schema: this.searchSchema,
            ctx: resolvedCtx,
            execute: async (validParams, validActor, execCtx) => {
                await this._canSearch(validActor);

                const normalizedParams = this.normalizers?.search
                    ? await this.normalizers.search(validParams, validActor)
                    : validParams;

                const processedParams = await this._beforeSearch(
                    normalizedParams,
                    validActor,
                    execCtx
                );
                const result = await this._executeSearch(processedParams, validActor, execCtx);
                return this._afterSearch(result, validActor, execCtx);
            }
        });
    }

    /**
     * Fetches a paginated, filtered, and sorted list of entities for admin endpoints.
     *
     * Requires `adminSearchSchema` to be set on the service. Validates incoming params
     * against that schema, applies lifecycle status and soft-delete filters, parses the
     * sort string, validates the sort field against actual table columns, builds a text
     * search condition, and delegates the final query to `_executeAdminSearch`.
     *
     * Lifecycle steps:
     * 1. **Configuration check**: Ensures `adminSearchSchema` is defined.
     * 2. **Validation**: Validates params against `adminSearchSchema`.
     * 3. **Permissions**: Calls `_canAdminList` to verify the actor has admin access and may list entities.
     * 4. **Sort parsing**: Parses and validates sort field against table columns.
     * 5. **Where clause**: Builds where from status, includeDeleted, and date range.
     * 6. **Search condition**: Builds ILIKE search across searchable columns.
     * 7. **Delegation**: Calls `_executeAdminSearch` with the assembled query params.
     *
     * @param actor - The user or system performing the action.
     * @param params - The admin search parameters (pagination, sort, filters, search).
     * @returns A `ServiceOutput` containing the paginated list or a `ServiceError`.
     */
    public async adminList(
        actor: Actor,
        params: Record<string, unknown>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PaginatedListOutput<TEntity>>> {
        const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };
        return this.runWithLoggingAndValidation({
            methodName: 'adminList',
            input: { actor, ...params },
            schema: z.record(z.string(), z.unknown()),
            ctx: resolvedCtx,
            execute: async (validatedPassthrough, validatedActor, execCtx) => {
                await this._canAdminList(validatedActor);

                if (!this.adminSearchSchema) {
                    throw new ServiceError(
                        ServiceErrorCode.CONFIGURATION_ERROR,
                        `adminSearchSchema is not configured for ${this.entityName}. Set it in the service constructor.`
                    );
                }

                const parseResult = this.adminSearchSchema.safeParse(validatedPassthrough);
                if (!parseResult.success) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        `Admin search validation failed: ${parseResult.error.message}`,
                        parseResult.error.flatten()
                    );
                }

                const validParams = parseResult.data as Record<string, unknown>;

                const {
                    page,
                    pageSize,
                    search,
                    sort,
                    status,
                    includeDeleted,
                    createdAfter,
                    createdBefore,
                    ...entityFilters
                } = validParams as {
                    page: number;
                    pageSize: number;
                    search?: string;
                    sort: string;
                    status: string;
                    includeDeleted: boolean;
                    createdAfter?: Date;
                    createdBefore?: Date;
                    [key: string]: unknown;
                };

                const { field: sortBy, direction: sortOrder } = parseAdminSort(sort);

                // Validate sort field against actual table columns
                const table = this.model.getTable();
                const tableRecord = table as unknown as Record<string, unknown>;
                if (!Object.prototype.hasOwnProperty.call(tableRecord, sortBy)) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        `Invalid sort field "${sortBy}". Field does not exist on ${this.entityName} table.`
                    );
                }

                // Build where clause from base admin filters
                const where: Record<string, unknown> = {};

                if (status !== 'all') {
                    where.lifecycleState = status;
                }

                if (!includeDeleted && 'deletedAt' in tableRecord) {
                    where.deletedAt = null;
                }

                if (createdAfter) {
                    where.createdAt_gte = createdAfter;
                }

                if (createdBefore) {
                    where.createdAt_lte = createdBefore;
                }

                // Build search condition from text query
                let searchCondition: SQL | undefined;
                if (search && search.trim().length > 0) {
                    searchCondition = buildSearchCondition(
                        search,
                        this.getSearchableColumns(),
                        table
                    );
                }

                return this._executeAdminSearch({
                    where,
                    entityFilters,
                    pagination: { page, pageSize },
                    sort: { sortBy, sortOrder },
                    search: searchCondition,
                    actor: validatedActor,
                    ctx: execCtx
                });
            }
        });
    }

    /**
     * Default implementation for executing admin search queries.
     *
     * Merges entity-specific filters into the where clause, combines search and extra
     * SQL conditions, and delegates to the model's `findAllWithRelations` or `findAll`
     * depending on whether default relations are configured.
     *
     * Concrete services can override this method to apply entity-specific query logic
     * (e.g., custom joins, computed filters, or specialized sorting).
     *
     * @param params - The assembled admin search parameters.
     * @param params.where - Base where clause (status, soft-delete, date range filters).
     * @param params.entityFilters - Entity-specific filters extracted from the admin search schema.
     * @param params.pagination - Page and pageSize for pagination.
     * @param params.sort - Sort field and direction.
     * @param params.search - Optional SQL condition for text search.
     * @param params.extraConditions - Optional additional SQL conditions.
     * @param params.actor - The actor performing the action.
     * @returns A paginated list of matching entities.
     */
    protected async _executeAdminSearch(
        params: AdminSearchExecuteParams
    ): Promise<PaginatedListOutput<TEntity>> {
        const { where, entityFilters, pagination, sort, search, extraConditions, ctx } = params;

        const mergedWhere: Record<string, unknown> = { ...where, ...entityFilters };

        const additionalConditions: SQL[] = [];
        if (search) {
            additionalConditions.push(search);
        }
        if (extraConditions) {
            additionalConditions.push(...extraConditions);
        }

        const conditionsToPass = additionalConditions.length > 0 ? additionalConditions : undefined;

        const relationsToUse = this.getDefaultListRelations();

        if (relationsToUse) {
            return this.model.findAllWithRelations(
                relationsToUse,
                mergedWhere,
                {
                    page: pagination.page,
                    pageSize: pagination.pageSize,
                    sortBy: sort.sortBy,
                    sortOrder: sort.sortOrder
                },
                conditionsToPass,
                ctx?.tx
            );
        }

        return this.model.findAll(
            mergedWhere,
            {
                page: pagination.page,
                pageSize: pagination.pageSize,
                sortBy: sort.sortBy,
                sortOrder: sort.sortOrder
            },
            conditionsToPass,
            ctx?.tx
        );
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
        params: z.infer<TSearchSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ count: number }>> {
        const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };
        return this.runWithLoggingAndValidation({
            methodName: 'count',
            input: { actor, ...params },
            schema: this.searchSchema,
            ctx: resolvedCtx,
            execute: async (validParams, validActor, execCtx) => {
                await this._canCount(validActor);
                const processedParams = await this._beforeCount(validParams, validActor, execCtx);
                const result = await this._executeCount(processedParams, validActor, execCtx);
                return this._afterCount(result, validActor, execCtx);
            }
        });
    }
}
