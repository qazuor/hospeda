import { EventLocationModel } from '@repo/db';
import { BaseCrudService, ServiceError } from '@repo/service-core';
import type { EventLocationType } from '@repo/types';
import { ServiceErrorCode } from '@repo/types';
import type { z } from 'zod';
import type { Actor, PaginatedListOutput, ServiceContext, ServiceLogger } from '../../types';
import { normalizeCreateInput, normalizeUpdateInput } from './eventLocation.normalizers';
import {
    checkCanCreateEventLocation,
    checkCanDeleteEventLocation,
    checkCanUpdateEventLocation
} from './eventLocation.permissions';
import {
    CreateEventLocationSchema,
    SearchEventLocationSchema,
    UpdateEventLocationSchema
} from './eventLocation.schemas';

type WhereWithOr = Record<string, unknown> & { or?: Array<Record<string, unknown>> };

/**
 * Service for managing event locations. Implements business logic, permissions, and hooks for EventLocation entities.
 * @extends BaseCrudService
 */
export class EventLocationService extends BaseCrudService<
    EventLocationType,
    EventLocationModel,
    typeof CreateEventLocationSchema,
    typeof UpdateEventLocationSchema,
    typeof SearchEventLocationSchema
> {
    static readonly ENTITY_NAME = 'eventLocation';
    protected readonly entityName = EventLocationService.ENTITY_NAME;
    protected readonly model: EventLocationModel;
    protected readonly logger: ServiceLogger;
    protected readonly createSchema = CreateEventLocationSchema;
    protected readonly updateSchema = UpdateEventLocationSchema;
    protected readonly searchSchema = SearchEventLocationSchema;
    protected normalizers = {
        create: normalizeCreateInput as (
            data: EventLocationType,
            actor: Actor
        ) => EventLocationType,
        update: normalizeUpdateInput as (
            data: z.infer<typeof UpdateEventLocationSchema>,
            actor: Actor
        ) => z.infer<typeof UpdateEventLocationSchema>
    };

    constructor(ctx: ServiceContext, model?: EventLocationModel) {
        super(ctx, EventLocationService.ENTITY_NAME);
        this.logger = ctx.logger;
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
        params: z.infer<typeof SearchEventLocationSchema>,
        _actor: Actor
    ): Promise<PaginatedListOutput<EventLocationType>> {
        try {
            const { filters = {}, page = 1, pageSize = 20 } = params;
            const where: WhereWithOr = {};
            if (filters.city) where.city = filters.city;
            if (filters.state) where.state = filters.state;
            if (filters.country) where.country = filters.country;
            // Free text search (q): busca en city, state y country (case-insensitive)
            if (filters.q) {
                where.or = [
                    { city: { $ilike: `%${filters.q}%` } },
                    { state: { $ilike: `%${filters.q}%` } },
                    { country: { $ilike: `%${filters.q}%` } }
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
        params: z.infer<typeof SearchEventLocationSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        try {
            const { filters = {} } = params;
            const where: WhereWithOr = {};
            if (filters.city) where.city = filters.city;
            if (filters.state) where.state = filters.state;
            if (filters.country) where.country = filters.country;
            if (filters.q) {
                where.or = [
                    { city: { $ilike: `%${filters.q}%` } },
                    { state: { $ilike: `%${filters.q}%` } },
                    { country: { $ilike: `%${filters.q}%` } }
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
}
