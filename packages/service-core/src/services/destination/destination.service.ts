import {
    AccommodationModel,
    DestinationFaqModel,
    DestinationModel,
    buildSearchCondition
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { ImageProvider } from '@repo/media/server';
import { resolveEnvironment } from '@repo/media/server';
import type {
    AccommodationListItem,
    BreadcrumbItem,
    Destination,
    DestinationCreateInput,
    DestinationFaq,
    DestinationFaqAddInput,
    DestinationFaqListInput,
    DestinationFaqListOutput,
    DestinationFaqSingleOutput,
    DestinationIdType,
    DestinationRatingInput,
    DestinationSearchForListOutput,
    DestinationSearchInput,
    DestinationStats,
    DestinationSummaryType,
    DestinationUpdateInput,
    EntityOptionsItem,
    GetDestinationAccommodationsInput,
    GetDestinationAncestorsInput,
    GetDestinationBreadcrumbInput,
    GetDestinationByPathInput,
    GetDestinationChildrenInput,
    GetDestinationDescendantsInput,
    GetDestinationStatsInput,
    GetDestinationSummaryInput
} from '@repo/schemas';
import {
    DestinationAdminSearchSchema,
    DestinationCreateInputSchema,
    DestinationFaqAddInputSchema,
    DestinationFaqListInputSchema,
    DestinationSearchSchema,
    DestinationUpdateInputSchema,
    GetDestinationAccommodationsInputSchema,
    GetDestinationAncestorsInputSchema,
    GetDestinationBreadcrumbInputSchema,
    GetDestinationByPathInputSchema,
    GetDestinationChildrenInputSchema,
    GetDestinationDescendantsInputSchema,
    GetDestinationStatsInputSchema,
    GetDestinationSummaryInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import type {
    Actor,
    ServiceConfig,
    ServiceContext,
    ServiceLogger,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import { checkCanFindOptions, serviceLogger } from '../../utils';
import { generateDestinationSlug } from './destination.helpers';
import {
    computeHierarchyLevel,
    computeHierarchyPath,
    computeHierarchyPathIds,
    isValidParentChildRelation
} from './destination.hierarchy.helpers';
import {
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeViewInput
} from './destination.normalizers';
import {
    checkCanAdminList,
    checkCanCountDestinations,
    checkCanCreateDestination,
    checkCanHardDeleteDestination,
    checkCanListDestinations,
    checkCanRestoreDestination,
    checkCanSearchDestinations,
    checkCanSoftDeleteDestination,
    checkCanUpdateDestination,
    checkCanUpdateDestinationVisibility,
    checkCanViewDestination
} from './destination.permission';
import type { DestinationHookState } from './destination.types';

/**
 * Service for domain-specific logic related to Destinations.
 * Inherits standard CRUD from BaseService. Only custom methods are defined here.
 */
export class DestinationService extends BaseCrudService<
    Destination,
    DestinationModel,
    typeof DestinationCreateInputSchema,
    typeof DestinationUpdateInputSchema,
    typeof DestinationSearchSchema
> {
    static readonly ENTITY_NAME = 'destination';
    protected readonly entityName = DestinationService.ENTITY_NAME;
    private static readonly revalidationLogger = createLogger('destination-revalidation');
    protected readonly model: DestinationModel;
    protected readonly logger: ServiceLogger;

    protected readonly createSchema = DestinationCreateInputSchema;
    protected readonly updateSchema = DestinationUpdateInputSchema;
    protected readonly searchSchema = DestinationSearchSchema;

    /**
     * Returns undefined intentionally: destinations have a recursive self-referencing
     * hierarchy (parent/children) that is not suitable for automatic eager-loading.
     *
     * Hierarchy data should be loaded via dedicated methods instead:
     * - `getAncestors()` for the root-to-parent chain
     * - `getBreadcrumb()` for navigation UI
     * - `getChildren()` / `getDescendants()` for subtree traversal
     */
    protected getDefaultListRelations() {
        return undefined;
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Destinations are searched by name and description.
     */
    protected override getSearchableColumns(): string[] {
        return ['name', 'description'];
    }

    protected normalizers: CrudNormalizersFromSchemas<
        typeof DestinationCreateInputSchema,
        typeof DestinationUpdateInputSchema,
        typeof DestinationSearchSchema
    > = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput,
        list: normalizeListInput,
        view: normalizeViewInput
    };
    private readonly accommodationModel: AccommodationModel = new AccommodationModel();

    /**
     * Optional Cloudinary media provider for asset cleanup on hard delete.
     * When null, media cleanup is skipped (Cloudinary not configured).
     */
    private readonly mediaProvider: ImageProvider | null;

    /**
     * Initializes a new instance of the DestinationService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional DestinationModel instance (for testing/mocking).
     * @param mediaProvider - Optional ImageProvider for Cloudinary cleanup on hard delete.
     */
    constructor(
        ctx: ServiceConfig,
        model?: DestinationModel,
        mediaProvider?: ImageProvider | null
    ) {
        super(ctx, DestinationService.ENTITY_NAME);
        this.logger = ctx.logger ?? serviceLogger;
        this.model = model ?? new DestinationModel();
        /**
         * Uses default _executeAdminSearch() because all entity-specific filter fields
         * (e.g. destinationType) map directly to table column names.
         */
        this.adminSearchSchema = DestinationAdminSearchSchema;
        this.mediaProvider = mediaProvider ?? null;
    }

    /**
     * Lightweight relation-selector lookup (SPEC-169 §5.5 / decision D4).
     *
     * Returns minimal `{ id, label, slug }` items for populating admin relation selectors
     * WITHOUT requiring a broad `DESTINATION_VIEW_ALL`-style grant. Gating is admin-panel
     * access only (see {@link checkCanFindOptions}); the route mirrors this with an
     * `ACCESS_PANEL_ADMIN`-only middleware gate.
     *
     * Results are DRAFT-inclusive (the model's `findAll` only excludes soft-deleted rows,
     * never publication state) so relations can target unpublished destinations.
     *
     * @param actor - The actor performing the lookup (must hold admin-panel access).
     * @param params - `{ q?: string, limit?: number }` — optional search term + result cap.
     * @param ctx - Optional service context (transaction).
     * @returns A `ServiceOutput` with `{ items }` of destination options.
     */
    public async findOptions(
        actor: Actor,
        params: { q?: string; limit?: number },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ items: EntityOptionsItem[] }>> {
        const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };
        return this.runWithLoggingAndValidation({
            methodName: 'findOptions',
            input: { actor, ...params },
            schema: z.object({
                q: z.string().trim().min(1).optional(),
                limit: z.number().int().min(1).max(100).default(20)
            }),
            ctx: resolvedCtx,
            execute: async (validatedInput, validatedActor, execCtx) => {
                checkCanFindOptions(validatedActor);

                const trimmedQ = validatedInput.q?.trim();
                const searchCondition =
                    trimmedQ && trimmedQ.length > 0
                        ? buildSearchCondition(trimmedQ, ['name'], this.model.getTable())
                        : undefined;

                const { items } = await this.model.findAll(
                    {},
                    { page: 1, pageSize: validatedInput.limit },
                    searchCondition ? [searchCondition] : undefined,
                    execCtx?.tx
                );

                const options: EntityOptionsItem[] = items.map((item) => ({
                    id: item.id,
                    label: item.name,
                    slug: item.slug
                }));

                return { items: options };
            }
        });
    }

    // --- Permissions Hooks ---
    protected _canCreate(actor: Actor, data: unknown): void {
        checkCanCreateDestination(actor, data);
    }
    protected _canUpdate(actor: Actor, entity: Destination): void {
        checkCanUpdateDestination(actor, entity);
    }
    protected _canSoftDelete(actor: Actor, entity: Destination): void {
        checkCanSoftDeleteDestination(actor, entity);
    }
    protected _canHardDelete(actor: Actor, entity: Destination): void {
        checkCanHardDeleteDestination(actor, entity);
    }
    protected _canRestore(actor: Actor, entity: Destination): void {
        checkCanRestoreDestination(actor, entity);
    }
    protected _canView(actor: Actor, entity: Destination): void {
        checkCanViewDestination(actor, entity);
    }
    protected _canList(actor: Actor): void {
        checkCanListDestinations(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanSearchDestinations(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanCountDestinations(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        entity: Destination,
        _newVisibility: unknown
    ): void {
        checkCanUpdateDestinationVisibility(actor, entity);
    }
    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks entity-specific permission.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }
    // --- Abstract methods required by BaseService ---
    /**
     * Strips DestinationSearchInput fields that are declared in the schema but not
     * yet implemented in this service, logging a warning for any that were provided.
     * Returns only the subset of params usable by the DB layer.
     */
    private extractImplementedFilters(params: DestinationSearchInput): {
        page: number;
        pageSize: number;
        q?: string;
        searchScope?: 'all' | 'name';
        country?: string;
        state?: string;
        city?: string;
        isFeatured?: boolean;
        ancestorId?: string;
        parentDestinationId?: string;
        destinationType?: DestinationSearchInput['destinationType'];
        level?: number;
    } {
        const {
            page = 1,
            pageSize = 10,
            sortBy: _sortBy,
            sortOrder: _sortOrder,
            q,
            searchScope,
            country,
            state,
            city,
            isFeatured,
            ancestorId,
            parentDestinationId,
            destinationType,
            level,
            // Unimplemented filters — warn and drop.
            latitude,
            longitude,
            radius,
            minAccommodations,
            maxAccommodations,
            minRating,
            tags,
            hasAttractions,
            climate,
            bestSeason
        } = params;

        const unimplemented: Record<string, unknown> = {};
        if (latitude !== undefined) unimplemented.latitude = latitude;
        if (longitude !== undefined) unimplemented.longitude = longitude;
        if (radius !== undefined) unimplemented.radius = radius;
        if (minAccommodations !== undefined) unimplemented.minAccommodations = minAccommodations;
        if (maxAccommodations !== undefined) unimplemented.maxAccommodations = maxAccommodations;
        if (minRating !== undefined) unimplemented.minRating = minRating;
        if (tags !== undefined) unimplemented.tags = tags;
        if (hasAttractions !== undefined) unimplemented.hasAttractions = hasAttractions;
        if (climate !== undefined) unimplemented.climate = climate;
        if (bestSeason !== undefined) unimplemented.bestSeason = bestSeason;

        if (Object.keys(unimplemented).length > 0) {
            this.logger.warn(
                { unimplemented },
                '[destination.search] Received filters that are declared in DestinationSearchSchema but not implemented in the service; they will be ignored.'
            );
        }

        return {
            page,
            pageSize,
            q,
            searchScope,
            country,
            state,
            city,
            isFeatured,
            ancestorId,
            parentDestinationId,
            destinationType,
            level
        };
    }

    /**
     * Executes a paginated search for destinations using provided filters and pagination options.
     * @param params - Validated search parameters (filters, pagination, etc.)
     * @param _actor - The actor performing the search (not used here)
     * @returns A paginated list of destinations matching the filters
     */
    protected async _executeSearch(
        params: DestinationSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        const {
            q,
            searchScope,
            country,
            state,
            city,
            isFeatured,
            ancestorId,
            parentDestinationId,
            destinationType,
            level
        } = this.extractImplementedFilters(params);

        // SPEC-088: pagination is stripped from params by BaseCrudRead.search and
        // forwarded via ctx.pagination instead. Fall back to extractImplementedFilters
        // defaults if the caller provided no explicit pagination.
        const page = _ctx.pagination?.page ?? 1;
        const pageSize = _ctx.pagination?.pageSize ?? 10;
        // SPEC-098 T-052c: forward sortBy/sortOrder through the same channel so
        // the model can honor them (including the synthetic `mostSaved` sort).
        // Previously these were dropped silently in extractImplementedFilters,
        // mirroring the same bug fixed in events/posts.
        const sortBy = _ctx.pagination?.sortBy;
        const sortOrder = _ctx.pagination?.sortOrder;

        // Build where clause from the subset of filters that map to real columns.
        // Note: country/state/city are not direct columns (stored in location jsonb)
        // but are kept here for backwards compatibility; buildWhereClause will
        // warn-and-skip them.
        const where: Record<string, unknown> = {};
        if (country) where.country = country;
        if (state) where.state = state;
        if (city) where.city = city;
        if (isFeatured !== undefined) where.isFeatured = isFeatured;
        if (parentDestinationId) where.parentDestinationId = parentDestinationId;
        if (destinationType) where.destinationType = destinationType;
        if (level !== undefined) where.level = level;

        // Build optional ILIKE search condition. The columns it runs against
        // depend on `searchScope`: 'name' restricts the match to the name
        // column (used by the city autocomplete picker so descriptions that
        // reference a nearby city don't pollute suggestions); 'all' (default)
        // keeps the legacy behavior over `getSearchableColumns()` so generic
        // browse pages can match descriptive text.
        const trimmedQ = q?.trim();
        const searchColumns = searchScope === 'name' ? ['name'] : this.getSearchableColumns();
        const searchCondition =
            trimmedQ && trimmedQ.length > 0
                ? buildSearchCondition(trimmedQ, searchColumns, this.model.getTable())
                : undefined;
        const additionalConditions = searchCondition ? [searchCondition] : undefined;

        // Special handling for ancestorId (requires LIKE query on pathIds)
        if (ancestorId) {
            const descendants = await this.model.findDescendants(ancestorId, {
                destinationType
            });
            // Apply remaining equality filters manually
            let filtered = descendants;
            if (parentDestinationId) {
                filtered = filtered.filter((d) => d.parentDestinationId === parentDestinationId);
            }
            if (level !== undefined) {
                filtered = filtered.filter((d) => d.level === level);
            }
            if (trimmedQ && trimmedQ.length > 0) {
                const needle = trimmedQ.toLowerCase();
                filtered = filtered.filter((d) => {
                    if (d.name?.toLowerCase().includes(needle)) return true;
                    if (searchScope === 'name') return false;
                    return d.description?.toLowerCase().includes(needle) ?? false;
                });
            }
            // Manual pagination
            const total = filtered.length;
            const items = filtered.slice((page - 1) * pageSize, page * pageSize);
            return { items, total };
        }

        return additionalConditions
            ? this.model.findAll(where, { page, pageSize, sortBy, sortOrder }, additionalConditions)
            : this.model.findAll(where, { page, pageSize, sortBy, sortOrder });
    }

    /**
     * Counts destinations matching the provided filters.
     * @param params - Validated filter parameters
     * @param _actor - The actor performing the count (not used here)
     * @returns An object with the total count
     */
    protected async _executeCount(
        params: DestinationSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        const { country, state, city, isFeatured, parentDestinationId, destinationType, level } =
            this.extractImplementedFilters(params);

        const where: Record<string, unknown> = {};
        if (country) where.country = country;
        if (state) where.state = state;
        if (city) where.city = city;
        if (isFeatured !== undefined) where.isFeatured = isFeatured;
        if (parentDestinationId) where.parentDestinationId = parentDestinationId;
        if (destinationType) where.destinationType = destinationType;
        if (level !== undefined) where.level = level;

        const count = await this.model.count(where);
        return { count };
    }

    // --- Domain-specific methods ---

    /**
     * Batch-loads attractions for a set of destination IDs.
     * Returns a map of destinationId to array of { id, name } attraction objects.
     * @param destIds - Array of destination UUIDs
     * @param ctx - Optional service context. When provided with a transaction, the query runs within it.
     * @returns Map of destinationId to attraction array
     */
    async getAttractionsMap(
        destIds: readonly string[],
        ctx?: ServiceContext
    ): Promise<
        ReadonlyMap<
            string,
            ReadonlyArray<{
                readonly id: string;
                readonly name: string;
                readonly icon: string | null;
                readonly displayWeight: number;
            }>
        >
    > {
        return this.model.getAttractionsMap(destIds, ctx?.tx);
    }

    /**
     * Searches for destinations with attractions mapped to string arrays for list display.
     * @param actor - The actor performing the search
     * @param params - Search parameters (filters, pagination, etc.)
     * @param ctx - Optional service context. When provided with a transaction, model queries run within it.
     * @returns A paginated list of destinations with attractions as string arrays
     */
    async searchForList(
        actor: Actor,
        params: DestinationSearchInput,
        ctx?: ServiceContext
    ): Promise<DestinationSearchForListOutput> {
        // Check permissions
        await this._canSearch(actor);

        // Extract parameters
        const {
            page = 1,
            pageSize = 10,
            country,
            state,
            city,
            isFeatured,
            ...otherFilters
        } = params;
        // Build where clause from flat filters
        const where: Record<string, unknown> = { ...otherFilters };
        if (country) where.country = country;
        if (state) where.state = state;
        if (city) where.city = city;
        if (isFeatured !== undefined) where.isFeatured = isFeatured;

        // Use the model method that includes attractions
        const result = await this.model.findAll(where, { page, pageSize }, undefined, ctx?.tx);

        // Map the result to the expected format
        const mappedItems = result.items.map((destination) => ({
            ...destination,
            attractions: destination.attractions?.map((a) => a.name) ?? []
        }));

        return {
            data: mappedItems,
            pagination: {
                page,
                pageSize,
                total: result.total,
                totalPages: Math.ceil(result.total / pageSize),
                hasNextPage: page * pageSize < result.total,
                hasPreviousPage: page > 1
            }
        };
    }
    /**
     * Returns all accommodations for a given destination.
     * @param actor - The actor performing the action
     * @param params - ServiceInput containing actor and input object with destinationId
     * @param ctx - Optional service context. When provided with a transaction, model queries run within it.
     * @returns ServiceOutput with accommodations array or error
     */
    public async getAccommodations(
        actor: Actor,
        params: GetDestinationAccommodationsInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ accommodations: AccommodationListItem[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAccommodations',
            input: { ...params, actor },
            schema: GetDestinationAccommodationsInputSchema,
            ctx,
            execute: async (validated, actor, resolvedCtx) => {
                // Support both legacy { destinationId } and new { id }
                // biome-ignore lint/suspicious/noExplicitAny: bridging schema evolution
                const destinationId = (validated as any).destinationId ?? (validated as any).id;
                const destination = await this.model.findById(destinationId, resolvedCtx.tx);
                if (!destination) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Destination with id '${destinationId}' not found.`
                    );
                }
                checkCanViewDestination(actor, destination);
                const { items } = await this.accommodationModel.findAll(
                    { destinationId },
                    undefined,
                    undefined,
                    resolvedCtx.tx
                );
                return { accommodations: items };
            }
        });
    }

    /**
     * Returns aggregated stats for a destination (accommodations count, reviews count, average rating, etc.)
     * @param actor - The actor performing the action
     * @param params - ServiceInput containing actor and input object with destinationId
     * @param ctx - Optional service context. When provided with a transaction, model queries run within it.
     * @returns ServiceOutput with stats or error
     */
    public async getStats(
        actor: Actor,
        params: GetDestinationStatsInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ stats: DestinationStats }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getStats',
            input: { ...params, actor },
            schema: GetDestinationStatsInputSchema,
            ctx,
            execute: async (validated, actor, resolvedCtx) => {
                const { destinationId } = validated;
                const destination = await this.model.findById(destinationId, resolvedCtx.tx);
                if (!destination) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Destination with id '${destinationId}' not found.`
                    );
                }
                checkCanViewDestination(actor, destination);
                // findById does not load attractions; fetch the count separately
                // so the stats card reflects the same number as the public list endpoint.
                const attractionsMap = await this.model.getAttractionsMap(
                    [destinationId],
                    resolvedCtx.tx
                );
                const attractionsCount = attractionsMap.get(destinationId)?.length ?? 0;
                return {
                    stats: {
                        accommodationsCount: destination.accommodationsCount ?? 0,
                        reviewsCount: destination.reviewsCount ?? 0,
                        averageRating: destination.averageRating ?? 0,
                        attractionsCount,
                        eventsCount: null // No event-destination relation exists yet
                    }
                };
            }
        });
    }

    /**
     * Returns a summarized, public-facing version of a destination.
     * This method provides a lightweight DTO for use in lists or cards, excluding sensitive or detailed information.
     * @param actor - The actor performing the action
     * @param params - ServiceInput containing actor and input object with destinationId
     * @param ctx - Optional service context. When provided with a transaction, model queries run within it.
     * @returns ServiceOutput with summary or error
     */
    public async getSummary(
        actor: Actor,
        params: GetDestinationSummaryInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ summary: DestinationSummaryType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getSummary',
            input: { ...params, actor },
            schema: GetDestinationSummaryInputSchema,
            ctx,
            execute: async (validated, actor, resolvedCtx) => {
                const { destinationId } = validated;
                const destination = await this.model.findById(destinationId, resolvedCtx.tx);
                if (!destination) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Destination with id '${destinationId}' not found.`
                    );
                }
                checkCanViewDestination(actor, destination);
                if (!destination.location) {
                    this.logger.warn(`Destination ${destination.id} has no location for summary.`);
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Destination location not found.'
                    );
                }
                const summary: DestinationSummaryType = {
                    id: destination.id,
                    slug: destination.slug,
                    name: destination.name,
                    summary: destination.summary,
                    media: destination.media,
                    location: destination.location,
                    isFeatured: destination.isFeatured,
                    averageRating: destination.averageRating ?? 0,
                    reviewsCount: destination.reviewsCount ?? 0,
                    accommodationsCount: destination.accommodationsCount ?? 0,
                    destinationType: destination.destinationType,
                    level: destination.level,
                    path: destination.path
                };
                return { summary };
            }
        });
    }

    /**
     * Auto-computes hierarchy fields (path, pathIds, level) and generates a unique slug before creation.
     * Validates parent-child relationship if parentDestinationId is provided.
     * @param data The original input data for creation.
     * @param _actor The actor performing the action.
     * @returns The normalized data with computed hierarchy fields and unique slug.
     */
    protected async _beforeCreate(
        data: DestinationCreateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<Destination>> {
        const result: Partial<Destination> = {};

        // Generate slug if not provided
        const slug = data.slug || (await generateDestinationSlug(data.name));
        result.slug = slug;

        // Ensure location has a default value (DB column is NOT NULL)
        if (!data.location) {
            result.location = {};
        }

        if (data.parentDestinationId) {
            // Fetch parent destination
            const parent = await this.model.findOne({ id: data.parentDestinationId });
            if (!parent) {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    `Parent destination not found: ${data.parentDestinationId}`
                );
            }

            // Validate parent-child type relationship
            if (
                !isValidParentChildRelation({
                    parentType: parent.destinationType,
                    childType: data.destinationType
                })
            ) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    `Invalid parent-child relationship: ${parent.destinationType} cannot be parent of ${data.destinationType}`
                );
            }

            // Compute hierarchy fields
            result.level = computeHierarchyLevel({ parentLevel: parent.level });
            result.path = computeHierarchyPath({ parentPath: parent.path, slug });
            result.pathIds = computeHierarchyPathIds({
                parentPathIds: parent.pathIds,
                parentId: parent.id
            });
        } else {
            // Top-level destination (COUNTRY)
            result.level = 0;
            result.path = computeHierarchyPath({ parentPath: null, slug });
            result.pathIds = '';
        }

        return result;
    }

    /**
     * Overrides update to propagate a transaction through to the parent entity update
     * and any descendant path cascade, ensuring both operations are atomic when an
     * outer transaction is provided. Without an outer tx, the parent update and
     * descendant cascade still run in their own scoped transactions.
     *
     * @param actor - The actor performing the update.
     * @param id - The ID of the destination to update.
     * @param data - The update input data.
     * @param ctx - Optional service context. When provided with a transaction, both the parent
     *   row update and the descendant path cascade use this same transaction.
     */
    public async update(
        actor: Actor,
        id: string,
        data: DestinationUpdateInput,
        ctx?: ServiceContext<DestinationHookState>
    ): Promise<ServiceOutput<Destination>> {
        const resolvedCtx: ServiceContext<DestinationHookState> = { hookState: {}, ...ctx };
        if (resolvedCtx.hookState) {
            resolvedCtx.hookState.updateId = id;
            resolvedCtx.hookState.pendingPathUpdate = undefined;
        }
        try {
            // Thread resolvedCtx into super.update so the parent row update participates
            // in the outer transaction when one is provided.
            const result = await super.update(actor, id, data, resolvedCtx);

            if (resolvedCtx.hookState?.pendingPathUpdate) {
                const { parentId, oldPath, newPath } = resolvedCtx.hookState.pendingPathUpdate;
                // When resolvedCtx.tx is provided, use it for full atomicity.
                // Without a transaction the cascade runs in a separate operation.
                if (resolvedCtx.tx !== undefined) {
                    await this.model.updateDescendantPaths(
                        parentId,
                        oldPath,
                        newPath,
                        resolvedCtx.tx
                    );
                } else {
                    await this.model.updateDescendantPaths(parentId, oldPath, newPath);
                }
            }

            return result;
        } finally {
            if (resolvedCtx.hookState) {
                resolvedCtx.hookState.updateId = undefined;
                resolvedCtx.hookState.pendingPathUpdate = undefined;
            }
        }
    }

    /**
     * Handles reparenting and slug changes during destination updates.
     * Recomputes path, pathIds, and level when parentDestinationId or slug changes.
     * Includes cycle detection to prevent circular hierarchies.
     * @param data The update input data.
     * @param _actor The actor performing the update.
     * @returns Partial destination with recomputed hierarchy fields.
     */
    protected async _beforeUpdate(
        data: DestinationUpdateInput,
        _actor: Actor,
        ctx: ServiceContext<DestinationHookState>
    ): Promise<Partial<Destination>> {
        const result: Partial<Destination> = {};

        // Only process if hierarchy-related fields changed
        const hasParentChange = data.parentDestinationId !== undefined;
        const hasSlugChange = data.slug !== undefined;

        if (!hasParentChange && !hasSlugChange) {
            return result;
        }

        // Fetch current destination
        const id = ctx.hookState?.updateId;
        if (!id) {
            return result;
        }

        const current = await this.model.findOne({ id });
        if (!current) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Destination not found: ${id}`);
        }

        const newSlug = data.slug || current.slug;
        const newParentId = hasParentChange
            ? data.parentDestinationId
            : current.parentDestinationId;

        if (newParentId) {
            // Cycle detection: the new parent must not be a descendant of this destination
            const wouldCycle = await this.model.isDescendant(newParentId, id);
            if (wouldCycle) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Cannot set parent: would create a circular hierarchy'
                );
            }

            const parent = await this.model.findOne({ id: newParentId });
            if (!parent) {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    `Parent destination not found: ${newParentId}`
                );
            }

            // Validate type relationship
            if (
                data.destinationType &&
                !isValidParentChildRelation({
                    parentType: parent.destinationType,
                    childType: data.destinationType
                })
            ) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    `Invalid parent-child relationship: ${parent.destinationType} cannot be parent of ${data.destinationType}`
                );
            }

            const newLevel = computeHierarchyLevel({ parentLevel: parent.level });
            const newPath = computeHierarchyPath({ parentPath: parent.path, slug: newSlug });
            const newPathIds = computeHierarchyPathIds({
                parentPathIds: parent.pathIds,
                parentId: parent.id
            });

            result.level = newLevel;
            result.path = newPath;
            result.pathIds = newPathIds;

            // Update descendants if path changed
            if (current.path !== newPath) {
                if (ctx.hookState) {
                    ctx.hookState.pendingPathUpdate = {
                        parentId: id,
                        oldPath: current.path,
                        newPath
                    };
                }
            }
        } else if (hasParentChange && newParentId === null) {
            // Moving to top-level
            result.level = 0;
            result.path = computeHierarchyPath({ parentPath: null, slug: newSlug });
            result.pathIds = '';

            if (current.path !== result.path && ctx.hookState) {
                ctx.hookState.pendingPathUpdate = {
                    parentId: id,
                    oldPath: current.path,
                    newPath: result.path
                };
            }
        } else if (hasSlugChange && !hasParentChange) {
            // Only slug changed, update path
            const parentPath = current.parentDestinationId
                ? current.path.substring(0, current.path.lastIndexOf('/'))
                : null;
            result.path = computeHierarchyPath({ parentPath, slug: newSlug });

            if (current.path !== result.path && ctx.hookState) {
                ctx.hookState.pendingPathUpdate = {
                    parentId: id,
                    oldPath: current.path,
                    newPath: result.path
                };
            }
        }

        return result;
    }

    protected async _afterCreate(
        entity: Destination,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Destination> {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'destination',
                slug: entity.slug
            });
        } catch (error) {
            DestinationService.revalidationLogger.warn(
                { error, entityType: 'destination' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return entity;
    }

    protected async _afterUpdate(
        entity: Destination,
        _actor: Actor,
        ctx: ServiceContext<DestinationHookState>
    ): Promise<Destination> {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'destination',
                slug: entity.slug
            });
        } catch (error) {
            DestinationService.revalidationLogger.warn(
                { error, entityType: 'destination' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }

        // SPEC-092 T-020: hierarchy revalidation on reparenting/slug change.
        // When the destination's path changes (set in _beforeUpdate via
        // ctx.hookState.pendingPathUpdate), every descendant's URL changes
        // too — schedule revalidation for each descendant so its detail
        // page and sub-routes are rebuilt against the new path.
        const pendingPathUpdate = ctx.hookState?.pendingPathUpdate;
        if (pendingPathUpdate) {
            try {
                const descendants = await this.model.findDescendants(entity.id, {});
                for (const descendant of descendants) {
                    getRevalidationService()?.scheduleRevalidation({
                        entityType: 'destination',
                        slug: descendant.slug
                    });
                }
            } catch (error) {
                DestinationService.revalidationLogger.warn(
                    { error, entityId: entity.id },
                    'Hierarchy revalidation cascade failed (non-blocking)'
                );
            }
        }
        return entity;
    }

    protected async _afterUpdateVisibility(
        entity: Destination,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Destination> {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'destination',
                slug: entity.slug
            });
        } catch (error) {
            DestinationService.revalidationLogger.warn(
                { error, entityType: 'destination' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return entity;
    }

    protected async _beforeSoftDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<DestinationHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id);
        if (ctx.hookState) {
            ctx.hookState.deletedDestinationSlug = entity?.slug;
        }
        return id;
    }

    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<DestinationHookState>
    ): Promise<{ count: number }> {
        const slug = ctx.hookState?.deletedDestinationSlug;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'destination',
                slug
            });
        } catch (error) {
            DestinationService.revalidationLogger.warn(
                { error, entityType: 'destination' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return result;
    }

    protected async _beforeHardDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<DestinationHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id);
        if (ctx.hookState) {
            ctx.hookState.deletedDestinationSlug = entity?.slug;
            ctx.hookState.deletedEntityId = id;
        }
        return id;
    }

    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<DestinationHookState>
    ): Promise<{ count: number }> {
        const slug = ctx.hookState?.deletedDestinationSlug;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'destination',
                slug
            });
        } catch (error) {
            DestinationService.revalidationLogger.warn(
                { error, entityType: 'destination' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        // Best-effort Cloudinary cleanup after confirmed hard delete
        if (result.count > 0 && ctx.hookState?.deletedEntityId && this.mediaProvider) {
            const env = resolveEnvironment();
            const prefix = `hospeda/${env}/destinations/${ctx.hookState.deletedEntityId}/`;
            try {
                await this.mediaProvider.deleteByPrefix({ prefix });
            } catch (mediaError) {
                DestinationService.revalidationLogger.warn(
                    { error: mediaError, prefix },
                    '[media] Failed to clean up Cloudinary assets for destination'
                );
            }
        }
        return result;
    }

    protected async _beforeRestore(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<DestinationHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id);
        if (ctx.hookState) {
            ctx.hookState.restoredDestinationSlug = entity?.slug;
        }
        return id;
    }

    protected async _afterRestore(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<DestinationHookState>
    ): Promise<{ count: number }> {
        const slug = ctx.hookState?.restoredDestinationSlug;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'destination',
                slug
            });
        } catch (error) {
            DestinationService.revalidationLogger.warn(
                { error, entityType: 'destination' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return result;
    }

    /**
     * Updates the stats (reviewsCount, averageRating, rating) for a destination.
     * Internal system operation called from review services during cascading updates.
     * @param destinationId - The ID of the destination to update
     * @param stats - Object with reviewsCount, averageRating, and rating
     * @param ctx - Optional service context. When provided with a transaction, the update runs within it.
     * @internal
     */
    public async updateStatsFromReview(
        destinationId: string,
        stats: {
            reviewsCount: number;
            averageRating: number;
            rating: DestinationRatingInput | undefined;
        },
        ctx?: ServiceContext
    ): Promise<void> {
        await this.model.updateById(
            destinationId,
            {
                reviewsCount: stats.reviewsCount,
                averageRating: stats.averageRating,
                rating: stats.rating as DestinationRatingInput | undefined
            },
            ctx?.tx
        );
    }

    /**
     * Updates accommodationsCount for a destination by counting active accommodations.
     * Internal system operation called from accommodation services during cascading updates.
     * @param destinationId - The ID of the destination to update
     * @param ctx - Optional service context. When provided with a transaction, the update runs within it.
     * @internal
     */
    public async updateAccommodationsCount(
        destinationId: string,
        ctx?: ServiceContext
    ): Promise<void> {
        const accommodationCount = await this.accommodationModel.count({
            destinationId,
            deletedAt: null
        });
        await this.model.updateById(
            destinationId,
            { accommodationsCount: accommodationCount },
            ctx?.tx
        );
    }

    // ========================================================================
    // HIERARCHY QUERY METHODS
    // These methods are intentionally permissive (no permission checks) because
    // they serve public-tier endpoints (/public/destinations/...). Admin-tier
    // routes reuse these methods with HTTP-level permission enforcement via
    // middleware. Actor is passed for logging/audit purposes only.
    // ========================================================================

    /**
     * Gets direct children of a destination.
     * @param actor - The actor performing the action
     * @param params - Input containing destinationId
     * @param ctx - Optional service context. When provided with a transaction, the query runs within it.
     */
    public async getChildren(
        actor: Actor,
        params: GetDestinationChildrenInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ children: Destination[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getChildren',
            input: { actor, ...params },
            schema: GetDestinationChildrenInputSchema,
            ctx,
            execute: async (validData, _actor, resolvedCtx) => {
                const children = await this.model.findChildren(
                    validData.destinationId,
                    resolvedCtx.tx
                );
                return { children };
            }
        });
    }

    /**
     * Gets all descendants of a destination with optional depth and type filters.
     * @param actor - The actor performing the action
     * @param params - Input containing destinationId and optional filters
     * @param ctx - Optional service context. When provided with a transaction, the query runs within it.
     */
    public async getDescendants(
        actor: Actor,
        params: GetDestinationDescendantsInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ descendants: Destination[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getDescendants',
            input: { actor, ...params },
            schema: GetDestinationDescendantsInputSchema,
            ctx,
            execute: async (validData, _actor, resolvedCtx) => {
                const descendants = await this.model.findDescendants(
                    validData.destinationId,
                    {
                        maxDepth: validData.maxDepth,
                        destinationType: validData.destinationType
                    },
                    resolvedCtx.tx
                );
                return { descendants };
            }
        });
    }

    /**
     * Gets all ancestors of a destination ordered from root to parent.
     * @param actor - The actor performing the action
     * @param params - Input containing destinationId
     * @param ctx - Optional service context. When provided with a transaction, the query runs within it.
     */
    public async getAncestors(
        actor: Actor,
        params: GetDestinationAncestorsInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ ancestors: Destination[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAncestors',
            input: { actor, ...params },
            schema: GetDestinationAncestorsInputSchema,
            ctx,
            execute: async (validData, _actor, resolvedCtx) => {
                const ancestors = await this.model.findAncestors(
                    validData.destinationId,
                    resolvedCtx.tx
                );
                return { ancestors };
            }
        });
    }

    /**
     * Gets breadcrumb navigation data for a destination.
     * Returns minimal items ordered from root to current destination.
     * @param actor - The actor performing the action
     * @param params - Input containing destinationId
     * @param ctx - Optional service context. When provided with a transaction, model queries run within it.
     */
    public async getBreadcrumb(
        actor: Actor,
        params: GetDestinationBreadcrumbInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ breadcrumb: BreadcrumbItem[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getBreadcrumb',
            input: { actor, ...params },
            schema: GetDestinationBreadcrumbInputSchema,
            ctx,
            execute: async (validData, _actor, resolvedCtx) => {
                const destination = await this.model.findOne(
                    { id: validData.destinationId },
                    resolvedCtx.tx
                );
                if (!destination) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Destination not found: ${validData.destinationId}`
                    );
                }

                const ancestors = await this.model.findAncestors(
                    validData.destinationId,
                    resolvedCtx.tx
                );
                const breadcrumb: BreadcrumbItem[] = [
                    ...ancestors.map((a) => ({
                        id: a.id,
                        slug: a.slug,
                        name: a.name,
                        level: a.level,
                        destinationType: a.destinationType,
                        path: a.path
                    })),
                    {
                        id: destination.id,
                        slug: destination.slug,
                        name: destination.name,
                        level: destination.level,
                        destinationType: destination.destinationType,
                        path: destination.path
                    }
                ];
                return { breadcrumb };
            }
        });
    }

    /**
     * Finds a destination by its materialized path.
     *
     * The detail flow needs the related `attractions` array (selected into
     * `DestinationPublicSchema`) and the base lookup does not eagerly load
     * relations, so we hydrate attractions explicitly here. Same treatment
     * is applied to `getBySlug` below — both are convenience wrappers that
     * the destination detail page consumes.
     *
     * @param actor - The actor performing the action
     * @param params - Input containing the materialized path
     * @param ctx - Optional service context. When provided with a transaction, the query runs within it.
     */
    public async getByPath(
        actor: Actor,
        params: GetDestinationByPathInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Destination>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByPath',
            input: { actor, ...params },
            schema: GetDestinationByPathInputSchema,
            ctx,
            execute: async (validData, _actor, resolvedCtx) => {
                const destination = await this.model.findByPath(validData.path, resolvedCtx.tx);
                if (!destination) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Destination not found at path: ${validData.path}`
                    );
                }
                return this._withAttractions(destination, resolvedCtx);
            }
        });
    }

    /**
     * Override of the base `getBySlug` to hydrate the `attractions` relation,
     * matching what the public detail page expects.
     *
     * The base implementation in BaseCrudRead returns the entity without
     * relations. Without this override the destination detail page sees
     * `attractions: undefined` and the "Qué hacer acá" section, the stats
     * counter, and any future attraction-driven UI all silently render as
     * empty.
     *
     * @param actor - The user performing the action
     * @param slug - Destination slug to resolve
     * @param ctx - Optional service context (transaction propagation)
     */
    public override async getBySlug(
        actor: Actor,
        slug: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Destination | null>> {
        const result = await super.getBySlug(actor, slug, ctx);
        if (result.error || !result.data) return result;
        const hydrated = await this._withAttractions(result.data, ctx);
        return { data: hydrated };
    }

    /**
     * Loads attractions for a single destination via the existing batch
     * loader (which uses an inner join + ORDER BY displayWeight DESC) and
     * merges them onto the destination object. If the destination already
     * carries an attractions array (e.g., loaded by a future relations
     * query), we leave it untouched.
     *
     * @param destination - Destination to enrich
     * @param ctx - Optional service context for transaction propagation
     * @returns The destination object with `attractions` populated
     */
    private async _withAttractions(
        destination: Destination,
        ctx?: ServiceContext
    ): Promise<Destination> {
        const existing = (destination as { attractions?: ReadonlyArray<unknown> }).attractions;
        if (Array.isArray(existing) && existing.length > 0) return destination;
        const map = await this.model.getAttractionsMap([destination.id], ctx?.tx);
        const attractions = map.get(destination.id) ?? [];
        return { ...destination, attractions } as Destination;
    }

    /**
     * Adds a FAQ to a destination.
     * @param actor - The actor performing the action
     * @param data - The input object containing destinationId and faq
     * @param ctx - Optional service context for transaction propagation
     * @returns The created FAQ
     */
    public async addFaq(
        actor: Actor,
        data: DestinationFaqAddInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<DestinationFaqSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addFaq',
            input: { ...data, actor },
            schema: DestinationFaqAddInputSchema,
            execute: async (validated) => {
                const destination = await this.model.findById(validated.destinationId, ctx?.tx);
                if (!destination) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Destination not found');
                }
                this._canUpdate(actor, destination);
                const faqModel = new DestinationFaqModel();
                const faqToCreate = {
                    ...validated.faq,
                    destinationId: validated.destinationId as DestinationIdType
                };
                const createdFaq = await faqModel.create(faqToCreate, ctx?.tx);
                return { faq: createdFaq };
            }
        });
    }

    /**
     * Gets all FAQs for a destination.
     * Optimized to use a single query with relations.
     * @param actor - The actor performing the action
     * @param data - The input object containing destinationId
     * @param ctx - Optional service context for transaction propagation
     * @returns The list of FAQs
     */
    public async getFaqs(
        actor: Actor,
        data: DestinationFaqListInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<DestinationFaqListOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getFaqs',
            input: { ...data, actor },
            schema: DestinationFaqListInputSchema,
            execute: async (validated, actorFromRun) => {
                // Single query to load destination with FAQs
                const destination = await this.model.findWithRelations(
                    { id: validated.destinationId },
                    { faqs: true },
                    ctx?.tx
                );
                if (!destination) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Destination not found');
                }
                this._canView(actorFromRun, destination);
                // FAQs are already loaded via the relation.
                // TYPE-WORKAROUND: Drizzle relation result widens the entity type to include
                // the joined `faqs` array which is not part of the base Destination type.
                const faqs = (destination as unknown as { faqs?: unknown[] }).faqs ?? [];
                return { faqs: faqs as DestinationFaq[] };
            }
        });
    }
}
