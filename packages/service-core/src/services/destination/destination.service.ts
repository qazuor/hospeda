import { AccommodationModel, DestinationModel } from '@repo/db';
import type {
    AccommodationListItem,
    BreadcrumbItem,
    Destination,
    DestinationCreateInput,
    DestinationRatingInput,
    DestinationSearchForListOutput,
    DestinationSearchInput,
    DestinationStats,
    DestinationSummaryType,
    DestinationUpdateInput,
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
    DestinationCreateInputSchema,
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
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceLogger, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { serviceLogger } from '../../utils';
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
    protected readonly model: DestinationModel;
    protected readonly logger: ServiceLogger;

    /**
     * Temporarily stores the entity ID during update operations,
     * so _beforeUpdate can access the current entity for reparenting logic.
     */
    private _updateId: string | undefined;
    protected readonly createSchema = DestinationCreateInputSchema;
    protected readonly updateSchema = DestinationUpdateInputSchema;
    protected readonly searchSchema = DestinationSearchSchema;

    protected getDefaultListRelations() {
        return undefined;
    }
    protected normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput,
        list: normalizeListInput,
        view: normalizeViewInput
    };
    private readonly accommodationModel: AccommodationModel = new AccommodationModel();

    constructor(ctx: ServiceContext, model?: DestinationModel) {
        super(ctx, DestinationService.ENTITY_NAME);
        this.logger = ctx.logger ?? serviceLogger;
        this.model = model ?? new DestinationModel();
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

    // --- Abstract methods required by BaseService ---
    /**
     * Executes a paginated search for destinations using provided filters and pagination options.
     * @param params - Validated search parameters (filters, pagination, etc.)
     * @param _actor - The actor performing the search (not used here)
     * @returns A paginated list of destinations matching the filters
     */
    protected async _executeSearch(params: DestinationSearchInput, _actor: Actor) {
        const {
            page = 1,
            pageSize = 10,
            sortBy,
            sortOrder,
            country,
            state,
            city,
            isFeatured,
            ancestorId,
            ...otherFilters
        } = params;
        // Build where clause from flat filters
        // Note: parentDestinationId, destinationType, level pass through otherFilters
        // and are handled by buildWhereClause as direct column matches
        const where: Record<string, unknown> = { ...otherFilters };
        if (country) where.country = country;
        if (state) where.state = state;
        if (city) where.city = city;
        if (isFeatured !== undefined) where.isFeatured = isFeatured;

        // Special handling for ancestorId (requires LIKE query on pathIds)
        if (ancestorId) {
            const descendants = await this.model.findDescendants(ancestorId, {
                destinationType: where.destinationType as
                    | import('@repo/schemas').DestinationType
                    | undefined
            });
            // Apply remaining equality filters manually
            let filtered = descendants;
            if (where.parentDestinationId) {
                filtered = filtered.filter(
                    (d) => d.parentDestinationId === where.parentDestinationId
                );
            }
            if (where.level !== undefined) {
                filtered = filtered.filter((d) => d.level === where.level);
            }
            // Manual pagination
            const total = filtered.length;
            const items = filtered.slice((page - 1) * pageSize, page * pageSize);
            return { items, total };
        }

        return this.model.findAll(where, { page, pageSize });
    }

    /**
     * Counts destinations matching the provided filters.
     * @param params - Validated filter parameters
     * @param _actor - The actor performing the count (not used here)
     * @returns An object with the total count
     */
    protected async _executeCount(params: DestinationSearchInput, _actor: Actor) {
        const { page, pageSize, sortBy, sortOrder, ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }

    // --- Domain-specific methods ---

    /**
     * Batch-loads attractions for a set of destination IDs.
     * Returns a map of destinationId to array of { id, name } attraction objects.
     * @param destIds - Array of destination UUIDs
     * @returns Map of destinationId to attraction array
     */
    async getAttractionsMap(destIds: readonly string[]): Promise<
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
        return this.model.getAttractionsMap(destIds);
    }

    /**
     * Searches for destinations with attractions mapped to string arrays for list display.
     * @param actor - The actor performing the search
     * @param params - Search parameters (filters, pagination, etc.)
     * @returns A paginated list of destinations with attractions as string arrays
     */
    async searchForList(
        actor: Actor,
        params: DestinationSearchInput
    ): Promise<DestinationSearchForListOutput> {
        // Check permissions
        this._canSearch(actor);

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
        const result = await this.model.findAll(where, {
            page,
            pageSize
        });

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
     * @returns ServiceOutput with accommodations array or error
     */
    public async getAccommodations(
        actor: Actor,
        params: GetDestinationAccommodationsInput
    ): Promise<ServiceOutput<{ accommodations: AccommodationListItem[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAccommodations',
            input: { ...params, actor },
            schema: GetDestinationAccommodationsInputSchema,
            execute: async (validated, actor) => {
                // Support both legacy { destinationId } and new { id }
                // biome-ignore lint/suspicious/noExplicitAny: bridging schema evolution
                const destinationId = (validated as any).destinationId ?? (validated as any).id;
                const destination = await this.model.findById(destinationId);
                if (!destination) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Destination with id '${destinationId}' not found.`
                    );
                }
                checkCanViewDestination(actor, destination);
                const { items } = await this.accommodationModel.findAll({
                    destinationId
                });
                return { accommodations: items };
            }
        });
    }

    /**
     * Returns aggregated stats for a destination (accommodations count, reviews count, average rating, etc.)
     * @param actor - The actor performing the action
     * @param params - ServiceInput containing actor and input object with destinationId
     * @returns ServiceOutput with stats or error
     */
    public async getStats(
        actor: Actor,
        params: GetDestinationStatsInput
    ): Promise<ServiceOutput<{ stats: DestinationStats }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getStats',
            input: { ...params, actor },
            schema: GetDestinationStatsInputSchema,
            execute: async (validated, actor) => {
                const { destinationId } = validated;
                const destination = await this.model.findById(destinationId);
                if (!destination) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Destination with id '${destinationId}' not found.`
                    );
                }
                checkCanViewDestination(actor, destination);
                return {
                    stats: {
                        accommodationsCount: destination.accommodationsCount ?? 0,
                        reviewsCount: destination.reviewsCount ?? 0,
                        averageRating: destination.averageRating ?? 0,
                        attractionsCount: destination.attractions?.length ?? 0,
                        eventsCount: 0 // Feature gap: implement events count when event-destination relation is added
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
     * @returns ServiceOutput with summary or error
     */
    public async getSummary(
        actor: Actor,
        params: GetDestinationSummaryInput
    ): Promise<ServiceOutput<{ summary: DestinationSummaryType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getSummary',
            input: { ...params, actor },
            schema: GetDestinationSummaryInputSchema,
            execute: async (validated, actor) => {
                const { destinationId } = validated;
                const destination = await this.model.findById(destinationId);
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
        _actor: Actor
    ): Promise<Partial<Destination>> {
        const result: Partial<Destination> = {};

        // Generate slug if not provided
        const slug = data.slug || (await generateDestinationSlug(data.name));
        result.slug = slug;

        // Ensure media has a default value (DB column is NOT NULL)
        if (!data.media) {
            result.media = { featuredImage: undefined, gallery: [], videos: [] };
        }

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
     * Overrides update to store the entity ID for the _beforeUpdate hook.
     */
    public async update(
        actor: Actor,
        id: string,
        data: DestinationUpdateInput
    ): Promise<ServiceOutput<Destination>> {
        this._updateId = id;
        try {
            return await super.update(actor, id, data);
        } finally {
            this._updateId = undefined;
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
        _actor: Actor
    ): Promise<Partial<Destination>> {
        const result: Partial<Destination> = {};

        // Only process if hierarchy-related fields changed
        const hasParentChange = data.parentDestinationId !== undefined;
        const hasSlugChange = data.slug !== undefined;

        if (!hasParentChange && !hasSlugChange) {
            return result;
        }

        // Fetch current destination
        const id = this._updateId;
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
                await this.model.updateDescendantPaths(id, current.path, newPath);
            }
        } else if (hasParentChange && newParentId === null) {
            // Moving to top-level
            result.level = 0;
            result.path = computeHierarchyPath({ parentPath: null, slug: newSlug });
            result.pathIds = '';

            if (current.path !== result.path) {
                await this.model.updateDescendantPaths(id, current.path, result.path);
            }
        } else if (hasSlugChange && !hasParentChange) {
            // Only slug changed, update path
            const parentPath = current.parentDestinationId
                ? current.path.substring(0, current.path.lastIndexOf('/'))
                : null;
            result.path = computeHierarchyPath({ parentPath, slug: newSlug });

            if (current.path !== result.path) {
                await this.model.updateDescendantPaths(id, current.path, result.path);
            }
        }

        return result;
    }

    /**
     * Updates the stats (reviewsCount, averageRating, rating) for a destination.
     * @param destinationId - The ID of the destination to update
     * @param stats - Object with reviewsCount, averageRating, and rating
     */
    public async updateStatsFromReview(
        destinationId: string,
        stats: {
            reviewsCount: number;
            averageRating: number;
            rating: DestinationRatingInput | undefined;
        }
    ): Promise<void> {
        await this.model.updateById(destinationId, {
            reviewsCount: stats.reviewsCount,
            averageRating: stats.averageRating,
            rating: stats.rating as DestinationRatingInput | undefined
        });
    }

    /**
     * Actualiza accommodationsCount del destino contando los accommodations activos.
     */
    public async updateAccommodationsCount(destinationId: string): Promise<void> {
        const { items } = await this.accommodationModel.findAll({ destinationId, deletedAt: null });
        const count = items.length;
        await this.model.updateById(destinationId, { accommodationsCount: count });
    }

    // ========================================================================
    // HIERARCHY QUERY METHODS
    // ========================================================================

    /**
     * Gets direct children of a destination.
     */
    public async getChildren(
        actor: Actor,
        params: GetDestinationChildrenInput
    ): Promise<ServiceOutput<{ children: Destination[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getChildren',
            input: { actor, ...params },
            schema: GetDestinationChildrenInputSchema,
            execute: async (validData) => {
                const children = await this.model.findChildren(validData.destinationId);
                return { children };
            }
        });
    }

    /**
     * Gets all descendants of a destination with optional depth and type filters.
     */
    public async getDescendants(
        actor: Actor,
        params: GetDestinationDescendantsInput
    ): Promise<ServiceOutput<{ descendants: Destination[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getDescendants',
            input: { actor, ...params },
            schema: GetDestinationDescendantsInputSchema,
            execute: async (validData) => {
                const descendants = await this.model.findDescendants(validData.destinationId, {
                    maxDepth: validData.maxDepth,
                    destinationType: validData.destinationType
                });
                return { descendants };
            }
        });
    }

    /**
     * Gets all ancestors of a destination ordered from root to parent.
     */
    public async getAncestors(
        actor: Actor,
        params: GetDestinationAncestorsInput
    ): Promise<ServiceOutput<{ ancestors: Destination[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAncestors',
            input: { actor, ...params },
            schema: GetDestinationAncestorsInputSchema,
            execute: async (validData) => {
                const ancestors = await this.model.findAncestors(validData.destinationId);
                return { ancestors };
            }
        });
    }

    /**
     * Gets breadcrumb navigation data for a destination.
     * Returns minimal items ordered from root to current destination.
     */
    public async getBreadcrumb(
        actor: Actor,
        params: GetDestinationBreadcrumbInput
    ): Promise<ServiceOutput<{ breadcrumb: BreadcrumbItem[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getBreadcrumb',
            input: { actor, ...params },
            schema: GetDestinationBreadcrumbInputSchema,
            execute: async (validData) => {
                const destination = await this.model.findOne({ id: validData.destinationId });
                if (!destination) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Destination not found: ${validData.destinationId}`
                    );
                }

                const ancestors = await this.model.findAncestors(validData.destinationId);
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
     */
    public async getByPath(
        actor: Actor,
        params: GetDestinationByPathInput
    ): Promise<ServiceOutput<Destination>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByPath',
            input: { actor, ...params },
            schema: GetDestinationByPathInputSchema,
            execute: async (validData) => {
                const destination = await this.model.findByPath(validData.path);
                if (!destination) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Destination not found at path: ${validData.path}`
                    );
                }
                return destination;
            }
        });
    }
}
