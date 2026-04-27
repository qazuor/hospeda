import { EventLocationModel, EventModel, eventLocations, or, safeIlike } from '@repo/db';
import type { EventLocation, EventLocationSearchInput } from '@repo/schemas';
import {
    EventLocationAdminSearchSchema,
    EventLocationCreateInputSchema,
    EventLocationSearchInputSchema,
    EventLocationUpdateInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { BaseCrudService } from '../../base';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import type {
    Actor,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import { normalizeCreateInput, normalizeUpdateInput } from './eventLocation.normalizers';
import {
    checkCanAdminList,
    checkCanCreateEventLocation,
    checkCanDeleteEventLocation,
    checkCanUpdateEventLocation
} from './eventLocation.permissions';

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

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Event locations are searched by place name and city.
     */
    protected override getSearchableColumns(): string[] {
        return ['placeName', 'street'];
    }

    protected normalizers: CrudNormalizersFromSchemas<
        typeof EventLocationCreateInputSchema,
        typeof EventLocationUpdateInputSchema,
        typeof EventLocationSearchInputSchema
    > = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    constructor(ctx: ServiceConfig, model?: EventLocationModel) {
        super(ctx, EventLocationService.ENTITY_NAME);
        this.model = model ?? new EventLocationModel();
        /** Uses default _executeAdminSearch() - all filter fields map directly to table columns. */
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
    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks entity-specific permission.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }

    protected async _executeSearch(
        params: EventLocationSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<EventLocation>> {
        try {
            const {
                page = 1,
                pageSize = 20,
                sortBy,
                sortOrder,
                q,
                destinationId,
                ...otherFilters
            } = params;
            const where: Record<string, unknown> = { ...otherFilters };
            if (destinationId) where.destinationId = destinationId;

            const additionalConditions: SQL[] = [];
            if (q) {
                const orCondition = or(
                    safeIlike(eventLocations.placeName, q),
                    safeIlike(eventLocations.street, q)
                );
                if (orCondition) additionalConditions.push(orCondition);
            }
            return await this.model.findAll(
                where,
                { page, pageSize, sortBy, sortOrder },
                additionalConditions
            );
        } catch {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'An unexpected error occurred.'
            );
        }
    }

    protected async _executeCount(
        params: EventLocationSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        try {
            const {
                q,
                destinationId,
                page: _page,
                pageSize: _pageSize,
                sortBy: _sortBy,
                sortOrder: _sortOrder,
                ...otherFilters
            } = params;
            const where: Record<string, unknown> = { ...otherFilters };
            if (destinationId) where.destinationId = destinationId;

            const additionalConditions: SQL[] = [];
            if (q) {
                const orCondition = or(
                    safeIlike(eventLocations.placeName, q),
                    safeIlike(eventLocations.street, q)
                );
                if (orCondition) additionalConditions.push(orCondition);
            }
            const count = await this.model.count(where, { additionalConditions });
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
     * @param ctx - Optional service context (transaction, hook state)
     * @returns Event locations list
     */
    public async searchForList(
        actor: Actor,
        params: EventLocationSearchInput,
        ctx?: ServiceContext
    ): Promise<{ items: EventLocation[]; total: number }> {
        await this._canSearch(actor);
        const {
            page = 1,
            pageSize = 10,
            q,
            destinationId,
            sortBy,
            sortOrder,
            ...otherFilters
        } = params;

        const where: Record<string, unknown> = { ...otherFilters };
        const additionalConditions: SQL[] = [];

        if (destinationId) {
            where.destinationId = destinationId;
        }
        if (q) {
            const orCondition = or(
                safeIlike(eventLocations.placeName, q),
                safeIlike(eventLocations.street, q)
            );
            if (orCondition) additionalConditions.push(orCondition);
        }

        const result = await this.model.findAll(
            where,
            { page, pageSize, sortBy, sortOrder },
            additionalConditions,
            ctx?.tx
        );
        return {
            items: result.items,
            total: result.total
        };
    }

    /**
     * Find event locations by destination.
     * Returns all locations under the given destinationId with pagination.
     *
     * @param actor - The actor performing the action
     * @param destinationId - The destination UUID to filter by
     * @param options - Pagination options (optional)
     * @param ctx - Optional service context (transaction, hook state)
     * @returns ServiceOutput with paginated list of event locations
     */
    public async findByDestination(
        actor: Actor,
        destinationId: string,
        options?: { page?: number; pageSize?: number },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PaginatedListOutput<EventLocation>>> {
        // Check permissions
        await this._canList(actor);

        try {
            const { page = 1, pageSize = 20 } = options || {};

            const result = await this.model.findAll(
                { destinationId },
                { page, pageSize },
                undefined,
                ctx?.tx
            );

            return {
                data: result
            };
        } catch (error) {
            this.logger?.error(
                `Error finding event locations by destinationId: ${destinationId} - ${error instanceof Error ? error.message : String(error)}`
            );
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Failed to find event locations by destination'
            );
        }
    }

    /**
     * Get statistics for an event location.
     * Returns aggregated information about the location including basic metadata.
     *
     * @param actor - The actor performing the action
     * @param id - The event location ID
     * @param ctx - Optional service context (transaction, hook state)
     * @returns ServiceOutput with location statistics
     */
    public async getStats(
        actor: Actor,
        id: string,
        ctx?: ServiceContext
    ): Promise<
        ServiceOutput<{
            stats: {
                id: string;
                destinationId: string;
                placeName: string | undefined;
                totalEvents: number;
            };
        }>
    > {
        // Check permissions
        await this._canView(actor);

        try {
            // Find the location
            const location = await this.model.findById(id, ctx?.tx);

            if (!location) {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    `Event location with id '${id}' not found`
                );
            }

            // Count events associated with this location
            const eventModel = new EventModel();
            const totalEvents = await eventModel.count(
                { locationId: id, deletedAt: null },
                { tx: ctx?.tx }
            );

            // Build stats object
            const stats = {
                id: location.id,
                destinationId: location.destinationId,
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
