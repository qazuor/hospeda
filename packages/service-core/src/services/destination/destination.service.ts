import { AccommodationModel, DestinationModel } from '@repo/db';
import {
    DestinationFilterInputSchema,
    DestinationSchema
} from '@repo/schemas/entities/destination/destination.schema';
import type { AccommodationType, DestinationType } from '@repo/types';
import { ServiceErrorCode } from '@repo/types';
import type { z } from 'zod';
import { BaseService } from '../../base/base.service';
import type {
    Actor,
    ServiceContext,
    ServiceInput,
    ServiceLogger,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
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
import type {
    DestinationStats,
    DestinationSummaryType,
    GetAccommodationsInput,
    GetStatsInput,
    GetSummaryInput
} from './destination.schemas';
import {
    GetAccommodationsInputSchema,
    GetStatsInputSchema,
    GetSummaryInputSchema
} from './destination.schemas';

/**
 * Service for domain-specific logic related to Destinations.
 * Inherits standard CRUD from BaseService. Only custom methods are defined here.
 */
export class DestinationService extends BaseService<
    DestinationType,
    DestinationModel,
    typeof DestinationSchema,
    typeof DestinationSchema,
    typeof DestinationFilterInputSchema
> {
    protected readonly entityName = 'destination';
    protected readonly model: DestinationModel;
    protected readonly logger: ServiceLogger;
    protected readonly createSchema = DestinationSchema;
    protected readonly updateSchema = DestinationSchema;
    protected readonly searchSchema = DestinationFilterInputSchema;
    protected normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput,
        list: normalizeListInput,
        view: normalizeViewInput
    };
    private readonly accommodationModel: AccommodationModel = new AccommodationModel();

    constructor(ctx: ServiceContext, model?: DestinationModel) {
        super();
        this.logger = ctx.logger;
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

    // --- Métodos abstractos requeridos por BaseService ---
    /**
     * Executes a paginated search for destinations using provided filters and pagination options.
     * @param params - Validated search parameters (filters, pagination, etc.)
     * @param _actor - The actor performing the search (not used here)
     * @returns A paginated list of destinations matching the filters
     */
    protected async _executeSearch(
        params: z.infer<typeof DestinationFilterInputSchema>,
        _actor: Actor
    ) {
        // Build filters and pagination
        const { state, city, country, tags, visibility, isFeatured, q } = params;
        const filters: Record<string, unknown> = {};
        if (state) filters.state = state;
        if (city) filters.city = city;
        if (country) filters.country = country;
        if (tags) filters.tags = tags;
        if (visibility) filters.visibility = visibility;
        if (isFeatured !== undefined) filters.isFeatured = isFeatured;
        if (q) filters.q = q;
        // Default order and pagination
        const orderBy: Record<string, 'asc' | 'desc'> = { name: 'asc' };
        const page = 1;
        const pageSize = 20;
        return this.model.search({ filters, orderBy, page, pageSize });
    }

    /**
     * Counts destinations matching the provided filters.
     * @param params - Validated filter parameters
     * @param _actor - The actor performing the count (not used here)
     * @returns An object with the total count
     */
    protected async _executeCount(
        params: z.infer<typeof DestinationFilterInputSchema>,
        _actor: Actor
    ) {
        const { state, city, country, tags, visibility, isFeatured, q } = params;
        const filters: Record<string, unknown> = {};
        if (state) filters.state = state;
        if (city) filters.city = city;
        if (country) filters.country = country;
        if (tags) filters.tags = tags;
        if (visibility) filters.visibility = visibility;
        if (isFeatured !== undefined) filters.isFeatured = isFeatured;
        if (q) filters.q = q;
        return this.model.countByFilters({ filters });
    }

    // --- Métodos específicos de dominio ---
    /**
     * Returns all accommodations for a given destination.
     * @param input - ServiceInput containing actor and input object with destinationId
     * @returns ServiceOutput with accommodations array or error
     */
    public async getAccommodations(
        input: ServiceInput<GetAccommodationsInput>
    ): Promise<ServiceOutput<{ accommodations: AccommodationType[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAccommodations',
            input,
            schema: GetAccommodationsInputSchema,
            execute: async (validData, _actor) => {
                const { destinationId } = validData;
                // 1. Validate destination existence
                const destination = await this.model.findById(destinationId);
                if (!destination) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Destination with id '${destinationId}' not found.`
                    );
                }
                // 2. Permission check (must be before fetching accommodations)
                try {
                    checkCanViewDestination(input.actor, destination);
                } catch (err) {
                    if (err instanceof ServiceError) return Promise.reject(err);
                    throw err;
                }
                // 3. Fetch accommodations
                const { items } = await this.accommodationModel.search({
                    filters: { destinationId }
                });
                return { accommodations: items };
            }
        });
    }

    /**
     * Returns aggregated stats for a destination (accommodations count, reviews count, average rating, etc.)
     * @param input - ServiceInput containing actor and input object with destinationId
     * @returns ServiceOutput with stats or error
     */
    public async getStats(
        input: ServiceInput<GetStatsInput>
    ): Promise<ServiceOutput<{ stats: DestinationStats }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getStats',
            input,
            schema: GetStatsInputSchema,
            execute: async (validData, _actor) => {
                const { destinationId } = validData;
                // 1. Validate destination existence
                const destination = await this.model.findById(destinationId);
                if (!destination) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Destination with id '${destinationId}' not found.`
                    );
                }
                // 2. Permission check
                try {
                    checkCanViewDestination(input.actor, destination);
                } catch (err) {
                    if (err instanceof ServiceError) return Promise.reject(err);
                    throw err;
                }
                // 3. Return stats from destination fields
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
     * @param input - ServiceInput containing actor and input object with destinationId
     * @returns ServiceOutput with summary or error
     */
    public async getSummary(
        input: ServiceInput<GetSummaryInput>
    ): Promise<ServiceOutput<{ summary: DestinationSummaryType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getSummary',
            input,
            schema: GetSummaryInputSchema,
            execute: async (validData, _actor) => {
                const { destinationId } = validData;
                // 1. Validate destination existence
                const destination = await this.model.findById(destinationId);
                if (!destination) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Destination with id '${destinationId}' not found.`
                    );
                }
                // 2. Permission check
                try {
                    checkCanViewDestination(input.actor, destination);
                } catch (err) {
                    if (err instanceof ServiceError) return Promise.reject(err);
                    throw err;
                }
                if (!destination.location) {
                    this.logger.warn(`Destination ${destination.id} has no location for summary.`);
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Destination location not found.'
                    );
                }
                // 3. Build and return the summary DTO
                const summary: DestinationSummaryType = {
                    id: destination.id,
                    slug: destination.slug,
                    name: destination.name,
                    country: destination.location.country,
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
        data: z.infer<typeof DestinationSchema>,
        _actor: Actor
    ): Promise<Partial<DestinationType>> {
        const slug = await generateDestinationSlug(data.name);
        return { slug };
    }
}
