import type { ServiceListingPlanModel } from '@repo/db';
import type { ListRelationsConfig, ServiceListingPlan } from '@repo/schemas';
import {
    CreateServiceListingPlanSchema,
    ServiceListingPlanSearchSchema,
    UpdateServiceListingPlanSchema
} from '@repo/schemas';
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
} from './serviceListingPlan.permissions.js';

/**
 * Service for managing service listing plans.
 * Extends BaseCrudService to provide CRUD operations with permission checks
 * for service listing plan management.
 */
export class ServiceListingPlanService extends BaseCrudService<
    ServiceListingPlan,
    ServiceListingPlanModel,
    typeof CreateServiceListingPlanSchema,
    typeof UpdateServiceListingPlanSchema,
    typeof ServiceListingPlanSearchSchema
> {
    static readonly ENTITY_NAME = 'service-listing-plan';
    protected readonly entityName = ServiceListingPlanService.ENTITY_NAME;

    public readonly model: ServiceListingPlanModel;

    public readonly createSchema = CreateServiceListingPlanSchema;
    public readonly updateSchema = UpdateServiceListingPlanSchema;
    public readonly searchSchema = ServiceListingPlanSearchSchema;

    constructor(ctx: ServiceContext, model?: ServiceListingPlanModel) {
        super(ctx, ServiceListingPlanService.ENTITY_NAME);
        this.model = model ?? ({} as ServiceListingPlanModel);
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    protected _canCreate(actor: Actor, _data: unknown): void {
        checkCanCreate(actor, _data);
    }

    protected _canUpdate(actor: Actor, entity: ServiceListingPlan): void {
        checkCanUpdate(actor, entity);
    }

    protected _canPatch(actor: Actor, entity: ServiceListingPlan, data: unknown): void {
        checkCanPatch(actor, entity, data);
    }

    protected _canUpdateVisibility(actor: Actor, entity: ServiceListingPlan): void {
        checkCanUpdateVisibility(actor, entity);
    }

    protected _canDelete(actor: Actor, entity: ServiceListingPlan): void {
        checkCanDelete(actor, entity);
    }

    protected _canHardDelete(actor: Actor, entity: ServiceListingPlan): void {
        checkCanHardDelete(actor, entity);
    }

    protected _canRestore(actor: Actor, entity: ServiceListingPlan): void {
        checkCanRestore(actor, entity);
    }

    protected _canView(actor: Actor, entity: ServiceListingPlan): void {
        checkCanView(actor, entity);
    }

    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    protected _canSoftDelete(actor: Actor, entity: ServiceListingPlan): void {
        checkCanSoftDelete(actor, entity);
    }

    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    protected async _executeSearch(
        _params: z.infer<typeof ServiceListingPlanSearchSchema>,
        _actor: Actor
    ): Promise<PaginatedListOutput<ServiceListingPlan>> {
        return {
            items: [],
            total: 0
        };
    }

    protected async _executeCount(
        _params: z.infer<typeof ServiceListingPlanSearchSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        return { count: 0 };
    }
}
