import { AccommodationModel, DestinationModel } from '@repo/db';
import type {
    DestinationCreateInput,
    DestinationFilterInput,
    DestinationSearchForListOutput,
    DestinationStats,
    DestinationSummaryType,
    GetDestinationAccommodationsInput,
    GetDestinationStatsInput,
    GetDestinationSummaryInput
} from '@repo/schemas';
import {
    DestinationCreateInputSchema,
    DestinationFilterInputSchema,
    DestinationUpdateInputSchema,
    GetDestinationAccommodationsInputSchema,
    GetDestinationStatsInputSchema,
    GetDestinationSummaryInputSchema
} from '@repo/schemas';
import type { AccommodationType, DestinationRatingType, DestinationType } from '@repo/types';

import { ServiceErrorCode } from '@repo/types';
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
    DestinationType,
    DestinationModel,
    typeof DestinationCreateInputSchema,
    typeof DestinationUpdateInputSchema,
    typeof DestinationFilterInputSchema
> {
    static readonly ENTITY_NAME = 'destination';
    protected readonly entityName = DestinationService.ENTITY_NAME;
    protected readonly model: DestinationModel;
    protected readonly logger: ServiceLogger;
    protected readonly createSchema = DestinationCreateInputSchema;
    protected readonly updateSchema = DestinationUpdateInputSchema;
    protected readonly searchSchema = DestinationFilterInputSchema;
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
    protected _canUpdate(actor: Actor, entity: DestinationType): void {
        checkCanUpdateDestination(actor, entity);
    }
    protected _canSoftDelete(actor: Actor, entity: DestinationType): void {
        checkCanSoftDeleteDestination(actor, entity);
    }
    protected _canHardDelete(actor: Actor, entity: DestinationType): void {
        checkCanHardDeleteDestination(actor, entity);
    }
    protected _canRestore(actor: Actor, entity: DestinationType): void {
        checkCanRestoreDestination(actor, entity);
    }
    protected _canView(actor: Actor, entity: DestinationType): void {
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
        entity: DestinationType,
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
    protected async _executeSearch(params: DestinationFilterInput, _actor: Actor) {
        const { filters = {}, pagination } = params;
        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 10;
        return this.model.search({ filters, page, pageSize });
    }

    /**
     * Counts destinations matching the provided filters.
     * @param params - Validated filter parameters
     * @param _actor - The actor performing the count (not used here)
     * @returns An object with the total count
     */
    protected async _executeCount(params: DestinationFilterInput, _actor: Actor) {
        const { filters = {} } = params;
        return this.model.countByFilters({ filters });
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
        params: DestinationFilterInput
    ): Promise<DestinationSearchForListOutput> {
        // Check permissions
        this._canSearch(actor);

        // Extract parameters
        const { filters = {}, pagination } = params;
        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 10;

        // Use the model method that includes attractions
        const result = await this.model.searchWithAttractions({
            filters,
            page,
            pageSize
        });

        // Map the result to the expected format
        const mappedItems = result.items.map((destination) => ({
            ...destination,
            attractions: destination.attractionNames
        }));

        return {
            items: mappedItems,
            total: result.total
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
    ): Promise<ServiceOutput<{ accommodations: AccommodationType[] }>> {
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
                const { items } = await this.accommodationModel.search({
                    filters: { destinationId }
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
                        averageRating: destination.averageRating ?? 0
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
    ): Promise<Partial<DestinationType>> {
        const slug = await generateDestinationSlug(data.name);
        return { slug };
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
            rating: DestinationRatingType | undefined;
        }
    ): Promise<void> {
        await this.model.updateById(destinationId, {
            reviewsCount: stats.reviewsCount,
            averageRating: stats.averageRating,
            rating: stats.rating as DestinationRatingType | undefined
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
