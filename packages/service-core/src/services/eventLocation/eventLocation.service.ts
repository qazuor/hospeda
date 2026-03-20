import { EventLocationModel, EventModel } from '@repo/db';
import type { EventLocation, EventLocationSearchInput } from '@repo/schemas';
import {
    EventLocationAdminSearchSchema,
    EventLocationCreateInputSchema,
    EventLocationSearchInputSchema,
    EventLocationUpdateInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { BaseCrudService } from '../../base';
import type { Actor, PaginatedListOutput, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { normalizeCreateInput, normalizeUpdateInput } from './eventLocation.normalizers';
import {
    checkCanCreateEventLocation,
    checkCanDeleteEventLocation,
    checkCanUpdateEventLocation
} from './eventLocation.permissions';

type WhereWithOr = Record<string, unknown> & { or?: Array<Record<string, unknown>> };

/**
 * Service for managing event locations. Implements business logic, permissions, and hooks for EventLocation entities.
 * @extends BaseCrudService
 */
export class EventLocationService extends BaseCrudService<
    EventLocation,
    EventLocationModel,
    typeof EventLocationCreateInputSchema,
    typeof EventLocationUpdateInputSchema,
    typeof EventLocationSearchInputSchema
> {
    static readonly ENTITY_NAME = 'eventLocation';
    protected readonly entityName = EventLocationService.ENTITY_NAME;
    protected readonly model: EventLocationModel;

    protected readonly createSchema = EventLocationCreateInputSchema;
    protected readonly updateSchema = EventLocationUpdateInputSchema;
    protected readonly searchSchema = EventLocationSearchInputSchema;

    protected getDefaultListRelations() {
        return undefined;
    }
    protected normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    constructor(ctx: ServiceContext, model?: EventLocationModel) {
        super(ctx, EventLocationService.ENTITY_NAME);
        this.model = model ?? new EventLocationModel();
        this.adminSearchSchema = EventLocationAdminSearchSchema;
    }

    /**
     * Permission: Only users with EVENT_LOCATION_UPDATE can create.
     */
    protected _canCreate(actor: Actor): void {
        checkCanCreateEventLocation(actor);
    }

    /**
     * Permission: Only users with EVENT_LOCATION_UPDATE can update.
     */
    protected _canUpdate(actor: Actor): void {
        checkCanUpdateEventLocation(actor);
    }

    /**
     * Permission: Only users with EVENT_LOCATION_UPDATE can delete.
     */
    protected _canSoftDelete(actor: Actor): void {
        checkCanDeleteEventLocation(actor);
    }

    protected _canHardDelete(actor: Actor): void {
        checkCanDeleteEventLocation(actor);
    }

    protected _canRestore(actor: Actor): void {
        checkCanUpdateEventLocation(actor);
    }

    protected _canView(actor: Actor): void {
        if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    }

    protected _canList(actor: Actor): void {
        if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    }

    protected _canSearch(actor: Actor): void {
        if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    }

    protected _canCount(actor: Actor): void {
        if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    }

    protected _canUpdateVisibility(actor: Actor): void {
        if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    }

    protected async _executeSearch(
        params: EventLocationSearchInput,
        _actor: Actor
    ): Promise<PaginatedListOutput<EventLocation>> {
        try {
            const {
                page = 1,
                pageSize = 20,
                sortBy,
                sortOrder,
                q,
                city,
                state,
                country,
                ...otherFilters
            } = params;
            const where: WhereWithOr = { ...otherFilters };
            if (city) where.city = city;
            if (state) where.state = state;
            if (country) where.country = country;
            // Free text search (q): busca en city, state y country (case-insensitive)
            if (q) {
                where.or = [
                    { city: { $ilike: `%${q}%` } },
                    { state: { $ilike: `%${q}%` } },
                    { country: { $ilike: `%${q}%` } }
                ];
            }
            return await this.model.findAll(where, { page, pageSize });
        } catch {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'An unexpected error occurred.'
            );
        }
    }

    protected async _executeCount(
        params: EventLocationSearchInput,
        _actor: Actor
    ): Promise<{ count: number }> {
        try {
            const { q, city, state, country, page, pageSize, sortBy, sortOrder, ...otherFilters } =
                params;
            const where: WhereWithOr = { ...otherFilters };
            if (city) where.city = city;
            if (state) where.state = state;
            if (country) where.country = country;
            if (q) {
                where.or = [
                    { city: { $ilike: `%${q}%` } },
                    { state: { $ilike: `%${q}%` } },
                    { country: { $ilike: `%${q}%` } }
                ];
            }
            const count = await this.model.count(where);
            return { count };
        } catch {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'An unexpected error occurred.'
            );
        }
    }

    /**
     * Searches for event locations for list display.
     * @param actor - The actor performing the action
     * @param params - The search parameters
     * @returns Event locations list
     */
    public async searchForList(
        actor: Actor,
        params: EventLocationSearchInput
    ): Promise<{ items: EventLocation[]; total: number }> {
        this._canSearch(actor);
        const { page = 1, pageSize = 10, q, city, state, country, ...otherFilters } = params;

        const where: Record<string, unknown> = { ...otherFilters };

        if (city) {
            where.city = { $ilike: `%${city}%` };
        }
        if (state) {
            where.state = { $ilike: `%${state}%` };
        }
        if (country) {
            where.country = { $ilike: `%${country}%` };
        }
        if (q) {
            where.$or = [
                { city: { $ilike: `%${q}%` } },
                { state: { $ilike: `%${q}%` } },
                { country: { $ilike: `%${q}%` } },
                { placeName: { $ilike: `%${q}%` } }
            ];
        }

        const result = await this.model.findAll(where, { page, pageSize });
        return {
            items: result.items,
            total: result.total
        };
    }

    /**
     * Find event locations by city.
     * Returns all locations in the specified city with pagination support.
     *
     * @param actor - The actor performing the action
     * @param city - The city name to filter by
     * @param options - Pagination options (optional)
     * @returns ServiceOutput with paginated list of event locations
     */
    public async findByCity(
        actor: Actor,
        city: string,
        options?: { page?: number; pageSize?: number }
    ): Promise<ServiceOutput<PaginatedListOutput<EventLocation>>> {
        // Check permissions
        this._canList(actor);

        try {
            const { page = 1, pageSize = 20 } = options || {};

            // Query locations by city
            const result = await this.model.findAll({ city }, { page, pageSize });

            return {
                data: result
            };
        } catch (error) {
            this.logger?.error(
                `Error finding event locations by city: ${city} - ${error instanceof Error ? error.message : String(error)}`
            );
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Failed to find event locations by city'
            );
        }
    }

    /**
     * Find event locations by country.
     * Returns all locations in the specified country with pagination support.
     *
     * @param actor - The actor performing the action
     * @param country - The country name to filter by
     * @param options - Pagination options (optional)
     * @returns ServiceOutput with paginated list of event locations
     */
    public async findByCountry(
        actor: Actor,
        country: string,
        options?: { page?: number; pageSize?: number }
    ): Promise<ServiceOutput<PaginatedListOutput<EventLocation>>> {
        // Check permissions
        this._canList(actor);

        try {
            const { page = 1, pageSize = 20 } = options || {};

            // Query locations by country
            const result = await this.model.findAll({ country }, { page, pageSize });

            return {
                data: result
            };
        } catch (error) {
            this.logger?.error(
                `Error finding event locations by country: ${country} - ${error instanceof Error ? error.message : String(error)}`
            );
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Failed to find event locations by country'
            );
        }
    }

    /**
     * Get statistics for an event location.
     * Returns aggregated information about the location including basic metadata.
     *
     * @param actor - The actor performing the action
     * @param id - The event location ID
     * @returns ServiceOutput with location statistics
     */
    public async getStats(
        actor: Actor,
        id: string
    ): Promise<
        ServiceOutput<{
            stats: {
                id: string;
                city: string | undefined;
                state: string | undefined;
                country: string | undefined;
                placeName: string | undefined;
                totalEvents: number;
            };
        }>
    > {
        // Check permissions
        this._canView(actor);

        try {
            // Find the location
            const location = await this.model.findById(id);

            if (!location) {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    `Event location with id '${id}' not found`
                );
            }

            // Count events associated with this location
            const eventModel = new EventModel();
            const totalEvents = await eventModel.count({ locationId: id, deletedAt: null });

            // Build stats object
            const stats = {
                id: location.id,
                city: location.city ?? undefined,
                state: location.state ?? undefined,
                country: location.country ?? undefined,
                placeName: location.placeName ?? undefined,
                totalEvents
            };

            return {
                data: { stats }
            };
        } catch (error) {
            if (error instanceof ServiceError) {
                throw error;
            }

            this.logger?.error(
                `Error getting event location stats: ${id} - ${error instanceof Error ? error.message : String(error)}`
            );
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Failed to get event location statistics'
            );
        }
    }
}
