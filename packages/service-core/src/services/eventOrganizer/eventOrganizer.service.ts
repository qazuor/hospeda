import { EventOrganizerModel } from '@repo/db';
import type {
    EventOrganizer,
    EventOrganizerCreateInput,
    EventOrganizerListInput,
    EventOrganizerSearchInput,
    EventOrganizerUpdateInput,
    VisibilityEnum
} from '@repo/schemas';
import {
    EventOrganizerCreateInputSchema,
    EventOrganizerSearchInputSchema,
    EventOrganizerUpdateInputSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, PaginatedListOutput, ServiceContext } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';
import * as helpers from './eventOrganizer.helpers';
import { normalizeCreateInput, normalizeUpdateInput } from './eventOrganizer.normalizers';
import {
    checkCanCreateEventOrganizer,
    checkCanDeleteEventOrganizer,
    checkCanUpdateEventOrganizer
} from './eventOrganizer.permissions';

/**
 * Service for managing event organizers. Implements business logic, permissions, and hooks for EventOrganizer entities.
 * @extends BaseCrudService
 */
export class EventOrganizerService extends BaseCrudService<
    EventOrganizer,
    EventOrganizerModel,
    typeof EventOrganizerCreateInputSchema,
    typeof EventOrganizerUpdateInputSchema,
    typeof EventOrganizerSearchInputSchema
> {
    static readonly ENTITY_NAME = 'eventOrganizer';
    protected readonly entityName = EventOrganizerService.ENTITY_NAME;
    protected readonly model: EventOrganizerModel;

    protected readonly createSchema = EventOrganizerCreateInputSchema;
    protected readonly updateSchema = EventOrganizerUpdateInputSchema;
    protected readonly searchSchema = EventOrganizerSearchInputSchema;

    protected getDefaultListRelations() {
        return undefined;
    }
    protected readonly normalizers = {
        create: normalizeCreateInput as unknown as (
            data: EventOrganizerCreateInput,
            actor: Actor
        ) => EventOrganizerCreateInput,
        update: normalizeUpdateInput as unknown as (
            data: EventOrganizerUpdateInput,
            actor: Actor
        ) => EventOrganizerUpdateInput
    };
    protected readonly helpers = helpers;

    constructor(ctx: ServiceContext, model?: EventOrganizerModel) {
        super(ctx, EventOrganizerService.ENTITY_NAME);
        this.model = model ?? new EventOrganizerModel();
    }

    // --- Permission Hooks ---
    protected async _canCreate(actor: Actor, _data: EventOrganizerCreateInput) {
        checkCanCreateEventOrganizer(actor);
    }
    protected async _canUpdate(actor: Actor, _entity: EventOrganizer) {
        checkCanUpdateEventOrganizer(actor);
    }
    protected async _canSoftDelete(actor: Actor, _entity: EventOrganizer) {
        checkCanDeleteEventOrganizer(actor);
    }
    protected async _canHardDelete(actor: Actor, _entity: EventOrganizer) {
        checkCanDeleteEventOrganizer(actor);
    }
    protected async _canRestore(actor: Actor, _entity: EventOrganizer) {
        checkCanUpdateEventOrganizer(actor);
    }
    protected async _canView(_actor: Actor, _entity: EventOrganizer) {
        // Public: all users can view event organizers
        return;
    }
    protected async _canList(_actor: Actor) {
        // Public: all users can list event organizers
        return;
    }
    protected async _canSearch(_actor: Actor) {
        // Public: all users can search event organizers
        return;
    }
    protected async _canCount(_actor: Actor) {
        // Public: all users can count event organizers
        return;
    }
    protected async _canUpdateVisibility(
        actor: Actor,
        _entity: EventOrganizer,
        _newVisibility: VisibilityEnum
    ) {
        if (!hasPermission(actor, PermissionEnum.EVENT_ORGANIZER_MANAGE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Forbidden: missing EVENT_ORGANIZER_MANAGE permission'
            );
        }
    }

    // --- Core Logic ---
    protected async _executeSearch(
        params: EventOrganizerSearchInput,
        _actor: Actor
    ): Promise<PaginatedListOutput<EventOrganizer>> {
        const { page = 1, pageSize = 10, sortBy, sortOrder, q, name, ...otherFilters } = params;
        const where: Record<string, unknown> = { ...otherFilters };
        if (name) where.name = name;
        if (q) {
            // Partial search by name (case-insensitive)
            where.name = { $ilike: `%${q}%` };
        }
        return this.model.findAll(where, { page, pageSize });
    }

    protected async _executeCount(
        params: EventOrganizerSearchInput,
        _actor: Actor
    ): Promise<{ count: number }> {
        const { page, pageSize, sortBy, sortOrder, q, name, ...otherFilters } = params;
        const where: Record<string, unknown> = { ...otherFilters };
        if (name) where.name = name;
        const count = await this.model.count(where);
        return { count };
    }

    /**
     * Searches for event organizers for list display.
     * @param actor - The actor performing the action
     * @param params - The list parameters
     * @returns Event organizers list
     */
    public async searchForList(
        actor: Actor,
        params: EventOrganizerListInput
    ): Promise<{ items: EventOrganizer[]; total: number }> {
        this._canList(actor);
        const { page = 1, pageSize = 10, q, name, ...otherFilters } = params;

        const where: Record<string, unknown> = { ...otherFilters };

        if (name) {
            where.name = { $ilike: `%${name}%` };
        }
        if (q) {
            where.$or = [{ name: { $ilike: `%${q}%` } }];
        }

        const result = await this.model.findAll(where, { page, pageSize });
        return {
            items: result.items,
            total: result.total
        };
    }

    /**
     * Gets the number of events organized by this event organizer.
     * Note: Returns 0 until EventModel supports counting by organizerId.
     * @param actor - The actor performing the action
     * @param id - The event organizer ID
     * @returns Count of events for this organizer
     */
    public async getEventCount(actor: Actor, id: string): Promise<{ count: number }> {
        await this._canView(actor, { id } as EventOrganizer);

        const organizer = await this.model.findById(id);
        if (!organizer) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `Event organizer with id '${id}' not found`
            );
        }

        // Placeholder: EventModel does not yet support counting by organizerId
        this.logger.warn(
            `[EventOrganizerService.getEventCount] Returning placeholder count=0 for organizer ${id}`
        );
        return { count: 0 };
    }

    /**
     * Gets statistics for an event organizer.
     * Note: Returns zeroed stats until EventModel supports aggregations by organizerId.
     * @param actor - The actor performing the action
     * @param id - The event organizer ID
     * @returns Statistics for this organizer
     */
    public async getStats(
        actor: Actor,
        id: string
    ): Promise<{
        totalEvents: number;
        activeEvents: number;
        upcomingEvents: number;
        pastEvents: number;
    }> {
        await this._canView(actor, { id } as EventOrganizer);

        const organizer = await this.model.findById(id);
        if (!organizer) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `Event organizer with id '${id}' not found`
            );
        }

        // Placeholder: EventModel does not yet support aggregations by organizerId
        this.logger.warn(
            `[EventOrganizerService.getStats] Returning placeholder stats for organizer ${id}`
        );
        return {
            totalEvents: 0,
            activeEvents: 0,
            upcomingEvents: 0,
            pastEvents: 0
        };
    }
}
