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
        // TODO [c85ff417-62f4-4828-8409-e4e0f163c0b1]: Implement fine-grained view permissions if needed
        return;
    }
    protected async _canList(_actor: Actor) {
        // TODO [8017bdc2-b4cc-4238-aa14-884d368f75d3]: Implement list permissions if needed
        return;
    }
    protected async _canSearch(_actor: Actor) {
        // TODO [0483e09c-e874-4046-9e25-3ef7a3359f10]: Implement search permissions if needed
        return;
    }
    protected async _canCount(_actor: Actor) {
        // TODO [eecd5753-eda6-45a5-99aa-d311f6422f00]: Implement count permissions if needed
        return;
    }
    protected async _canUpdateVisibility(
        _actor: Actor,
        _entity: EventOrganizer,
        _newVisibility: VisibilityEnum
    ) {
        // TODO [47650c04-6d5d-4632-b7b8-902d434f4e27]: Implement visibility update permissions if needed
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
