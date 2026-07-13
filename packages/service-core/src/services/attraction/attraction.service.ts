import {
    AttractionModel,
    attractions,
    DestinationModel,
    RDestinationAttractionModel
} from '@repo/db';
import type {
    Attraction,
    AttractionIdType,
    Destination,
    DestinationAttractionRelation,
    DestinationIdType
} from '@repo/schemas';
import {
    type AttractionAddToDestinationInput,
    AttractionAddToDestinationInputSchema,
    AttractionAdminSearchSchema,
    type AttractionCreateInput,
    AttractionCreateInputSchema,
    type AttractionListWithCountsResponse,
    type AttractionRemoveFromDestinationInput,
    AttractionRemoveFromDestinationInputSchema,
    type AttractionSearchInput,
    AttractionSearchInputSchema,
    type AttractionsByDestinationInput,
    AttractionsByDestinationInputSchema,
    type AttractionUpdateInput,
    AttractionUpdateInputSchema,
    type CountResponse,
    type DestinationIdsByAttractionSlugsInput,
    DestinationIdsByAttractionSlugsInputSchema,
    type DestinationIdsByAttractionSlugsOutput,
    type DestinationsByAttractionInput,
    DestinationsByAttractionInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { inArray, type SQL } from 'drizzle-orm';
import { BaseCrudRelatedService } from '../../base/base.crud.related.service';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import {
    type Actor,
    type PaginatedListOutput,
    type ServiceConfig,
    type ServiceContext,
    ServiceError,
    type ServiceOutput
} from '../../types';
import { generateAttractionSlug } from './attraction.helpers';
import {
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeViewInput
} from './attraction.normalizers';
import {
    checkCanAdminList,
    checkCanCreateAttraction,
    checkCanDeleteAttraction,
    checkCanListAttractions,
    checkCanUpdateAttraction,
    checkCanViewAttraction
} from './attraction.permissions';

/**
 * Upper bound for a single destination's attraction-relation lookup in
 * {@link AttractionService.resolveDestinationIdFilter}. The base model caps
 * `pageSize` at `MAX_PAGE_SIZE` (200), so this pulls the full relation set
 * (not the default page of 20) and keeps the `destinationId` id-filter
 * complete. A single destination realistically never has this many
 * attractions; and for the `searchForList` count aggregation the worst case
 * is `pageSize` (capped at 100 by the search schema) times the average
 * destinations-per-attraction, so 200 covers it unless an attraction maps to
 * more than ~2 destinations on average — not a real-world case.
 */
const DESTINATION_RELATIONS_PAGE_SIZE = 200;

/**
 * Service for managing attractions. Implements business logic, permissions, and hooks for Attraction entities.
 * @extends BaseCrudRelatedService
 */
export class AttractionService extends BaseCrudRelatedService<
    Attraction,
    AttractionModel,
    RDestinationAttractionModel,
    typeof AttractionCreateInputSchema,
    typeof AttractionUpdateInputSchema,
    typeof AttractionSearchInputSchema
> {
    static readonly ENTITY_NAME = 'attraction';
    protected readonly entityName = AttractionService.ENTITY_NAME;
    public readonly model: AttractionModel;

    public readonly createSchema = AttractionCreateInputSchema;
    public readonly updateSchema = AttractionUpdateInputSchema;
    public readonly searchSchema = AttractionSearchInputSchema;
    /**
     * Admin search schema for attraction list filtering.
     * Uses default _executeAdminSearch() because all entity-specific filter fields
     * map directly to table column names (no JSONB extraction, field renames, or range filters needed).
     */
    protected readonly adminSearchSchema = AttractionAdminSearchSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Attractions are searched by name and description.
     */
    protected override getSearchableColumns(): string[] {
        return ['name', 'description'];
    }

    protected readonly destinationModel: DestinationModel;
    protected normalizers: CrudNormalizersFromSchemas<
        typeof AttractionCreateInputSchema,
        typeof AttractionUpdateInputSchema,
        typeof AttractionSearchInputSchema
    > = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput,
        list: normalizeListInput,
        view: normalizeViewInput
    };

    constructor(
        ctx: ServiceConfig,
        model?: AttractionModel,
        relatedModel?: RDestinationAttractionModel,
        destinationModel?: DestinationModel
    ) {
        super(ctx, AttractionService.ENTITY_NAME, relatedModel);
        this.model = model ?? new AttractionModel();
        this.destinationModel = destinationModel ?? new DestinationModel();
    }

    /**
     * Lifecycle hook: normalizes input and generates slug before creating an attraction.
     * If slug is not provided, generates a unique slug from the name.
     */
    protected async _beforeCreate(
        data: AttractionCreateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<Attraction>> {
        let slug = (data as { slug?: string }).slug;
        if (!slug && data.name) {
            slug = await generateAttractionSlug(data.name, this.model);
        }
        return { ...data, slug };
    }

    /**
     * Lifecycle hook: normalizes input and generates slug before updating an attraction.
     * If name is updated and slug is not provided, generates a new unique slug.
     */
    protected async _beforeUpdate(
        data: AttractionUpdateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<Attraction>> {
        let slug = (data as { slug?: string }).slug;
        if (!slug && data.name) {
            let entity: Attraction | undefined;
            if ('id' in data && data.id) {
                const found = await this.model.findById(data.id as AttractionIdType);
                entity = found ?? undefined;
            }
            if (!entity || (entity && data.name !== entity.name)) {
                slug = await generateAttractionSlug(data.name, this.model);
            }
        }
        return { ...data, slug };
    }

    protected _canCreate(actor: Actor): void {
        checkCanCreateAttraction(actor);
    }
    protected _canUpdate(actor: Actor): void {
        checkCanUpdateAttraction(actor);
    }
    protected _canDelete(actor: Actor): void {
        checkCanDeleteAttraction(actor);
    }
    protected _canView(actor: Actor): void {
        checkCanViewAttraction(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanListAttractions(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanListAttractions(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanListAttractions(actor);
    }
    protected _canSoftDelete(actor: Actor): void {
        checkCanDeleteAttraction(actor);
    }
    protected _canHardDelete(actor: Actor): void {
        checkCanDeleteAttraction(actor);
    }
    protected _canRestore(actor: Actor): void {
        checkCanUpdateAttraction(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: Attraction,
        _newVisibility?: unknown
    ): void {
        checkCanUpdateAttraction(actor);
    }
    protected _canAddAttractionToDestination(actor: Actor): void {
        checkCanCreateAttraction(actor);
    }
    protected _canRemoveAttractionFromDestination(actor: Actor): void {
        checkCanDeleteAttraction(actor);
    }
    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks entity-specific permission.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }
    protected createDefaultRelatedModel(): RDestinationAttractionModel {
        return new RDestinationAttractionModel();
    }

    /**
     * Adds an attraction to a destination, ensuring validation, permissions, and uniqueness.
     * Optimized to run existence checks in parallel.
     * @param actor - The actor performing the action
     * @param params - The params required to add the attraction to the destination
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async addAttractionToDestination(
        actor: Actor,
        params: AttractionAddToDestinationInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ relation: DestinationAttractionRelation }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addAttractionToDestination',
            input: { ...params, actor },
            schema: AttractionAddToDestinationInputSchema,
            ctx,
            execute: async (validatedParams, actor) => {
                await this._canAddAttractionToDestination(actor);
                const { destinationId, attractionId } = validatedParams;

                // Run all existence checks in parallel for better performance
                const [attraction, destination, existing] = await Promise.all([
                    this.model.findOne({ id: attractionId as AttractionIdType }),
                    this.destinationModel.findOne({ id: destinationId as DestinationIdType }),
                    this.relatedModel.findOne({
                        destinationId: destinationId as DestinationIdType,
                        attractionId: attractionId as AttractionIdType
                    })
                ]);

                if (!attraction) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Attraction not found');
                }
                if (!destination) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Destination not found');
                }
                if (existing) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        'Attraction already added to destination'
                    );
                }

                // Create the relation
                const relation = await this.relatedModel.create({
                    destinationId: destinationId as DestinationIdType,
                    attractionId: attractionId as AttractionIdType
                });

                // If the model returns just an id or number, fetch the full relation
                let fullRelation = relation;
                if (typeof relation === 'number' || typeof relation === 'string' || !relation) {
                    const found = await this.relatedModel.findOne({
                        destinationId: destinationId as DestinationIdType,
                        attractionId: attractionId as AttractionIdType
                    });
                    if (!found) {
                        throw new ServiceError(
                            ServiceErrorCode.INTERNAL_ERROR,
                            'Failed to create relation'
                        );
                    }
                    fullRelation = found;
                }
                return { relation: fullRelation as DestinationAttractionRelation };
            }
        });
    }

    /**
     * Removes an attraction from a destination.
     * @param actor - The actor performing the action
     * @param params - The params required to remove the attraction from the destination
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async removeAttractionFromDestination(
        actor: Actor,
        params: AttractionRemoveFromDestinationInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ relation: DestinationAttractionRelation }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeAttractionFromDestination',
            input: { ...params, actor },
            schema: AttractionRemoveFromDestinationInputSchema,
            ctx,
            execute: async (validatedParams, actor) => {
                await this._canRemoveAttractionFromDestination(actor);
                const { destinationId, attractionId } = validatedParams;
                // Verify attraction exists
                const attraction = await this.model.findOne({
                    id: attractionId as AttractionIdType
                });
                if (!attraction) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Attraction not found');
                }
                const destination = await this.destinationModel.findOne({
                    id: destinationId as DestinationIdType
                });
                if (!destination) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Destination not found');
                }
                // Verify that the relation exists
                const existing = await this.relatedModel.findOne({
                    destinationId: destinationId as DestinationIdType,
                    attractionId: attractionId as AttractionIdType
                });
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Attraction relation not found for this destination'
                    );
                }
                // Remove the relation (soft delete or delete)
                const relation = await this.relatedModel.softDelete({
                    destinationId: destinationId as DestinationIdType,
                    attractionId: attractionId as AttractionIdType
                });
                if (typeof relation === 'number' || typeof relation === 'string' || !relation) {
                    const fullRelation = await this.relatedModel.findOne({
                        destinationId: destinationId as DestinationIdType,
                        attractionId: attractionId as AttractionIdType
                    });
                    if (!fullRelation) {
                        throw new ServiceError(
                            ServiceErrorCode.INTERNAL_ERROR,
                            'Failed to remove relation'
                        );
                    }
                    return { relation: fullRelation };
                }
                if (!relation) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to remove relation'
                    );
                }
                return { relation: relation as DestinationAttractionRelation };
            }
        });
    }

    /**
     * Lists all attractions for a destination.
     * Optimized to use a single JOIN query instead of 2 sequential queries.
     * @param actor - The actor performing the action
     * @param params - The params containing the destination ID
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async getAttractionsForDestination(
        actor: Actor,
        params: AttractionsByDestinationInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ attractions: Attraction[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAttractionsForDestination',
            input: { ...params, actor },
            schema: AttractionsByDestinationInputSchema,
            ctx,
            execute: async (validatedParams, actor) => {
                await this._canList(actor);
                const { destinationId } = validatedParams;

                // Run existence check and data fetch in parallel
                const [destination, relationsResult] = await Promise.all([
                    this.destinationModel.findOne({
                        id: destinationId as DestinationIdType
                    }),
                    this.relatedModel.findAll({ destinationId })
                ]);

                if (!destination) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Destination not found');
                }

                const { items: relations } = relationsResult;

                // If no relations, return empty array early
                if (relations.length === 0) {
                    return { attractions: [] };
                }

                const attractionIds = relations.map(
                    (r: DestinationAttractionRelation) => r.attractionId
                );

                // Fetch all attractions in one query, sorted by displayWeight DESC
                const { items: attractions } = await this.model.findAll({ id: attractionIds });
                const sorted = [...attractions].sort(
                    (a, b) => (b.displayWeight ?? 50) - (a.displayWeight ?? 50)
                );
                return { attractions: sorted };
            }
        });
    }

    /**
     * Lists all destinations for a given attraction.
     * Optimized to use parallel queries instead of 2 sequential queries.
     * @param actor - The actor performing the action
     * @param params - The params containing the attraction ID
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async getDestinationsByAttraction(
        actor: Actor,
        params: DestinationsByAttractionInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ destinations: Destination[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getDestinationsByAttraction',
            input: { ...params, actor },
            schema: DestinationsByAttractionInputSchema,
            ctx,
            execute: async (validatedParams, actor) => {
                await this._canList(actor);
                const { attractionId } = validatedParams;

                // Run existence check and data fetch in parallel
                const [attraction, relationsResult] = await Promise.all([
                    this.model.findOne({
                        id: attractionId as AttractionIdType
                    }),
                    this.relatedModel.findAll({ attractionId })
                ]);

                if (!attraction) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Attraction not found');
                }

                const { items: relations } = relationsResult;

                // If no relations, return empty array early
                if (relations.length === 0) {
                    return { destinations: [] };
                }

                const destinationIds = relations.map(
                    (r: DestinationAttractionRelation) => r.destinationId
                );

                // Fetch all destinations in one query
                const { items: destinations } = await this.destinationModel.findAll({
                    id: destinationIds
                });
                return { destinations };
            }
        });
    }

    /**
     * Bulk-resolves attraction SLUGS (not a single UUID) to the destinations
     * that have them, via `r_destination_attraction` (HOS-111 T-016, G-11 —
     * "una ciudad con carnavales"). Consumed by the AI search-chat handler,
     * which only has NL-matched slugs from the curated allowlist (T-015),
     * never a pre-resolved attraction UUID — this is the slug-bulk sibling of
     * {@link getDestinationsByAttraction} (single UUID, paginated).
     *
     * No accommodation↔attraction join exists for the MVP (spec §6 Phase 3):
     * the caller constrains the accommodation search's `destinationIds`
     * directly with the returned set.
     *
     * @param actor - The actor performing the action.
     * @param params - The params containing the attraction slugs to resolve.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns De-duplicated destination UUIDs (never throws NOT_FOUND — an
     *   unmatched slug or a destination-less attraction simply yields fewer,
     *   or zero, ids; the caller treats an empty result as "skip constraint").
     */
    public async getDestinationIdsByAttractionSlugs(
        actor: Actor,
        params: DestinationIdsByAttractionSlugsInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<DestinationIdsByAttractionSlugsOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getDestinationIdsByAttractionSlugs',
            input: { ...params, actor },
            schema: DestinationIdsByAttractionSlugsInputSchema,
            ctx,
            execute: async (validatedParams, _actor, resolvedCtx) => {
                await this._canList(actor);
                const destinationIds = await this.model.findDestinationIdsBySlugs(
                    validatedParams.slugs,
                    resolvedCtx.tx
                );
                return { destinationIds };
            }
        });
    }

    /**
     * Builds the plain `where` object for search/count/searchForList.
     *
     * Deliberately EXCLUDES `destinationId` — `attractions` has no
     * `destinationId` column (the relation is M2M via
     * `r_destination_attraction`, HOS-125). Passing it through to
     * `buildWhereClause` would either throw `DbError` (unknown column, when
     * it's the only filter) or be silently dropped (when combined with
     * another known filter), returning attractions across ALL destinations.
     * See {@link resolveDestinationIdFilter} for how `destinationId` is
     * applied instead, as an `id IN (...)` additional condition.
     *
     * @param params - Search params containing the plain-column filters.
     * @returns A `where` object safe to pass to `model.findAll`/`model.count`.
     */
    private buildSearchWhere(
        params: Pick<AttractionSearchInput, 'name' | 'slug' | 'isFeatured' | 'isBuiltin'>
    ): Record<string, unknown> {
        const { name, slug, isFeatured, isBuiltin } = params;
        const where: Record<string, unknown> = {};
        if (name) where.name = name;
        if (slug) where.slug = slug;
        if (typeof isFeatured === 'boolean') where.isFeatured = isFeatured;
        if (typeof isBuiltin === 'boolean') where.isBuiltin = isBuiltin;
        return where;
    }

    /**
     * Resolves a `destinationId` search filter to an `id IN (...)`
     * additional SQL condition, via the `r_destination_attraction` join
     * table (HOS-125 — attractions have no `destinationId` column).
     *
     * Reuses the same relation lookup as {@link getAttractionsForDestination}:
     * query the join table for every `attractionId` mapped to the
     * destination, then constrain the main query with
     * `inArray(attractions.id, ids)`. The relation lookup requests the full
     * page ({@link DESTINATION_RELATIONS_PAGE_SIZE}) rather than the model's
     * default of 20, so the id-filter is not silently truncated for a
     * destination with many attractions.
     *
     * @param destinationId - The destination id filter from search params,
     *   if any.
     * @returns `{ empty: true }` when `destinationId` was provided but maps
     *   to zero attractions (callers MUST short-circuit to an empty result
     *   rather than falling through to an unfiltered query).
     *   `{ empty: false, additionalConditions: [] }` when no `destinationId`
     *   filter was requested. `{ empty: false, additionalConditions: [SQL] }`
     *   otherwise, containing the `id IN (...)` condition to combine with the
     *   plain `where` object.
     */
    private async resolveDestinationIdFilter(
        destinationId: string | undefined
    ): Promise<{ empty: boolean; additionalConditions: SQL[] }> {
        if (!destinationId) {
            return { empty: false, additionalConditions: [] };
        }
        const { items: relations } = await this.relatedModel.findAll(
            { destinationId },
            { page: 1, pageSize: DESTINATION_RELATIONS_PAGE_SIZE }
        );
        if (relations.length === 0) {
            return { empty: true, additionalConditions: [] };
        }
        const attractionIds = relations.map(
            (r: DestinationAttractionRelation) => r.attractionId as string
        );
        return { empty: false, additionalConditions: [inArray(attractions.id, attractionIds)] };
    }

    protected async _executeSearch(
        params: AttractionSearchInput,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<Attraction>> {
        const where = this.buildSearchWhere(params);
        const { empty, additionalConditions } = await this.resolveDestinationIdFilter(
            params.destinationId
        );
        if (empty) {
            return { items: [], total: 0 };
        }
        // BaseCrudRead.search strips page/pageSize/sortBy/sortOrder from params
        // (SPEC-088) and re-publishes them via ctx.pagination. Forward them
        // explicitly so the model uses the caller-provided page/pageSize
        // instead of falling back to its default of 20.
        const { items, total } = await this.model.findAll(
            where,
            {
                page: ctx.pagination?.page ?? 1,
                pageSize: ctx.pagination?.pageSize ?? 10,
                sortBy: ctx.pagination?.sortBy,
                sortOrder: ctx.pagination?.sortOrder
            },
            additionalConditions
        );
        return { items, total };
    }

    protected async _executeCount(
        params: AttractionSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<CountResponse> {
        const where = this.buildSearchWhere(params);
        const { empty, additionalConditions } = await this.resolveDestinationIdFilter(
            params.destinationId
        );
        if (empty) {
            return { count: 0 };
        }
        const count = await this.model.count(where, { additionalConditions });
        return { count };
    }

    /**
     * Searches for attractions with destination counts.
     * Optimized to fetch all counts in a single query using aggregation.
     * @param actor - The actor performing the action
     * @param params - The search parameters
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns Attractions with destination counts in standardized pagination format
     */
    public async searchForList(
        actor: Actor,
        params: AttractionSearchInput,
        _ctx?: ServiceContext
    ): Promise<AttractionListWithCountsResponse> {
        await this._canSearch(actor);
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 10;

        const where = this.buildSearchWhere(params);
        const { empty, additionalConditions } = await this.resolveDestinationIdFilter(
            params.destinationId
        );

        const buildEmptyPage = (total: number) => ({
            data: [],
            pagination: {
                page,
                pageSize,
                total,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage: false
            }
        });
        if (empty) {
            return buildEmptyPage(0);
        }

        const { items, total } = await this.model.findAll(
            where,
            { page, pageSize },
            additionalConditions
        );

        // If no items, return early
        if (items.length === 0) {
            return buildEmptyPage(total);
        }

        // Get all attraction IDs from the current page
        const attractionIds = items.map((item) => item.id as AttractionIdType);

        // Fetch all relations for these attractions in a single query. Request
        // the full relation page (not the model's default of 20) so the
        // destinationCount aggregation is not silently undercounted when the
        // current page's attractions collectively map to more than 20 relation
        // rows.
        const { items: allRelations } = await this.relatedModel.findAll(
            { attractionId: attractionIds },
            { page: 1, pageSize: DESTINATION_RELATIONS_PAGE_SIZE }
        );

        // Build a map of attraction ID to count
        const countMap = new Map<string, number>();
        for (const relation of allRelations) {
            const attractionId = relation.attractionId as string;
            countMap.set(attractionId, (countMap.get(attractionId) ?? 0) + 1);
        }

        // Merge counts with attractions
        const itemsWithCounts = items.map((attraction) => ({
            ...attraction,
            destinationCount: countMap.get(attraction.id as string) ?? 0
        }));

        return {
            data: itemsWithCounts,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
                hasNextPage: page * pageSize < total,
                hasPreviousPage: page > 1
            }
        };
    }
}
