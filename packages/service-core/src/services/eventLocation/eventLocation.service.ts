import { EventLocationModel } from '@repo/db';
import type { EventLocation, EventLocationSearchInput } from '@repo/schemas';
import {
    EventLocationCreateInputSchema,
    EventLocationSearchInputSchema,
    EventLocationUpdateInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { BaseCrudService } from '../../base';
import type { Actor, PaginatedListOutput, ServiceContext } from '../../types';
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
    protected normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    constructor(ctx: ServiceContext, model?: EventLocationModel) {
        super(ctx, EventLocationService.ENTITY_NAME);
        this.model = model ?? new EventLocationModel();
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
            const { filters = {}, page = 1, pageSize = 20, q } = params;
            const where: WhereWithOr = {};
            if (filters.city) where.city = filters.city;
            if (filters.state) where.state = filters.state;
            if (filters.country) where.country = filters.country;
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
            const { filters = {}, q } = params;
            const where: WhereWithOr = {};
            if (filters.city) where.city = filters.city;
            if (filters.state) where.state = filters.state;
            if (filters.country) where.country = filters.country;
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
        const { filters = {}, page = 1, pageSize = 10, q } = params;

        const where: Record<string, unknown> = {};

        if (filters.city) {
            where.city = { $ilike: `%${filters.city}%` };
        }
        if (filters.state) {
            where.state = { $ilike: `%${filters.state}%` };
        }
        if (filters.country) {
            where.country = { $ilike: `%${filters.country}%` };
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
}
