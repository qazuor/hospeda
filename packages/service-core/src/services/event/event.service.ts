import { EventModel } from '@repo/db';
import type {
    EventCategoryEnum,
    EventId,
    EventLocationId,
    EventOrganizerId,
    EventSummaryType,
    UserId
} from '@repo/types';
import { type EventType, PermissionEnum, ServiceErrorCode, VisibilityEnum } from '@repo/types';
import type { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { PaginatedListOutput, ServiceContext, ServiceOutput } from '../../types';
import { type Actor, ServiceError, type ServiceLogger } from '../../types';
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
import {
    EventCreateSchema,
    EventFilterInputSchema,
    type EventSchema,
    EventUpdateSchema,
    GetByAuthorInputSchema,
    GetByCategoryInputSchema,
    GetByLocationInputSchema,
    GetByOrganizerInputSchema,
    GetFreeInputSchema,
    GetSummaryInputSchema,
    GetUpcomingInputSchema
} from './event.schemas';

/**
 * Service for managing events.
 * Provides CRUD operations, search, and permission/lifecycle hooks for Event entities.
 * Extends BaseCrudService for homogeneous validation, error handling, and logging.
 */
export class EventService extends BaseCrudService<
    EventType,
    EventModel,
    typeof EventCreateSchema,
    typeof EventUpdateSchema,
    typeof EventFilterInputSchema
> {
    static readonly ENTITY_NAME = 'event';
    protected readonly entityName = EventService.ENTITY_NAME;
    protected readonly model: EventModel;
    protected readonly logger: ServiceLogger;
    protected readonly createSchema = EventCreateSchema;
    protected readonly updateSchema = EventUpdateSchema;
    protected readonly searchSchema = EventFilterInputSchema;

    constructor(ctx: ServiceContext & { model?: EventModel }) {
        super(ctx, EventService.ENTITY_NAME);
        this.logger = ctx.logger;
        this.model = ctx.model ?? new EventModel();
    }

    /**
     * Permission hook: checks if the actor can create an event.
     */
    protected _canCreate(actor: Actor, _data: z.infer<typeof EventSchema>): void {
        checkCanCreateEvent(actor);
    }

    /**
     * Permission hook: checks if the actor can update an event.
     */
    protected _canUpdate(actor: Actor, _entity: EventType): void {
        checkCanUpdateEvent(actor);
    }

    /**
     * Permission hook: checks if the actor can soft-delete an event.
     */
    protected _canSoftDelete(actor: Actor, _entity: EventType): void {
        checkCanDeleteEvent(actor);
    }

    /**
     * Permission hook: checks if the actor can hard-delete an event.
     */
    protected _canHardDelete(actor: Actor, _entity: EventType): void {
        checkCanHardDeleteEvent(actor);
    }

    /**
     * Permission hook: checks if the actor can restore an event.
     */
    protected _canRestore(actor: Actor, _entity: EventType): void {
        checkCanRestoreEvent(actor);
    }

    /**
     * Permission hook: checks if the actor can view an event.
     */
    protected _canView(actor: Actor, entity: EventType): void {
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
        _entity: EventType,
        _newVisibility: EventType['visibility']
    ): void {
        // TODO: Implement visibility update permission logic if needed
        checkCanUpdateEvent(actor);
    }

    /**
     * Lifecycle hook: normalizes input before creating an event and generates slug.
     */
    protected async _beforeCreate(
        input: z.infer<typeof EventSchema>,
        _actor: Actor
    ): Promise<Partial<EventType>> {
        const normalized = await normalizeCreateInput(input);
        // Ensure all required fields are present
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

    /**
     * Lifecycle hook: normalizes input before updating an event and updates slug if relevant fields change.
     */
    protected async _beforeUpdate(
        input: z.infer<typeof EventSchema>,
        _actor: Actor
    ): Promise<Partial<EventType>> {
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
    protected async _executeSearch(params: z.infer<typeof EventFilterInputSchema>, _actor: Actor) {
        const { filters = {}, pagination } = params;
        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 10;
        return this.model.findAll(filters, { page, pageSize });
    }

    /**
     * Executes the count for events.
     * @param params - The validated search parameters
     * @param _actor - The actor performing the count
     * @returns Count of events matching the criteria
     */
    protected async _executeCount(params: z.infer<typeof EventFilterInputSchema>, _actor: Actor) {
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
        input: { authorId: UserId; page?: number; pageSize?: number }
    ): Promise<ServiceOutput<PaginatedListOutput<EventType>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByAuthor',
            input: { ...input, actor },
            schema: GetByAuthorInputSchema,
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
        input: { locationId: EventLocationId; page?: number; pageSize?: number }
    ): Promise<ServiceOutput<PaginatedListOutput<EventType>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByLocation',
            input: { ...input, actor },
            schema: GetByLocationInputSchema,
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
        input: { organizerId: EventOrganizerId; page?: number; pageSize?: number }
    ): Promise<ServiceOutput<PaginatedListOutput<EventType>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByOrganizer',
            input: { ...input, actor },
            schema: GetByOrganizerInputSchema,
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
        input: { fromDate: Date; toDate?: Date; page?: number; pageSize?: number }
    ): Promise<ServiceOutput<PaginatedListOutput<EventType>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getUpcoming',
            input: { ...input, actor },
            schema: GetUpcomingInputSchema,
            execute: async (validatedInput, validatedActor) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
                }
                const filters: Record<string, unknown> = {};
                if (validatedInput.toDate) {
                    filters['date.start'] = {
                        $gte: validatedInput.fromDate,
                        $lte: validatedInput.toDate
                    };
                } else {
                    filters['date.start'] = { $gte: validatedInput.fromDate };
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
        input: { id: EventId }
    ): Promise<ServiceOutput<{ summary: EventSummaryType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getSummary',
            input: { ...input, actor },
            schema: GetSummaryInputSchema,
            execute: async (validatedInput, validatedActor) => {
                if (!validatedActor) {
                    throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
                }
                let event: EventType | null;
                try {
                    event = await this.model.findById(validatedInput.id);
                } catch (err) {
                    throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, (err as Error).message);
                }
                if (!event) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Event not found');
                }
                this._canView(validatedActor, event);
                const summary: EventSummaryType = {
                    id: event.id,
                    slug: event.slug,
                    name: event.name,
                    category: event.category,
                    date: event.date,
                    media: event.media,
                    isFeatured: event.isFeatured
                };
                return { summary };
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
        input: { category: EventCategoryEnum; page?: number; pageSize?: number }
    ): Promise<ServiceOutput<PaginatedListOutput<EventType>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getByCategory',
            input: { ...input, actor },
            schema: GetByCategoryInputSchema,
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
        input: { page?: number; pageSize?: number }
    ): Promise<ServiceOutput<PaginatedListOutput<EventType>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getFreeEvents',
            input: { ...input, actor },
            schema: GetFreeInputSchema,
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
