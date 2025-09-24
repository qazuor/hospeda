import { EventModel } from '@repo/db';
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
import { BaseCrudService } from '../../base/base.crud.service';
import type { PaginatedListOutput, ServiceContext, ServiceOutput } from '../../types';
import { type Actor, ServiceError } from '../../types';
import { generateEventSlug } from './event.helpers';
import { normalizeCreateInput, normalizeUpdateInput } from './event.normalizers';
import {
    checkCanCreateEvent,
    checkCanDeleteEvent,
    checkCanHardDeleteEvent,
    checkCanListEvents,
    checkCanRestoreEvent,
    checkCanUpdateEvent,
    checkCanViewEvent
} from './event.permissions';

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
    protected readonly model: EventModel;

    protected readonly createSchema = EventCreateInputSchema;
    protected readonly updateSchema = EventUpdateInputSchema;
    protected readonly searchSchema = EventSearchInputSchema;

    constructor(ctx: ServiceContext & { model?: EventModel }) {
        super(ctx, EventService.ENTITY_NAME);
        this.model = ctx.model ?? new EventModel();
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
        // TODO [3812ac2a-2722-421c-af58-ac63fc33f9c9]: Implement visibility update permission logic if needed
        checkCanUpdateEvent(actor);
    }

    /**
     * Lifecycle hook: normalizes input before creating an event and generates slug.
     */
    protected async _beforeCreate(input: EventCreateInput, _actor: Actor): Promise<Partial<Event>> {
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
            return { slug };
        }

        // If slug is provided, return empty object to avoid overwriting
        return {};
    }

    /**
     * Lifecycle hook: normalizes input before updating an event and updates slug if relevant fields change.
     */
    protected async _beforeUpdate(input: EventUpdateInput, _actor: Actor): Promise<Partial<Event>> {
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

    /**
     * Executes the search for events.
     * @param params - The validated search parameters
     * @param _actor - The actor performing the search
     * @returns Paginated list of events matching the criteria
     */
    protected async _executeSearch(params: EventSearchInput, _actor: Actor) {
        const { filters = {}, page = 1, pageSize = 10 } = params;
        return this.model.findAll(filters, { page, pageSize });
    }

    /**
     * Executes the count for events.
     * @param params - The validated search parameters
     * @param _actor - The actor performing the count
     * @returns Count of events matching the criteria
     */
    protected async _executeCount(params: EventSearchInput, _actor: Actor) {
        const { filters = {} } = params;
        const count = await this.model.count(filters);
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
                this._canView(validatedActor, event);
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
