import type { TouristServiceModel } from '@repo/db';
import type { ListRelationsConfig, TouristService } from '@repo/schemas';
import { TouristServiceSchema } from '@repo/schemas';
import type { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, PaginatedListOutput, ServiceContext } from '../../types/index.js';
import {
    checkCanCount,
    checkCanCreate,
    checkCanDelete,
    checkCanHardDelete,
    checkCanList,
    checkCanPatch,
    checkCanRestore,
    checkCanSearch,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanUpdateVisibility,
    checkCanView
} from './touristService.permissions.js';

/**
 * Service for managing tourist services.
 * Extends BaseCrudService to provide CRUD operations with permission checks
 * for tourist service management.
 */
export class TouristServiceService extends BaseCrudService<
    TouristService,
    TouristServiceModel,
    typeof TouristServiceSchema,
    typeof TouristServiceSchema,
    typeof TouristServiceSchema
> {
    static readonly ENTITY_NAME = 'tourist-service';
    protected readonly entityName = TouristServiceService.ENTITY_NAME;

    public readonly model: TouristServiceModel;

    public readonly createSchema = TouristServiceSchema;
    public readonly updateSchema = TouristServiceSchema;
    public readonly searchSchema = TouristServiceSchema;

    constructor(ctx: ServiceContext, model?: TouristServiceModel) {
        super(ctx, TouristServiceService.ENTITY_NAME);
        this.model = model ?? ({} as TouristServiceModel);
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    protected _canCreate(actor: Actor, _data: unknown): void {
        checkCanCreate(actor, _data);
    }

    protected _canUpdate(actor: Actor, entity: TouristService): void {
        checkCanUpdate(actor, entity);
    }

    protected _canPatch(actor: Actor, entity: TouristService, data: unknown): void {
        checkCanPatch(actor, entity, data);
    }

    protected _canUpdateVisibility(actor: Actor, entity: TouristService): void {
        checkCanUpdateVisibility(actor, entity);
    }

    protected _canDelete(actor: Actor, entity: TouristService): void {
        checkCanDelete(actor, entity);
    }

    protected _canHardDelete(actor: Actor, entity: TouristService): void {
        checkCanHardDelete(actor, entity);
    }

    protected _canRestore(actor: Actor, entity: TouristService): void {
        checkCanRestore(actor, entity);
    }

    protected _canView(actor: Actor, entity: TouristService): void {
        checkCanView(actor, entity);
    }

    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    protected _canSoftDelete(actor: Actor, entity: TouristService): void {
        checkCanSoftDelete(actor, entity);
    }

    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    protected async _executeSearch(
        _params: z.infer<typeof TouristServiceSchema>,
        _actor: Actor
    ): Promise<PaginatedListOutput<TouristService>> {
        return {
            items: [],
            total: 0
        };
    }

    protected async _executeCount(
        _params: z.infer<typeof TouristServiceSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        return { count: 0 };
    }
}
