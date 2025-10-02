import { AccommodationModel, DestinationModel } from '@repo/db';
import type {
    AccommodationListItem,
    Destination,
    DestinationCreateInput,
    DestinationRatingInput,
    DestinationSearchForListOutput,
    DestinationSearchInput,
    DestinationStats,
    DestinationSummaryType,
    GetDestinationAccommodationsInput,
    GetDestinationStatsInput,
    GetDestinationSummaryInput
} from '@repo/schemas';
import {
    DestinationCreateInputSchema,
    DestinationSearchSchema,
    DestinationUpdateInputSchema,
    GetDestinationAccommodationsInputSchema,
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
    protected readonly createSchema = DestinationCreateInputSchema;
    protected readonly updateSchema = DestinationUpdateInputSchema;
    protected readonly searchSchema = DestinationSearchSchema;
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
        const { page = 1, pageSize = 10, filters = {} } = params;
        // Build where clause from filters (similar to other services)
        const where: Record<string, unknown> = {};
        if (filters.country) where.country = filters.country;
        if (filters.state) where.state = filters.state;
        if (filters.city) where.city = filters.city;
        if (filters.isFeatured !== undefined) where.isFeatured = filters.isFeatured;
        return this.model.findAll(filters, { page, pageSize });
    }

    /**
     * Counts destinations matching the provided filters.
     * @param params - Validated filter parameters
     * @param _actor - The actor performing the count (not used here)
     * @returns An object with the total count
     */
    protected async _executeCount(params: DestinationSearchInput, _actor: Actor) {
        const { filters = {} } = params;
        const count = await this.model.count(filters);
        return { count };
    }

    // --- Domain-specific methods ---

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
        const { page = 1, pageSize = 10, filters = {} } = params;
        // Build where clause from filters (similar to other services)
        const where: Record<string, unknown> = {};
        if (filters.country) where.country = filters.country;
        if (filters.state) where.state = filters.state;
        if (filters.city) where.city = filters.city;
        if (filters.isFeatured !== undefined) where.isFeatured = filters.isFeatured;

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
                        eventsCount: 0 // TODO: implement events count when events are available
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
                    accommodationsCount: destination.accommodationsCount ?? 0
                };
                return { summary };
            }
        });
    }

    /**
     * Generates a unique slug for the destination before it is created.
     * This hook ensures that every destination has a URL-friendly and unique identifier.
     * @param data The original input data for creation.
     * @param _actor The actor performing the action (unused in this normalization).
     * @returns The normalized data with a unique slug.
     */
    protected async _beforeCreate(
        data: DestinationCreateInput,
        _actor: Actor
    ): Promise<Partial<Destination>> {
        // Only generate a slug if one is not already provided
        if (!data.slug) {
            const slug = await generateDestinationSlug(data.name);
            return { slug };
        }
        // If slug is provided, return empty object to avoid overwriting
        return {};
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
}
