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
        // TODO [74a2c0b1-7e1a-4663-ac24-0aae01b9f079]: Implement fine-grained view permissions if needed
        return;
    }
    protected async _canList(_actor: Actor) {
        // TODO [fafc85ef-f637-4f33-9f34-bb0d186a6649]: Implement list permissions if needed
        return;
    }
    protected async _canSearch(_actor: Actor) {
        // TODO [3e22743d-e742-4dba-9ef6-1264778d3234]: Implement search permissions if needed
        return;
    }
    protected async _canCount(_actor: Actor) {
        // TODO [a0412059-0a6b-4b8d-9aa0-d511813a9d1f]: Implement count permissions if needed
        return;
    }
    protected async _canUpdateVisibility(
        _actor: Actor,
        _entity: EventOrganizer,
        _newVisibility: VisibilityEnum
    ) {
        // TODO [f363c84e-aa3a-49c8-be3d-49465b951f17]: Implement visibility update permissions if needed
        return;
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
}
