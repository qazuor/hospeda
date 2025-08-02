import { EventOrganizerModel } from '@repo/db';
import type { EventOrganizerType, VisibilityEnum } from '@repo/types';
import type { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, PaginatedListOutput, ServiceContext } from '../../types';
import * as helpers from './eventOrganizer.helpers';
import { normalizeCreateInput, normalizeUpdateInput } from './eventOrganizer.normalizers';
import {
    checkCanCreateEventOrganizer,
    checkCanDeleteEventOrganizer,
    checkCanUpdateEventOrganizer
} from './eventOrganizer.permissions';
import {
    CreateEventOrganizerSchema,
    SearchEventOrganizerSchema,
    UpdateEventOrganizerSchema
} from './eventOrganizer.schemas';

/**
 * Service for managing event organizers. Implements business logic, permissions, and hooks for EventOrganizer entities.
 * @extends BaseCrudService
 */
export class EventOrganizerService extends BaseCrudService<
    EventOrganizerType,
    EventOrganizerModel,
    typeof CreateEventOrganizerSchema,
    typeof UpdateEventOrganizerSchema,
    typeof SearchEventOrganizerSchema
> {
    static readonly ENTITY_NAME = 'eventOrganizer';
    protected readonly entityName = EventOrganizerService.ENTITY_NAME;
    protected readonly model: EventOrganizerModel;

    protected readonly createSchema = CreateEventOrganizerSchema;
    protected readonly updateSchema = UpdateEventOrganizerSchema;
    protected readonly searchSchema = SearchEventOrganizerSchema;
    protected readonly normalizers = {
        create: normalizeCreateInput as unknown as (
            data: z.infer<typeof CreateEventOrganizerSchema>,
            actor: Actor
        ) => z.infer<typeof CreateEventOrganizerSchema>,
        update: normalizeUpdateInput as unknown as (
            data: z.infer<typeof UpdateEventOrganizerSchema>,
            actor: Actor
        ) => z.infer<typeof UpdateEventOrganizerSchema>
    };
    protected readonly helpers = helpers;

    constructor(ctx: ServiceContext, model?: EventOrganizerModel) {
        super(ctx, EventOrganizerService.ENTITY_NAME);
        this.model = model ?? new EventOrganizerModel();
    }

    // --- Permission Hooks ---
    protected async _canCreate(actor: Actor, _data: z.infer<typeof CreateEventOrganizerSchema>) {
        checkCanCreateEventOrganizer(actor);
    }
    protected async _canUpdate(actor: Actor, _entity: EventOrganizerType) {
        checkCanUpdateEventOrganizer(actor);
    }
    protected async _canSoftDelete(actor: Actor, _entity: EventOrganizerType) {
        checkCanDeleteEventOrganizer(actor);
    }
    protected async _canHardDelete(actor: Actor, _entity: EventOrganizerType) {
        checkCanDeleteEventOrganizer(actor);
    }
    protected async _canRestore(actor: Actor, _entity: EventOrganizerType) {
        checkCanUpdateEventOrganizer(actor);
    }
    protected async _canView(_actor: Actor, _entity: EventOrganizerType) {
        // TODO: Implement fine-grained view permissions if needed
        return;
    }
    protected async _canList(_actor: Actor) {
        // TODO: Implement list permissions if needed
        return;
    }
    protected async _canSearch(_actor: Actor) {
        // TODO: Implement search permissions if needed
        return;
    }
    protected async _canCount(_actor: Actor) {
        // TODO: Implement count permissions if needed
        return;
    }
    protected async _canUpdateVisibility(
        _actor: Actor,
        _entity: EventOrganizerType,
        _newVisibility: VisibilityEnum
    ) {
        // TODO: Implement visibility update permissions if needed
        return;
    }

    // --- Core Logic ---
    protected async _executeSearch(
        params: z.infer<typeof SearchEventOrganizerSchema>,
        _actor: Actor
    ): Promise<PaginatedListOutput<EventOrganizerType>> {
        const { filters = {}, page = 1, pageSize = 20 } = params;
        const where: Record<string, unknown> = {};
        if (filters.name) where.name = filters.name;
        if (filters.q) {
            // Partial search by name (case-insensitive)
            where.name = { $ilike: `%${filters.q}%` };
        }
        return this.model.findAll(where, { page, pageSize });
    }

    protected async _executeCount(
        params: z.infer<typeof SearchEventOrganizerSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const { filters = {} } = params;
        const where: Record<string, unknown> = {};
        if (filters.name) where.name = filters.name;
        if (filters.q) {
            where.name = { $ilike: `%${filters.q}%` };
        }
        const count = await this.model.count(where);
        return { count };
    }
}
