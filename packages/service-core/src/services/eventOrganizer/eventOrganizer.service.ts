import { EventOrganizerModel } from '@repo/db';
import type {
    EventOrganizer,
    EventOrganizerCountInput,
    EventOrganizerCreateInput,
    EventOrganizerListInput,
    EventOrganizerSearchInput,
    EventOrganizerUpdateInput,
    VisibilityEnum
} from '@repo/schemas';
import {
    EventOrganizerCreateInputSchema,
    EventOrganizerSearchInputSchema,
    EventOrganizerUpdateInputSchema
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, PaginatedListOutput, ServiceContext } from '../../types';
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
        // TODO [0656ffe0-823a-442d-b36a-da49073ac753]: Implement fine-grained view permissions if needed
        return;
    }
    protected async _canList(_actor: Actor) {
        // TODO [f27348e1-7e0a-4280-95f4-49e96f82a94a]: Implement list permissions if needed
        return;
    }
    protected async _canSearch(_actor: Actor) {
        // TODO [c215a0a0-5ccb-4513-998a-fdcdaee43283]: Implement search permissions if needed
        return;
    }
    protected async _canCount(_actor: Actor) {
        // TODO [b6cee389-5c34-442c-ae49-748d86bc0be4]: Implement count permissions if needed
        return;
    }
    protected async _canUpdateVisibility(
        _actor: Actor,
        _entity: EventOrganizer,
        _newVisibility: VisibilityEnum
    ) {
        // TODO [afe1d9d5-0260-4d50-8e72-3740c9455ba1]: Implement visibility update permissions if needed
        return;
    }

    // --- Core Logic ---
    protected async _executeSearch(
        params: EventOrganizerSearchInput,
        _actor: Actor
    ): Promise<PaginatedListOutput<EventOrganizer>> {
        const { filters = {}, page = 1, pageSize = 10, q } = params;
        const where: Record<string, unknown> = {};
        if (filters.name) where.name = filters.name;
        if (q) {
            // Partial search by name (case-insensitive)
            where.name = { $ilike: `%${q}%` };
        }
        return this.model.findAll(where, { page, pageSize });
    }

    protected async _executeCount(
        params: EventOrganizerCountInput,
        _actor: Actor
    ): Promise<{ count: number }> {
        const { filters = {} } = params;
        const where: Record<string, unknown> = {};
        if (filters.name) where.name = filters.name;
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
        const { filters = {}, page = 1, pageSize = 10, q } = params;

        const where: Record<string, unknown> = {};

        if (filters.name) {
            where.name = { $ilike: `%${filters.name}%` };
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
}
