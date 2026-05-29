import {
    DestinationModel,
    EventLocationModel,
    EventModel,
    eventLocations,
    or,
    safeIlike
} from '@repo/db';
import type {
    EntityOptionsItem,
    EventLocation,
    EventLocationCreateInput,
    EventLocationSearchInput,
    EventLocationUpdateInput
} from '@repo/schemas';
import {
    DestinationTypeEnum,
    EventLocationAdminSearchSchema,
    EventLocationCreateInputSchema,
    EventLocationSearchInputSchema,
    EventLocationUpdateInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { z } from 'zod';
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
import { checkCanFindOptions } from '../../utils';
import { normalizeCreateInput, normalizeUpdateInput } from './eventLocation.normalizers';
import {
    checkCanAdminList,
    checkCanCreateEventLocation,
    checkCanDeleteEventLocation,
    checkCanUpdateEventLocation
} from './eventLocation.permissions';
import {
    projectEventLocationCityDestination,
    projectEventLocationCityDestinationList
} from './eventLocation.projections';

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

    /**
     * Eager-load the destination relation so responses can project a
     * `cityDestination` field without an N+1 lookup (SPEC-095).
     */
    protected getDefaultListRelations() {
        return { destination: true };
    }

    /**
     * Same destination eager-load for getById/getBySlug.
     */
    protected override getDefaultGetByIdRelations() {
        return { destination: true };
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

    /**
     * Destination model used directly in lifecycle hooks to validate that
     * `destinationId` resolves to a destination of type `CITY` (SPEC-095).
     */
    private readonly _destinationModel: DestinationModel;

    constructor(ctx: ServiceConfig, model?: EventLocationModel) {
        super(ctx, EventLocationService.ENTITY_NAME);
        this.model = model ?? new EventLocationModel();
        this._destinationModel = new DestinationModel();
        /** Uses default _executeAdminSearch() - all filter fields map directly to table columns. */
        this.adminSearchSchema = EventLocationAdminSearchSchema;
    }

    /**
     * Lightweight relation-selector lookup (SPEC-169 §5.5 / decision D4).
     *
     * Returns minimal `{ id, label, slug }` items for populating admin relation selectors
     * WITHOUT requiring a broad view grant. Gating is admin-panel access only (see
     * {@link checkCanFindOptions}); the route mirrors this with an `ACCESS_PANEL_ADMIN`-only
     * middleware gate.
     *
     * Event locations have NO dedicated `name` column — their display name is `placeName`
     * (e.g. "Teatro Municipal"), which is NULLABLE (SPEC-169 §12 flag: see T-018 report).
     * `label` therefore falls back to the (always-present) `slug` when `placeName` is null,
     * so the selector never shows an empty label. The search term matches `placeName`.
     *
     * Results are DRAFT-inclusive (the model's `findAll` only excludes soft-deleted rows,
     * never publication state) so relations can target unpublished locations.
     *
     * @param actor - The actor performing the lookup (must hold admin-panel access).
     * @param params - `{ q?: string, limit?: number }` — optional search term + result cap.
     * @param ctx - Optional service context (transaction).
     * @returns A `ServiceOutput` with `{ items }` of event location options.
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
                const additionalConditions: SQL[] =
                    trimmedQ && trimmedQ.length > 0
                        ? [safeIlike(eventLocations.placeName, trimmedQ)]
                        : [];

                const { items } = await this.model.findAll(
                    {},
                    { page: 1, pageSize: validatedInput.limit },
                    additionalConditions,
                    execCtx?.tx
                );

                const options: EntityOptionsItem[] = items.map((item) => ({
                    id: item.id,
                    label: item.placeName ?? item.slug,
                    slug: item.slug
                }));

                return { items: options };
            }
        });
    }

    /**
     * SPEC-095: enforce that `destinationId` resolves to a destination of
     * type `CITY`. Province- or higher-level destinations are too coarse;
     * neighborhood-/town-level destinations should resolve up to the CITY
     * ancestor before being assigned.
     */
    private async _assertDestinationIsCity(destinationId: string | undefined): Promise<void> {
        if (!destinationId) return;
        const destination = await this._destinationModel.findById(destinationId);
        if (!destination) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `Destination ${destinationId} does not exist`
            );
        }
        if (destination.destinationType !== DestinationTypeEnum.CITY) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'destinationId must reference a destination of type CITY'
            );
        }
    }

    /**
     * Validates the destination FK before creating an event location.
     */
    protected async _beforeCreate(
        data: EventLocationCreateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<EventLocation>> {
        await this._assertDestinationIsCity(data.destinationId);
        return {};
    }

    /**
     * Validates the destination FK if it is part of an update payload.
     */
    protected async _beforeUpdate(
        data: EventLocationUpdateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<EventLocation>> {
        if (data.destinationId) {
            await this._assertDestinationIsCity(data.destinationId);
        }
        return data as Partial<EventLocation>;
    }

    /**
     * SPEC-095: project the eager-loaded destination relation into a
     * lightweight `cityDestination` field so the API response-schema parse
     * picks it up.
     */
    protected override async _afterGetByField(
        entity: EventLocation | null,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<EventLocation | null> {
        return projectEventLocationCityDestination(entity);
    }

    protected override async _afterList(
        result: PaginatedListOutput<EventLocation>,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<EventLocation>> {
        if (!result?.items) return result;
        return {
            ...result,
            items: projectEventLocationCityDestinationList(result.items)
        };
    }

    protected override async _afterSearch(
        result: PaginatedListOutput<EventLocation>,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<EventLocation>> {
        if (!result?.items) return result;
        return {
            ...result,
            items: projectEventLocationCityDestinationList(result.items)
        };
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
