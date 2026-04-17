import {
    AccommodationFaqModel,
    AccommodationIaDataModel,
    AccommodationModel,
    DestinationModel,
    accommodations,
    sql
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { ImageProvider } from '@repo/media';
import { resolveEnvironment } from '@repo/media';
import {
    type Accommodation,
    AccommodationAdminSearchSchema,
    type AccommodationByDestinationParams,
    AccommodationByDestinationParamsSchema,
    type AccommodationCreateInput,
    AccommodationCreateInputSchema,
    type AccommodationFaq,
    type AccommodationFaqAddInput,
    AccommodationFaqAddInputSchema,
    type AccommodationFaqListInput,
    AccommodationFaqListInputSchema,
    type AccommodationFaqListOutput,
    type AccommodationFaqRemoveInput,
    AccommodationFaqRemoveInputSchema,
    type AccommodationFaqSingleOutput,
    type AccommodationFaqUpdateInput,
    AccommodationFaqUpdateInputSchema,
    type AccommodationIaDataAddInput,
    AccommodationIaDataAddInputSchema,
    type AccommodationIaDataListInput,
    AccommodationIaDataListInputSchema,
    type AccommodationIaDataListOutput,
    type AccommodationIaDataRemoveInput,
    AccommodationIaDataRemoveInputSchema,
    type AccommodationIaDataSingleOutput,
    type AccommodationIaDataUpdateInput,
    AccommodationIaDataUpdateInputSchema,
    type AccommodationIdType,
    type AccommodationListWrapper,
    type AccommodationRatingInput,
    type AccommodationSearchInput,
    type AccommodationSearchResult,
    AccommodationSearchSchema,
    type AccommodationStats,
    type AccommodationStatsWrapper,
    type AccommodationSummaryParams,
    AccommodationSummaryParamsSchema,
    type AccommodationSummaryWrapper,
    type AccommodationTopRatedParams,
    AccommodationTopRatedParamsSchema,
    AccommodationUpdateInputSchema,
    type CountResponse,
    type EntityFilters,
    type IdOrSlugParams,
    IdOrSlugParamsSchema,
    PermissionEnum,
    ServiceErrorCode,
    type Success,
    type WithOwnerIdParams,
    WithOwnerIdParamsSchema
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { BaseCrudService } from '../../base/base.crud.service';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import type {
    Actor,
    AdminSearchExecuteParams,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import { parseIdOrSlug } from '../../utils';
import { hasPermission } from '../../utils/permission';
import { DestinationService } from '../destination/destination.service';
import { generateSlug } from './accommodation.helpers';
import {
    normalizeAccommodationOutput,
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeViewInput
} from './accommodation.normalizers';
import {
    checkCanAdminList,
    checkCanCreate,
    checkCanHardDelete,
    checkCanList,
    checkCanRestore,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanView
} from './accommodation.permissions';
import type { AccommodationHookState } from './accommodation.types';

/** Entity-specific filter fields for accommodation admin search. */
type AccommodationEntityFilters = EntityFilters<typeof AccommodationAdminSearchSchema>;

/**
 * Provides accommodation-specific business logic, including creation, updates,
 * permissions, and other operations. It extends the generic `BaseCrudService` to
 * leverage a standardized service pipeline (validation, permissions, hooks, etc.).
 */
export class AccommodationService extends BaseCrudService<
    Accommodation,
    AccommodationModel,
    typeof AccommodationCreateInputSchema,
    typeof AccommodationUpdateInputSchema,
    typeof AccommodationSearchSchema
> {
    static readonly ENTITY_NAME = 'accommodation';
    protected readonly entityName = AccommodationService.ENTITY_NAME;
    private static readonly revalidationLogger = createLogger('accommodation-revalidation');
    /**
     * @inheritdoc
     */
    protected readonly model: AccommodationModel;
    /**
     * @inheritdoc
     */

    /**
     * @inheritdoc
     */
    protected readonly createSchema = AccommodationCreateInputSchema;
    /**
     * @inheritdoc
     */
    protected readonly updateSchema = AccommodationUpdateInputSchema;

    /**
     * @inheritdoc
     */
    protected readonly searchSchema = AccommodationSearchSchema;

    /**
     * @inheritdoc
     */
    protected getDefaultListRelations() {
        return {
            destination: true,
            owner: true
        };
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Accommodations are searched by name and description.
     */
    protected override getSearchableColumns(): string[] {
        return ['name', 'description'];
    }

    /**
     * @inheritdoc
     */
    protected normalizers: CrudNormalizersFromSchemas<
        typeof AccommodationCreateInputSchema,
        typeof AccommodationUpdateInputSchema,
        typeof AccommodationSearchSchema
    > = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput,
        list: normalizeListInput,
        view: normalizeViewInput,
        search: (params: AccommodationSearchInput) => params // identity by default, can be overridden in tests
    };

    private destinationService: DestinationService;
    private readonly _destinationModel: DestinationModel;

    /**
     * Optional Cloudinary media provider for asset cleanup on hard delete.
     * When null, media cleanup is skipped (Cloudinary not configured).
     */
    private readonly mediaProvider: ImageProvider | null;

    /**
     * Initializes a new instance of the AccommodationService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional AccommodationModel instance (for testing/mocking).
     * @param mediaProvider - Optional ImageProvider for Cloudinary cleanup on hard delete.
     */
    constructor(
        ctx: ServiceConfig,
        model?: AccommodationModel,
        mediaProvider?: ImageProvider | null
    ) {
        super(ctx, AccommodationService.ENTITY_NAME);
        this.model = model ?? new AccommodationModel();
        this.adminSearchSchema = AccommodationAdminSearchSchema;
        this.destinationService = new DestinationService(ctx);
        this._destinationModel = new DestinationModel();
        this.mediaProvider = mediaProvider ?? null;
    }

    // --- Permissions Hooks ---
    /**
     * @inheritdoc
     */
    protected _canCreate(actor: Actor, data: AccommodationCreateInput): void {
        checkCanCreate(actor, data);
    }
    /**
     * @inheritdoc
     */
    protected _canUpdate(actor: Actor, entity: Accommodation): void {
        checkCanUpdate(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canSoftDelete(actor: Actor, entity: Accommodation): void {
        checkCanSoftDelete(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canHardDelete(actor: Actor, entity: Accommodation): void {
        checkCanHardDelete(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canRestore(actor: Actor, entity: Accommodation): void {
        checkCanRestore(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canView(actor: Actor, entity: Accommodation): void {
        checkCanView(actor, entity);
    }
    /**
     * @inheritdoc
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }
    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks ACCOMMODATION_VIEW_ALL.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }
    /**
     * @inheritdoc
     * For accommodations, search permission is the same as list permission.
     * This could be evolved to a specific `ACCOMMODATION_SEARCH` permission if needed.
     */
    protected _canSearch(actor: Actor): void {
        checkCanList(actor);
    }
    /**
     * @inheritdoc
     * For accommodations, count permission is the same as list permission.
     */
    protected _canCount(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * @inheritdoc
     * For accommodations, visibility can be changed by anyone who can update the entity.
     * This could be evolved to a specific `ACCOMMODATION_UPDATE_VISIBILITY` permission if needed.
     */
    protected _canUpdateVisibility(
        actor: Actor,
        entity: Accommodation,
        _newVisibility: Accommodation['visibility']
    ): void {
        checkCanUpdate(actor, entity);
    }

    // --- Admin Search Override ---

    /**
     * Overrides the default admin search to handle JSONB price filters.
     *
     * The accommodation `price` column is JSONB with a nested `price` key holding
     * the numeric nightly rate. Standard column filters cannot query inside JSONB,
     * so `minPrice` and `maxPrice` are extracted from `entityFilters` and converted
     * into raw SQL conditions that cast `(price->>'price')::numeric` for comparison.
     *
     * All other filters are passed through to the base implementation unchanged.
     *
     * @param params - The assembled admin search parameters from `adminList`.
     * @returns A paginated list of matching accommodations.
     */
    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams<AccommodationEntityFilters>
    ): Promise<PaginatedListOutput<Accommodation>> {
        const { entityFilters, ...rest } = params;
        const { minPrice, maxPrice, ...simpleFilters } = entityFilters;

        const extraConditions: SQL[] = [...(params.extraConditions ?? [])];

        if (minPrice !== undefined) {
            extraConditions.push(sql`(${accommodations.price}->>'price')::numeric >= ${minPrice}`);
        }
        if (maxPrice !== undefined) {
            extraConditions.push(sql`(${accommodations.price}->>'price')::numeric <= ${maxPrice}`);
        }

        return super._executeAdminSearch({
            ...rest,
            entityFilters: simpleFilters,
            extraConditions
        });
    }

    // --- Lifecycle Hooks ---
    /**
     * @inheritdoc
     * Generates a unique slug for the accommodation before it is created.
     * This hook ensures that every accommodation has a URL-friendly and unique identifier.
     */
    protected async _beforeCreate(
        data: AccommodationCreateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<Accommodation>> {
        // Only generate a slug if one is not already provided
        if (!data.slug) {
            const slug = await generateSlug(data.type as string, data.name as string);
            return { slug };
        }
        // If slug is provided, return empty object to avoid overwriting
        return {};
    }

    /**
     * Resolves the destination slug for a given destinationId using the model directly
     * to avoid service-layer permission checks in lifecycle hooks.
     */
    private async _resolveDestinationSlug(destinationId: string): Promise<string | undefined> {
        try {
            const destination = await this._destinationModel.findById(destinationId);
            return destination?.slug;
        } catch {
            // Destination lookup is best-effort for revalidation context enrichment.
            // Never let it break the main CRUD flow.
            return undefined;
        }
    }

    protected async _afterCreate(
        entity: Accommodation,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<Accommodation> {
        if (entity.destinationId) {
            await this.destinationService.updateAccommodationsCount(entity.destinationId, ctx);
        }
        const destinationSlug = entity.destinationId
            ? await this._resolveDestinationSlug(entity.destinationId)
            : undefined;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'accommodation',
                slug: entity.slug,
                destinationSlug,
                accommodationType: entity.type?.toLowerCase()
            });
        } catch (error) {
            AccommodationService.revalidationLogger.warn(
                { error, entityType: 'accommodation' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return entity;
    }

    protected async _afterUpdate(
        entity: Accommodation,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Accommodation> {
        const destinationSlug = entity.destinationId
            ? await this._resolveDestinationSlug(entity.destinationId)
            : undefined;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'accommodation',
                slug: entity.slug,
                destinationSlug,
                accommodationType: entity.type?.toLowerCase()
            });
        } catch (error) {
            AccommodationService.revalidationLogger.warn(
                { error, entityType: 'accommodation' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return entity;
    }

    protected async _afterUpdateVisibility(
        entity: Accommodation,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Accommodation> {
        const destinationSlug = entity.destinationId
            ? await this._resolveDestinationSlug(entity.destinationId)
            : undefined;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'accommodation',
                slug: entity.slug,
                destinationSlug,
                accommodationType: entity.type?.toLowerCase()
            });
        } catch (error) {
            AccommodationService.revalidationLogger.warn(
                { error, entityType: 'accommodation' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return entity;
    }

    protected async _beforeRestore(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id);
        if (entity && ctx.hookState) {
            ctx.hookState.restoredAccommodation = {
                slug: entity.slug,
                destinationId: entity.destinationId,
                type: entity.type
            };
        }
        return id;
    }

    protected async _afterRestore(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<{ count: number }> {
        const restored = ctx.hookState?.restoredAccommodation;
        if (restored?.destinationId) {
            await this.destinationService.updateAccommodationsCount(restored.destinationId, ctx);
        }
        const destinationSlug = restored?.destinationId
            ? await this._resolveDestinationSlug(restored.destinationId)
            : undefined;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'accommodation',
                slug: restored?.slug,
                destinationSlug,
                accommodationType: restored?.type?.toLowerCase()
            });
        } catch (error) {
            AccommodationService.revalidationLogger.warn(
                { error, entityType: 'accommodation' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return result;
    }

    protected async _beforeSoftDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id);
        if (entity && ctx.hookState) {
            ctx.hookState.deletedEntity = {
                destinationId: entity.destinationId,
                slug: entity.slug,
                type: entity.type
            };
        }
        return id;
    }

    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<CountResponse> {
        const deleted = ctx.hookState?.deletedEntity;
        if (deleted?.destinationId) {
            await this.destinationService.updateAccommodationsCount(deleted.destinationId, ctx);
        }
        const destinationSlug = deleted?.destinationId
            ? await this._resolveDestinationSlug(deleted.destinationId)
            : undefined;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'accommodation',
                slug: deleted?.slug,
                destinationSlug,
                accommodationType: deleted?.type?.toLowerCase()
            });
        } catch (error) {
            AccommodationService.revalidationLogger.warn(
                { error, entityType: 'accommodation' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return result;
    }

    protected async _beforeHardDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id);
        if (entity && ctx.hookState) {
            ctx.hookState.deletedEntity = {
                destinationId: entity.destinationId,
                slug: entity.slug,
                type: entity.type
            };
            ctx.hookState.deletedEntityId = id;
        }
        return id;
    }

    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<AccommodationHookState>
    ): Promise<CountResponse> {
        const deleted = ctx.hookState?.deletedEntity;
        if (deleted?.destinationId) {
            await this.destinationService.updateAccommodationsCount(deleted.destinationId, ctx);
        }
        const destinationSlug = deleted?.destinationId
            ? await this._resolveDestinationSlug(deleted.destinationId)
            : undefined;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'accommodation',
                slug: deleted?.slug,
                destinationSlug,
                accommodationType: deleted?.type?.toLowerCase()
            });
        } catch (error) {
            AccommodationService.revalidationLogger.warn(
                { error, entityType: 'accommodation' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        // Best-effort Cloudinary cleanup after confirmed hard delete
        if (result.count > 0 && ctx.hookState?.deletedEntityId && this.mediaProvider) {
            const env = resolveEnvironment();
            const prefix = `hospeda/${env}/accommodations/${ctx.hookState.deletedEntityId}/`;
            try {
                await this.mediaProvider.deleteByPrefix({ prefix });
            } catch (mediaError) {
                AccommodationService.revalidationLogger.warn(
                    { error: mediaError, prefix },
                    '[media] Failed to clean up Cloudinary assets for accommodation'
                );
            }
        }
        return result;
    }

    // --- Core Logic ---
    /**
     * @inheritdoc
     * Executes the database search for accommodations with destination and owner relations.
     *
     * Uses `searchWithRelations` so that the destination and owner objects are always
     * included in the response, matching the behaviour of the `list` method.
     * All AccommodationSearchInput fields are forwarded to the model, including
     * price-range filters (JSONB), capacity ranges (JSONB extraInfo), minRating,
     * and amenity EXISTS subquery filters.
     *
     * @param params The validated and processed search parameters.
     * @param actor The actor performing the search.
     * @returns A paginated list of accommodations with destination and owner populated.
     */
    protected async _executeSearch(
        params: AccommodationSearchInput,
        actor: Actor,
        _ctx: ServiceContext
    ) {
        const hasVipAccess =
            actor.entitlements?.has('vip_promotions_access') ||
            hasPermission(actor, PermissionEnum.ACCOMMODATION_VIEW_ALL);

        return this.model.searchWithRelations({
            ...params,
            excludeRestricted: !hasVipAccess
        });
    }

    /**
     * @inheritdoc
     * Executes the database count for accommodations.
     * @param params The validated and processed search parameters.
     * @param actor The actor performing the count.
     * @returns An object containing the total count of accommodations matching the criteria.
     */
    protected async _executeCount(
        params: AccommodationSearchInput,
        actor: Actor,
        _ctx: ServiceContext
    ) {
        const hasVipAccess =
            actor.entitlements?.has('vip_promotions_access') ||
            hasPermission(actor, PermissionEnum.ACCOMMODATION_VIEW_ALL);

        return this.model.countByFilters({
            ...params,
            excludeRestricted: !hasVipAccess
        });
    }

    /**
     * Search accommodations with destination and owner relations for list display.
     * This method follows the complete service pipeline with validation, permissions,
     * normalization, and lifecycle hooks while providing enriched data for UI lists.
     *
     * @param actor - The actor performing the action
     * @param params - Search parameters including filters and pagination
     * @param _ctx - Optional service context (reserved for future transaction propagation)
     * @returns Accommodations with related destination and owner data
     */
    public async searchWithRelations(
        actor: Actor,
        params: AccommodationSearchInput,
        _ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationSearchResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'searchWithRelations',
            input: { actor, ...params },
            schema: this.searchSchema,
            execute: async (validatedParams, validatedActor) => {
                // 1. Permission Check
                await this._canSearch(validatedActor);

                // 2. Normalization
                const normalizedParams = this.normalizers?.search
                    ? await this.normalizers.search(validatedParams, validatedActor)
                    : validatedParams;

                // 3. Lifecycle Hook: Before Search
                const processedParams = await this._beforeSearch(
                    normalizedParams,
                    validatedActor,
                    {}
                );

                // 4. Execute search with relations
                const page = processedParams.page ?? 1;
                const pageSize = processedParams.pageSize ?? 10;

                const hasVipAccess =
                    validatedActor.entitlements?.has('vip_promotions_access') ||
                    hasPermission(validatedActor, PermissionEnum.ACCOMMODATION_VIEW_ALL);

                // Convert AccommodationSearchInput to model parameters format
                const modelParams = {
                    page,
                    pageSize,
                    sortBy: processedParams.sortBy,
                    sortOrder: processedParams.sortOrder,
                    q: processedParams.q,
                    type: processedParams.type,
                    types: processedParams.types,
                    minPrice: processedParams.minPrice,
                    maxPrice: processedParams.maxPrice,
                    destinationId: processedParams.destinationId,
                    destinationIds: processedParams.destinationIds,
                    amenities: processedParams.amenities,
                    isFeatured: processedParams.isFeatured,
                    isAvailable: processedParams.isAvailable,
                    excludeRestricted: !hasVipAccess
                };

                const result = await this.model.searchWithRelations(modelParams);

                // 5. Lifecycle Hook: After Search (adapt the result format)
                const adaptedResult = {
                    items: result.items.map((item) => item as Accommodation),
                    total: result.total,
                    page,
                    pageSize
                };

                await this._afterSearch(adaptedResult, validatedActor, {});

                // 6. Return in AccommodationSearchResult format
                return {
                    data: result.items,
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
        });
    }

    /**
     * Returns top-rated accommodations, optionally filtered by destination, type, and featured flag.
     * The output is a compact summary tailored for cards/lists and includes joined amenities/features only when related.
     * @param actor - The actor performing the action
     * @param params - Input with optional pageSize, destinationId, type and onlyFeatured
     * @param ctx - Optional service context for transaction propagation
     * @returns List of summarized accommodations ordered by rating
     */
    public async getTopRated(
        actor: Actor,
        params: AccommodationTopRatedParams,
        _ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTopRated',
            input: { ...params, actor },
            schema: AccommodationTopRatedParamsSchema,
            execute: async (validated, actor) => {
                await this._canList(actor);

                const hasVipAccess =
                    actor.entitlements?.has('vip_promotions_access') ||
                    hasPermission(actor, PermissionEnum.ACCOMMODATION_VIEW_ALL);

                const items = await this.model.findTopRated({
                    limit: validated.pageSize,
                    destinationId: validated.destinationId,
                    excludeRestricted: !hasVipAccess
                    // type: validated.type, // Field not available in schema
                    // onlyFeatured: validated.onlyFeatured // Field not available in schema
                });

                const accommodations =
                    items.map(
                        (item) => normalizeAccommodationOutput(item, actor) as Accommodation
                    ) ?? [];

                // Return wrapped in AccommodationListWrapper format
                return { accommodations };
            }
        });
    }

    /**
     * Gets a summary for a specific accommodation.
     * @param actor - The actor performing the action
     * @param data - The input object containing id or slug
     * @param ctx - Optional service context for transaction propagation
     * @returns The accommodation summary wrapped in an object
     */
    public async getSummary(
        actor: Actor,
        data: AccommodationSummaryParams,
        _ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationSummaryWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getSummary',
            input: { ...data, actor },
            schema: AccommodationSummaryParamsSchema,
            execute: async (validated, actor) => {
                const { id } = validated;
                const entityResult = await this.getByField(actor, 'id', id);
                if (entityResult.error) {
                    throw new ServiceError(
                        entityResult.error.code,
                        entityResult.error.message,
                        entityResult.error.details
                    );
                }
                if (!entityResult.data) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                const entity = entityResult.data;
                await this._canView(actor, entity);
                if (!entity.location) {
                    this.logger.warn(`Accommodation ${entity.id} has no location for summary.`);
                    return { accommodation: null };
                }
                const accommodation = {
                    id: entity.id,
                    type: entity.type,
                    ownerId: entity.ownerId,
                    slug: entity.slug,
                    name: entity.name,
                    summary: entity.summary,
                    isFeatured: entity.isFeatured,
                    reviewsCount: 0,
                    averageRating: 0,
                    media: entity.media,
                    location: entity.location
                };
                return { accommodation };
            }
        });
    }

    /**
     * Gets aggregated statistics for a single accommodation
     * @param actor - The actor performing the action
     * @param data - The input object containing accommodation id or slug
     * @param ctx - Optional service context for transaction propagation
     * @returns The accommodation statistics wrapped in a stats object
     */
    public async getStats(
        actor: Actor,
        data: IdOrSlugParams,
        _ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationStatsWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getStats',
            input: { ...data, actor },
            schema: IdOrSlugParamsSchema,
            execute: async (validatedParams, validatedActor) => {
                // Use utility to determine if it's ID or slug
                const { field } = parseIdOrSlug(validatedParams.idOrSlug);

                // Get accommodation using the appropriate base method
                const result = await this.getByField(
                    validatedActor,
                    field,
                    validatedParams.idOrSlug
                );

                if (result.error) {
                    throw new ServiceError(
                        result.error.code as ServiceErrorCode,
                        result.error.message
                    );
                }

                if (!result.data) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }

                // Create the stats object following AccommodationStatsSchema format
                const stats: AccommodationStats = {
                    total: 1, // Single accommodation
                    totalFeatured: result.data.isFeatured ? 1 : 0,
                    averagePrice: result.data.price?.price,
                    averageRating: result.data.averageRating ?? 0,
                    totalByType: {
                        [result.data.type]: 1
                    }
                };

                // Return wrapped in AccommodationStatsWrapper format
                return { stats };
            }
        });
    }

    /**
     * Gets accommodations by destination.
     * @param actor - The actor performing the action
     * @param data - The input object containing destinationId
     * @param ctx - Optional service context for transaction propagation
     * @returns The list of accommodations wrapped in accommodations array
     */
    public async getByDestination(
        actor: Actor,
        data: AccommodationByDestinationParams,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByDestination',
            input: { ...data, actor },
            schema: AccommodationByDestinationParamsSchema,
            execute: async (validated, actor) => {
                await this._canList(actor);
                const result = await this.model.findAll(
                    {
                        destinationId: validated.destinationId
                    },
                    {
                        page: validated.page,
                        pageSize: validated.pageSize
                    },
                    undefined,
                    ctx?.tx
                );

                const accommodations = Array.isArray(result.items)
                    ? result.items.map(
                          (item) => normalizeAccommodationOutput(item, actor) as Accommodation
                      )
                    : [];

                // Return wrapped in AccommodationListWrapper format
                return { accommodations };
            }
        });
    }

    /**
     * Gets top-rated accommodations by destination.
     * @param actor - The actor performing the action
     * @param data - The input object containing destinationId (required)
     * @param ctx - Optional service context for transaction propagation
     * @returns The list of top-rated accommodations for the destination
     */
    public async getTopRatedByDestination(
        actor: Actor,
        data: AccommodationTopRatedParams,
        _ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTopRatedByDestination',
            input: { ...data, actor },
            schema: AccommodationTopRatedParamsSchema,
            execute: async (validated, actor) => {
                await this._canList(actor);

                // For this method, destinationId is required
                if (!validated.destinationId) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'destinationId is required for getTopRatedByDestination'
                    );
                }

                const hasVipAccess =
                    actor.entitlements?.has('vip_promotions_access') ||
                    hasPermission(actor, PermissionEnum.ACCOMMODATION_VIEW_ALL);

                const items = await this.model.findTopRated({
                    limit: validated.pageSize,
                    destinationId: validated.destinationId,
                    excludeRestricted: !hasVipAccess
                });

                const accommodations =
                    items.map(
                        (item) => normalizeAccommodationOutput(item, actor) as Accommodation
                    ) ?? [];

                // Return wrapped in AccommodationListWrapper format
                return { accommodations };
            }
        });
    }

    /**
     * Adds a FAQ to an accommodation.
     * @param actor - The actor performing the action
     * @param data - The input object containing accommodationId and faq
     * @param ctx - Optional service context for transaction propagation
     * @returns The created FAQ
     */
    public async addFaq(
        actor: Actor,
        data: AccommodationFaqAddInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationFaqSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addFaq',
            input: { ...data, actor },
            schema: AccommodationFaqAddInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);
                const faqModel = new AccommodationFaqModel();
                const faqToCreate = {
                    ...validated.faq,
                    accommodationId: validated.accommodationId as AccommodationIdType
                };
                const createdFaq = await faqModel.create(faqToCreate, ctx?.tx);
                return { faq: createdFaq };
            }
        });
    }

    /**
     * Removes a FAQ from an accommodation.
     * @param actor - The actor performing the action
     * @param data - The input object containing accommodationId and faqId
     * @param ctx - Optional service context for transaction propagation
     * @returns Success boolean
     */
    public async removeFaq(
        actor: Actor,
        data: AccommodationFaqRemoveInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Success>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeFaq',
            input: { ...data, actor },
            schema: AccommodationFaqRemoveInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);
                const faqModel = new AccommodationFaqModel();
                const faq = await faqModel.findById(validated.faqId, ctx?.tx);
                if (!faq || faq.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'FAQ not found for this accommodation'
                    );
                }
                await faqModel.hardDelete({ id: validated.faqId }, ctx?.tx);
                return { success: true };
            }
        });
    }

    /**
     * Updates a FAQ for an accommodation.
     * @param actor - The actor performing the action
     * @param data - The input object containing accommodationId, faqId, and faq
     * @param ctx - Optional service context for transaction propagation
     * @returns The updated FAQ
     */
    public async updateFaq(
        actor: Actor,
        data: AccommodationFaqUpdateInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationFaqSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateFaq',
            input: { ...data, actor },
            schema: AccommodationFaqUpdateInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);
                const faqModel = new AccommodationFaqModel();
                const faq = await faqModel.findById(validated.faqId, ctx?.tx);
                if (!faq || faq.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'FAQ not found for this accommodation'
                    );
                }
                const updatedFaq = await faqModel.update(
                    { id: validated.faqId },
                    {
                        ...validated.faq,
                        accommodationId: validated.accommodationId as AccommodationIdType
                    },
                    ctx?.tx
                );
                if (!updatedFaq) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Failed to update FAQ');
                }
                return { faq: updatedFaq };
            }
        });
    }

    /**
     * Gets all FAQs for an accommodation.
     * Optimized to use a single query with relations.
     * @param actor - The actor performing the action
     * @param data - The input object containing accommodationId
     * @param ctx - Optional service context for transaction propagation
     * @returns The list of FAQs
     */
    public async getFaqs(
        actor: Actor,
        data: AccommodationFaqListInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationFaqListOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getFaqs',
            input: { ...data, actor },
            schema: AccommodationFaqListInputSchema,
            execute: async (validated, actor) => {
                // Single query to load accommodation with FAQs
                const accommodation = await this.model.findWithRelations(
                    { id: validated.accommodationId },
                    { faqs: true },
                    ctx?.tx
                );
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canView(actor, accommodation);
                // FAQs are already loaded via the relation
                const faqs = (accommodation as unknown as { faqs?: unknown[] }).faqs ?? [];
                return { faqs: faqs as AccommodationFaq[] };
            }
        });
    }

    /**
     * Adds IA data to an accommodation.
     * @param input - Input object for adding IA data.
     * @param actor - The actor performing the action.
     * @param ctx - Optional service context for transaction propagation
     * @returns Output object with the created IA data
     */
    public async addIAData(
        input: AccommodationIaDataAddInput,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationIaDataSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addIAData',
            input: { actor: actor, ...input },
            schema: AccommodationIaDataAddInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);
                const iaDataModel = new AccommodationIaDataModel();
                const iaDataToCreate = {
                    ...validated.iaData,
                    accommodationId: validated.accommodationId as AccommodationIdType
                };
                const createdIaData = await iaDataModel.create(iaDataToCreate, ctx?.tx);
                return { iaData: createdIaData };
            }
        });
    }

    /**
     * Removes IA data from an accommodation.
     * @param input - Input object for removing IA data.
     * @param actor - The actor performing the action.
     * @param ctx - Optional service context for transaction propagation
     * @returns Output object with success status
     */
    public async removeIAData(
        input: AccommodationIaDataRemoveInput,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<Success>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeIAData',
            input: { actor: actor, ...input },
            schema: AccommodationIaDataRemoveInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);
                const iaDataModel = new AccommodationIaDataModel();
                const iaData = await iaDataModel.findById(validated.iaDataId, ctx?.tx);
                if (!iaData || iaData.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'IA data not found for this accommodation'
                    );
                }
                await iaDataModel.hardDelete({ id: validated.iaDataId }, ctx?.tx);
                return { success: true };
            }
        });
    }

    /**
     * Updates IA data for an accommodation.
     * @param input - Input object for updating IA data.
     * @param actor - The actor performing the action.
     * @param ctx - Optional service context for transaction propagation
     * @returns Output object with the updated IA data
     */
    public async updateIAData(
        input: AccommodationIaDataUpdateInput,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationIaDataSingleOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateIAData',
            input: { actor: actor, ...input },
            schema: AccommodationIaDataUpdateInputSchema,
            execute: async (validated) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canUpdate(actor, accommodation);
                const iaDataModel = new AccommodationIaDataModel();
                const iaData = await iaDataModel.findById(validated.iaDataId, ctx?.tx);
                if (!iaData || iaData.accommodationId !== validated.accommodationId) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'IA data not found for this accommodation'
                    );
                }
                const updatedIaData = await iaDataModel.update(
                    { id: validated.iaDataId },
                    {
                        ...validated.iaData,
                        accommodationId: validated.accommodationId as AccommodationIdType
                    },
                    ctx?.tx
                );
                if (!updatedIaData) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to update IA data'
                    );
                }
                return { iaData: updatedIaData };
            }
        });
    }

    /**
     * Gets all IA data for an accommodation.
     * @param input - Input object for getting all IA data.
     * @param actor - The actor performing the action.
     * @param ctx - Optional service context for transaction propagation
     * @returns Output object with the list of IA data
     */
    public async getAllIAData(
        input: AccommodationIaDataListInput,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationIaDataListOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAllIAData',
            input: { actor: actor, ...input },
            schema: AccommodationIaDataListInputSchema,
            execute: async (validated, actor) => {
                const accommodation = await this.model.findById(validated.accommodationId, ctx?.tx);
                if (!accommodation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
                }
                await this._canView(actor, accommodation);
                const iaDataModel = new AccommodationIaDataModel();
                const { items: iaData } = await iaDataModel.findAll(
                    { accommodationId: validated.accommodationId },
                    undefined,
                    undefined,
                    ctx?.tx
                );
                return { iaData };
            }
        });
    }

    /**
     * Gets accommodations by owner.
     * @param input - Input object for owner query.
     * @param actor - The actor performing the action.
     * @param ctx - Optional service context for transaction propagation
     * @returns List of accommodations owned by the specified user
     */
    public async getByOwner(
        input: WithOwnerIdParams,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByOwner',
            input: { actor: actor, ...input },
            schema: WithOwnerIdParamsSchema,
            execute: async (validated, actor) => {
                await this._canList(actor);

                const result = await this.model.findAll(
                    { ownerId: validated.ownerId },
                    undefined,
                    undefined,
                    ctx?.tx
                );

                const accommodations = Array.isArray(result.items)
                    ? result.items.map(
                          (item) => normalizeAccommodationOutput(item, actor) as Accommodation
                      )
                    : [];

                // Return wrapped in AccommodationListWrapper format
                return { accommodations };
            }
        });
    }

    /**
     * Updates the stats (reviewsCount, averageRating, rating) for the accommodation from a review service.
     * @param accommodationId - The ID of the accommodation to update
     * @param stats - The computed review stats to persist
     * @param ctx - Optional service context for transaction propagation
     * @internal
     */
    async updateStatsFromReview(
        accommodationId: string,
        stats: { reviewsCount: number; averageRating: number; rating: AccommodationRatingInput },
        ctx?: ServiceContext
    ): Promise<void> {
        await this.model.updateById(
            accommodationId,
            {
                reviewsCount: stats.reviewsCount,
                averageRating: stats.averageRating,
                rating: stats.rating
            },
            ctx?.tx
        );
    }
}
