import type { BenefitListingPlanModel } from '@repo/db';
import type { BenefitListingPlan, ListRelationsConfig } from '@repo/schemas';
import {
    CreateBenefitListingSchema,
    SearchBenefitListingsSchema,
    UpdateBenefitListingSchema
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
} from './benefitListingPlan.permissions.js';

/**
 * Service for managing benefit listing plans.
 * Extends BaseCrudService to provide CRUD operations with permission checks
 * for benefit listing plan management.
 */
export class BenefitListingPlanService extends BaseCrudService<
    BenefitListingPlan,
    BenefitListingPlanModel,
    typeof CreateBenefitListingSchema,
    typeof UpdateBenefitListingSchema,
    typeof SearchBenefitListingsSchema
> {
    static readonly ENTITY_NAME = 'benefit-listing-plan';
    protected readonly entityName = BenefitListingPlanService.ENTITY_NAME;

    public readonly model: BenefitListingPlanModel;

    public readonly createSchema = CreateBenefitListingSchema;
    public readonly updateSchema = UpdateBenefitListingSchema;
    public readonly searchSchema = SearchBenefitListingsSchema;

    constructor(ctx: ServiceContext, model?: BenefitListingPlanModel) {
        super(ctx, BenefitListingPlanService.ENTITY_NAME);
        this.model = model ?? ({} as BenefitListingPlanModel);
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    protected _canCreate(actor: Actor, _data: unknown): void {
        checkCanCreate(actor, _data);
    }

    protected _canUpdate(actor: Actor, entity: BenefitListingPlan): void {
        checkCanUpdate(actor, entity);
    }

    protected _canPatch(actor: Actor, entity: BenefitListingPlan, data: unknown): void {
        checkCanPatch(actor, entity, data);
    }

    protected _canUpdateVisibility(actor: Actor, entity: BenefitListingPlan): void {
        checkCanUpdateVisibility(actor, entity);
    }

    protected _canDelete(actor: Actor, entity: BenefitListingPlan): void {
        checkCanDelete(actor, entity);
    }

    protected _canHardDelete(actor: Actor, entity: BenefitListingPlan): void {
        checkCanHardDelete(actor, entity);
    }

    protected _canRestore(actor: Actor, entity: BenefitListingPlan): void {
        checkCanRestore(actor, entity);
    }

    protected _canView(actor: Actor, entity: BenefitListingPlan): void {
        checkCanView(actor, entity);
    }

    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    protected _canSoftDelete(actor: Actor, entity: BenefitListingPlan): void {
        checkCanSoftDelete(actor, entity);
    }

    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    protected async _executeSearch(
        _params: z.infer<typeof SearchBenefitListingsSchema>,
        _actor: Actor
    ): Promise<PaginatedListOutput<BenefitListingPlan>> {
        return {
            items: [],
            total: 0
        };
    }

    protected async _executeCount(
        _params: z.infer<typeof SearchBenefitListingsSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        return { count: 0 };
    }
}
