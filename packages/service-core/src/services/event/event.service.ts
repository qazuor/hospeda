import { EventModel, events as eventTable } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { ImageProvider } from '@repo/media';
import { resolveEnvironment } from '@repo/media';
import type {
    Event,
    EventByAuthorInput,
    EventByCategoryInput,
    EventByLocationInput,
    EventByOrganizerInput,
    EventCreateInput,
    EventFreeInput,
    EventSearchInput,
    EventSummaryInput,
    EventSummaryOutput,
    EventUpcomingInput,
    EventUpdateInput
} from '@repo/schemas';
import {
    type EntityFilters,
    EventAdminSearchSchema,
    EventByAuthorInputSchema,
    EventByCategoryInputSchema,
    EventByLocationInputSchema,
    EventByOrganizerInputSchema,
    EventCreateInputSchema,
    EventFreeInputSchema,
    EventSearchInputSchema,
    EventSummaryInputSchema,
    EventUpcomingInputSchema,
    EventUpdateInputSchema,
    PermissionEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { BaseCrudService } from '../../base/base.crud.service';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import type {
    AdminSearchExecuteParams,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { type Actor, ServiceError } from '../../types';
import { generateEventSlug } from './event.helpers';
import { normalizeCreateInput, normalizeUpdateInput } from './event.normalizers';
import {
    checkCanAdminList,
    checkCanCreateEvent,
    checkCanDeleteEvent,
    checkCanHardDeleteEvent,
    checkCanListEvents,
    checkCanRestoreEvent,
    checkCanUpdateEvent,
    checkCanViewEvent
} from './event.permissions';
import type { EventHookState } from './event.types';

/** Entity-specific filter fields for event admin search. */
type EventEntityFilters = EntityFilters<typeof EventAdminSearchSchema>;

/**
 * Service for managing events.
 * Provides CRUD operations, search, and permission/lifecycle hooks for Event entities.
 * Extends BaseCrudService for homogeneous validation, error handling, and logging.
 */
export class EventService extends BaseCrudService<
    Event,
    EventModel,
    typeof EventCreateInputSchema,
    typeof EventUpdateInputSchema,
    typeof EventSearchInputSchema
> {
    static readonly ENTITY_NAME = 'event';
    protected readonly entityName = EventService.ENTITY_NAME;
    private static readonly revalidationLogger = createLogger('event-revalidation');
    protected readonly model: EventModel;

    protected readonly createSchema = EventCreateInputSchema;
    protected readonly updateSchema = EventUpdateInputSchema;
    protected readonly searchSchema = EventSearchInputSchema;

    protected getDefaultListRelations() {
        return { organizer: true, location: true };
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Events are searched by name and description.
     */
    protected override getSearchableColumns(): string[] {
        return ['name', 'description'];
    }

    /**
     * Optional Cloudinary media provider for asset cleanup on hard delete.
     * When null, media cleanup is skipped (Cloudinary not configured).
     */
    private readonly mediaProvider: ImageProvider | null;

    /**
     * Initializes a new instance of the EventService.
     * @param ctx - The service context, containing the logger and optional model.
     * @param mediaProvider - Optional ImageProvider for Cloudinary cleanup on hard delete.
     */
    constructor(ctx: ServiceConfig & { model?: EventModel }, mediaProvider?: ImageProvider | null) {
        super(ctx, EventService.ENTITY_NAME);
        this.model = ctx.model ?? new EventModel();
        this.adminSearchSchema = EventAdminSearchSchema;
        this.mediaProvider = mediaProvider ?? null;
    }

    /**
     * Permission hook: checks if the actor can create an event.
     */
    protected _canCreate(actor: Actor, _data: EventCreateInput): void {
        checkCanCreateEvent(actor);
    }

    /**
     * Permission hook: checks if the actor can update an event.
     */
    protected _canUpdate(actor: Actor, _entity: Event): void {
        checkCanUpdateEvent(actor);
    }

    /**
     * Permission hook: checks if the actor can soft-delete an event.
     */
    protected _canSoftDelete(actor: Actor, _entity: Event): void {
        checkCanDeleteEvent(actor);
    }

    /**
     * Permission hook: checks if the actor can hard-delete an event.
     */
    protected _canHardDelete(actor: Actor, _entity: Event): void {
        checkCanHardDeleteEvent(actor);
    }

    /**
     * Permission hook: checks if the actor can restore an event.
     */
    protected _canRestore(actor: Actor, _entity: Event): void {
        checkCanRestoreEvent(actor);
    }

    /**
     * Permission hook: checks if the actor can view an event.
     */
    protected _canView(actor: Actor, entity: Event): void {
        checkCanViewEvent(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can list events.
     */
    protected _canList(actor: Actor): void {
        checkCanListEvents(actor);
    }

    /**
     * Permission hook: checks if the actor can search events.
     */
    protected _canSearch(actor: Actor): void {
        checkCanListEvents(actor);
    }

    /**
     * Permission hook: checks if the actor can count events.
     */
    protected _canCount(actor: Actor): void {
        checkCanListEvents(actor);
    }

    /**
     * Permission hook: checks if the actor can update the visibility of an event.
     * @param actor - The actor performing the action
     * @param entity - The event entity
     * @param newVisibility - The new visibility value
     */
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: Event,
        _newVisibility: VisibilityEnum
    ): void {
        checkCanUpdateEvent(actor);
    }
    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks entity-specific permission.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }
    /**
     * Lifecycle hook: normalizes input before creating an event and generates slug.
     */
    protected async _beforeCreate(
        input: EventCreateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<Event>> {
        const normalized = await normalizeCreateInput(input);

        // Only generate a slug if one is not already provided
        if (!normalized.slug) {
            // Ensure all required fields are present for slug generation
            if (!normalized.category || !normalized.name || !normalized.date?.start) {
                throw new Error(
                    'Missing required fields for slug generation: category, name, or date.start'
                );
            }
            const slug = await generateEventSlug(
                String(normalized.category),
                normalized.name,
                normalized.date.start
            );
            return { ...normalized, slug };
        }

        return normalized;
    }

    /**
     * Lifecycle hook: normalizes input before updating an event and updates slug if relevant fields change.
     */
    protected async _beforeUpdate(
        input: EventUpdateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<Event>> {
        const normalized = await normalizeUpdateInput(input);
        // If category, name, or date.start is present in update, regenerate slug
        if (
            normalized.category !== undefined ||
            normalized.name !== undefined ||
            (normalized.date && normalized.date.start !== undefined)
        ) {
            const category = String(normalized.category ?? input.category);
            const name = normalized.name ?? input.name;
            const dateStart = normalized.date?.start ?? input.date?.start;
            if (!category || !name || !dateStart) {
                throw new Error(
                    'Missing required fields for slug generation: category, name, or date.start'
                );
            }
            const slug = await generateEventSlug(category, name, dateStart);
            return { ...normalized, slug };
        }
        return normalized;
    }

    protected async _afterCreate(
        entity: Event,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Event> {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'event',
                slug: entity.slug,
                category: entity.category?.toLowerCase()
            });
        } catch (error) {
            EventService.revalidationLogger.warn(
                { error, entityType: 'event' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return entity;
    }

    protected async _afterUpdate(
        entity: Event,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Event> {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'event',
                slug: entity.slug,
                category: entity.category?.toLowerCase()
            });
        } catch (error) {
            EventService.revalidationLogger.warn(
                { error, entityType: 'event' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return entity;
    }

    protected async _afterUpdateVisibility(
        entity: Event,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Event> {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'event',
                slug: entity.slug,
                category: entity.category?.toLowerCase()
            });
        } catch (error) {
            EventService.revalidationLogger.warn(
                { error, entityType: 'event' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return entity;
    }

    protected async _beforeRestore(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<EventHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id);
        if (entity && ctx.hookState) {
            ctx.hookState.restoredEvent = {
                slug: entity.slug,
                category: entity.category
            };
        }
        return id;
    }

    protected async _afterRestore(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<EventHookState>
    ): Promise<{ count: number }> {
        const restored = ctx.hookState?.restoredEvent;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'event',
                slug: restored?.slug,
                category: restored?.category?.toLowerCase()
            });
        } catch (error) {
            EventService.revalidationLogger.warn(
                { error, entityType: 'event' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return result;
    }

    protected async _beforeSoftDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<EventHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id);
        if (entity && ctx.hookState) {
            ctx.hookState.deletedEvent = { slug: entity.slug, category: entity.category };
        }
        return id;
    }

    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<EventHookState>
    ): Promise<{ count: number }> {
        const deleted = ctx.hookState?.deletedEvent;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'event',
                slug: deleted?.slug,
                category: deleted?.category?.toLowerCase()
            });
        } catch (error) {
            EventService.revalidationLogger.warn(
                { error, entityType: 'event' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return result;
    }

    protected async _beforeHardDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<EventHookState>
    ): Promise<string> {
        const entity = await this.model.findById(id);
        if (entity && ctx.hookState) {
            ctx.hookState.deletedEvent = { slug: entity.slug, category: entity.category };
            ctx.hookState.deletedEntityId = id;
        }
        return id;
    }

    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<EventHookState>
    ): Promise<{ count: number }> {
        const deleted = ctx.hookState?.deletedEvent;
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'event',
                slug: deleted?.slug,
                category: deleted?.category?.toLowerCase()
            });
        } catch (error) {
            EventService.revalidationLogger.warn(
                { error, entityType: 'event' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        // Best-effort Cloudinary cleanup after confirmed hard delete
        if (result.count > 0 && ctx.hookState?.deletedEntityId && this.mediaProvider) {
            const env = resolveEnvironment();
            const prefix = `hospeda/${env}/events/${ctx.hookState.deletedEntityId}/`;
            try {
                await this.mediaProvider.deleteByPrefix({ prefix });
            } catch (mediaError) {
                EventService.revalidationLogger.warn(
                    { error: mediaError, prefix },
                    '[media] Failed to clean up Cloudinary assets for event'
                );
            }
        }
        return result;
    }

    /**
     * Executes admin search for events with JSONB date filters.
     *
     * Extracts date range filters (startDateAfter, startDateBefore, endDateAfter, endDateBefore)
     * from entity filters and converts them into raw SQL conditions against the JSONB `date` column.
     * The JSONB column uses `start` and `end` keys as defined by EventDateSchema.
     *
     * @param params - The assembled admin search parameters from the base class.
     * @returns A paginated list of events matching the criteria.
     */
    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams<EventEntityFilters>
    ): Promise<PaginatedListOutput<Event>> {
        const { entityFilters, ...rest } = params;
        const { startDateAfter, startDateBefore, endDateAfter, endDateBefore, ...simpleFilters } =
            entityFilters;

        const extraConditions: SQL[] = [...(params.extraConditions ?? [])];

        // JSONB date extraction - EventDateSchema uses 'start' and 'end' keys
        if (startDateAfter) {
            extraConditions.push(
                sql`(${eventTable.date}->>'start')::timestamptz >= ${startDateAfter}`
            );
        }
        if (startDateBefore) {
            extraConditions.push(
                sql`(${eventTable.date}->>'start')::timestamptz <= ${startDateBefore}`
            );
        }
        if (endDateAfter) {
            extraConditions.push(sql`(${eventTable.date}->>'end')::timestamptz >= ${endDateAfter}`);
        }
        if (endDateBefore) {
            extraConditions.push(
                sql`(${eventTable.date}->>'end')::timestamptz <= ${endDateBefore}`
            );
        }

        return super._executeAdminSearch({
            ...rest,
            entityFilters: simpleFilters,
            extraConditions
        });
    }

    /**
     * Executes the search for events.
     * @param params - The validated search parameters
     * @param _actor - The actor performing the search
     * @returns Paginated list of events matching the criteria
     */
    protected async _executeSearch(params: EventSearchInput, _actor: Actor, _ctx: ServiceContext) {
        // NOTE: destinationId is stripped — event_locations has no destinationId FK.
        // Until the DB schema is extended, this filter cannot be applied.
        const { page = 1, pageSize = 10, destinationId: _destinationId, ...filterParams } = params;
        return this.model.findAll(filterParams, { page, pageSize });
    }

    /**
     * Executes the count for events.
     * @param params - The validated search parameters
     * @param _actor - The actor performing the count
     * @returns Count of events matching the criteria
     */
    protected async _executeCount(params: EventSearchInput, _actor: Actor, _ctx: ServiceContext) {
        // NOTE: destinationId stripped for same reason as _executeSearch.
        const { destinationId: _destinationId, ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }

    /**
     * Returns a paginated list of events authored by a specific user.
     * - Any authenticated actor can see public events.
     * - Only actors with EVENT_SOFT_DELETE_VIEW can see private/draft events.
     * - Uses homogeneous validation and pagination logic.
     * @param actor - Authenticated actor
     * @param input - Search parameters (authorId, page, pageSize)
     * @returns Paginated list of events
     * @throws ServiceError (FORBIDDEN) if actor is undefined
     */
    public async getByAuthor(
        actor: Actor,
        input: EventByAuthorInput
    ): Promise<ServiceOutput<PaginatedListOutput<Event>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByAuthor',
            input: { ...input, actor },
            schema: EventByAuthorInputSchema,
            execute: async (validatedInput, validatedActor) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
                }
                const filters: Record<string, unknown> = { authorId: validatedInput.authorId };
                if (!validatedActor.permissions?.includes(PermissionEnum.EVENT_SOFT_DELETE_VIEW)) {
                    filters.visibility = VisibilityEnum.PUBLIC;
                }
                const page = validatedInput.page ?? 1;
                const pageSize = validatedInput.pageSize ?? 20;
                try {
                    return await this.model.findAll(filters, { page, pageSize });
                } catch (err) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, (err as Error).message);
                }
            }
        });
    }

    /**
     * Returns a paginated list of events at a specific location.
     * - Any authenticated actor can see public events.
     * - Only actors with EVENT_SOFT_DELETE_VIEW can see private/draft events.
     * - Uses homogeneous validation and pagination logic.
     * @param actor - Authenticated actor
     * @param input - Search parameters (locationId, page, pageSize)
     * @returns Paginated list of events
     * @throws ServiceError (UNAUTHORIZED) if actor is undefined
     */
    public async getByLocation(
        actor: Actor,
        input: EventByLocationInput
    ): Promise<ServiceOutput<PaginatedListOutput<Event>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByLocation',
            input: { ...input, actor },
            schema: EventByLocationInputSchema,
            execute: async (validatedInput, validatedActor) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
                }
                const filters: Record<string, unknown> = { locationId: validatedInput.locationId };
                if (!validatedActor.permissions?.includes(PermissionEnum.EVENT_SOFT_DELETE_VIEW)) {
                    filters.visibility = VisibilityEnum.PUBLIC;
                }
                const page = validatedInput.page ?? 1;
                const pageSize = validatedInput.pageSize ?? 20;
                try {
                    return await this.model.findAll(filters, { page, pageSize });
                } catch (err) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, (err as Error).message);
                }
            }
        });
    }

    /**
     * Returns a paginated list of events organized by a specific organizer.
     * - Any authenticated actor can see public events.
     * - Only actors with EVENT_SOFT_DELETE_VIEW can see private/draft events.
     * - Uses homogeneous validation and pagination logic.
     * @param actor - Authenticated actor
     * @param input - Search parameters (organizerId, page, pageSize)
     * @returns Paginated list of events
     * @throws ServiceError (UNAUTHORIZED) if actor is undefined
     */
    public async getByOrganizer(
        actor: Actor,
        input: EventByOrganizerInput
    ): Promise<ServiceOutput<PaginatedListOutput<Event>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByOrganizer',
            input: { ...input, actor },
            schema: EventByOrganizerInputSchema,
            execute: async (validatedInput, validatedActor) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
                }
                const filters: Record<string, unknown> = {
                    organizerId: validatedInput.organizerId
                };
                if (!validatedActor.permissions?.includes(PermissionEnum.EVENT_SOFT_DELETE_VIEW)) {
                    filters.visibility = VisibilityEnum.PUBLIC;
                }
                const page = validatedInput.page ?? 1;
                const pageSize = validatedInput.pageSize ?? 20;
                try {
                    return await this.model.findAll(filters, { page, pageSize });
                } catch (err) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, (err as Error).message);
                }
            }
        });
    }

    /**
     * Returns a paginated list of upcoming events within a date range.
     * - Any authenticated actor can see public events.
     * - Only actors with EVENT_SOFT_DELETE_VIEW can see private/draft events.
     * - Uses homogeneous validation and pagination logic.
     * @param actor - Authenticated actor
     * @param input - Search parameters (fromDate, toDate, page, pageSize)
     * @returns Paginated list of events
     * @throws ServiceError (UNAUTHORIZED) if actor is undefined
     */
    public async getUpcoming(
        actor: Actor,
        input: EventUpcomingInput
    ): Promise<ServiceOutput<PaginatedListOutput<Event>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getUpcoming',
            input: { ...input, actor },
            schema: EventUpcomingInputSchema,
            execute: async (validatedInput, validatedActor) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
                }
                const filters: Record<string, unknown> = {};
                // Calculate the date range based on daysAhead
                const today = new Date();
                const futureDate = new Date();
                futureDate.setDate(today.getDate() + validatedInput.daysAhead);
                filters['date.start'] = {
                    $gte: today,
                    $lte: futureDate
                };

                // Add location filters if provided
                if (validatedInput.city) {
                    filters['location.city'] = validatedInput.city;
                }
                if (validatedInput.country) {
                    filters['location.country'] = validatedInput.country;
                }

                // Add category filter if provided
                if (validatedInput.category) {
                    filters.category = validatedInput.category;
                }

                // Add price filter if provided
                if (validatedInput.maxPrice) {
                    filters['pricing.basePrice'] = { $lte: validatedInput.maxPrice };
                }
                if (!validatedActor.permissions?.includes(PermissionEnum.EVENT_SOFT_DELETE_VIEW)) {
                    filters.visibility = VisibilityEnum.PUBLIC;
                }
                const page = validatedInput.page ?? 1;
                const pageSize = validatedInput.pageSize ?? 20;
                try {
                    return await this.model.findAll(filters, { page, pageSize });
                } catch (err) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, (err as Error).message);
                }
            }
        });
    }

    /**
     * Returns a summary of a specific event.
     * - Any authenticated actor can see public events.
     * - Only actors with EVENT_SOFT_DELETE_VIEW can see private/draft events.
     * - Uses homogeneous validation and error handling.
     * @param actor - Authenticated actor
     * @param input - Event id
     * @returns Event summary DTO
     * @throws ServiceError (UNAUTHORIZED) if actor is undefined
     * @throws ServiceError (NOT_FOUND) if event does not exist
     */
    public async getSummary(
        actor: Actor,
        input: EventSummaryInput
    ): Promise<ServiceOutput<EventSummaryOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getSummary',
            input: { ...input, actor },
            schema: EventSummaryInputSchema,
            execute: async (validatedInput, validatedActor) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
                }
                let event: Event | null;
                try {
                    event = await this.model.findById(validatedInput.eventId);
                } catch (err) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, (err as Error).message);
                }
                if (!event) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Event not found');
                }
                await this._canView(validatedActor, event);
                const summary = {
                    id: event.id,
                    slug: event.slug,
                    name: event.name,
                    summary: event.summary,
                    description: event.description,
                    category: event.category,
                    date: event.date,
                    pricing: event.pricing,
                    isFeatured: event.isFeatured,
                    createdAt: event.createdAt
                };
                return summary;
            }
        });
    }

    /**
     * Returns a paginated list of events by category.
     * - Any authenticated actor can see public events.
     * - Only actors with EVENT_SOFT_DELETE_VIEW can see private/draft events.
     * - Uses homogeneous validation and pagination logic.
     * @param actor - Authenticated actor
     * @param input - Search parameters (category, page, pageSize)
     * @returns Paginated list of events
     * @throws ServiceError (UNAUTHORIZED) if actor is undefined
     */
    public async getByCategory(
        actor: Actor,
        input: EventByCategoryInput
    ): Promise<ServiceOutput<PaginatedListOutput<Event>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByCategory',
            input: { ...input, actor },
            schema: EventByCategoryInputSchema,
            execute: async (validatedInput, validatedActor) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
                }
                const filters: Record<string, unknown> = { category: validatedInput.category };
                if (!validatedActor.permissions?.includes(PermissionEnum.EVENT_SOFT_DELETE_VIEW)) {
                    filters.visibility = VisibilityEnum.PUBLIC;
                }
                const page = validatedInput.page ?? 1;
                const pageSize = validatedInput.pageSize ?? 20;
                try {
                    return await this.model.findAll(filters, { page, pageSize });
                } catch (err) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, (err as Error).message);
                }
            }
        });
    }

    /**
     * Returns a paginated list of free events (pricing: undefined).
     * - Any authenticated actor can see public events.
     * - Only actors with EVENT_SOFT_DELETE_VIEW can see private/draft events.
     * - Uses homogeneous validation and pagination logic.
     * @param actor - Authenticated actor
     * @param input - Pagination parameters (page, pageSize)
     * @returns Paginated list of free events
     * @throws ServiceError (UNAUTHORIZED) if actor is undefined
     */
    public async getFreeEvents(
        actor: Actor,
        input: EventFreeInput = { page: 1, pageSize: 20 }
    ): Promise<ServiceOutput<PaginatedListOutput<Event>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getFreeEvents',
            input: { ...input, actor },
            schema: EventFreeInputSchema,
            execute: async (validatedInput, validatedActor) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
                }
                const filters: Record<string, unknown> = { pricing: undefined };
                if (!validatedActor.permissions?.includes(PermissionEnum.EVENT_SOFT_DELETE_VIEW)) {
                    filters.visibility = VisibilityEnum.PUBLIC;
                }
                const page = validatedInput.page ?? 1;
                const pageSize = validatedInput.pageSize ?? 20;
                try {
                    return await this.model.findAll(filters, { page, pageSize });
                } catch (err) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, (err as Error).message);
                }
            }
        });
    }
}
