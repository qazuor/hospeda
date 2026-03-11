import { OwnerPromotionModel } from '@repo/db';
import type {
    OwnerPromotion,
    OwnerPromotionCreateInput,
    OwnerPromotionSearchInput
} from '@repo/schemas';
import {
    OwnerPromotionCreateInputSchema,
    OwnerPromotionSearchSchema,
    OwnerPromotionUpdateInputSchema
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext } from '../../types';
import {
    checkCanCount,
    checkCanCreate,
    checkCanHardDelete,
    checkCanList,
    checkCanRestore,
    checkCanSearch,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanUpdateVisibility,
    checkCanView
} from './ownerPromotion.permissions';

/**
 * Service for managing owner promotions (discounts for VIP tourists).
 * Only owners with Pro or Premium plans can create promotions.
 *
 * Permission model:
 * - `_ANY` permissions allow operating on any promotion regardless of ownership.
 * - `_OWN` permissions allow operating only on promotions owned by the actor.
 */
export class OwnerPromotionService extends BaseCrudService<
    OwnerPromotion,
    OwnerPromotionModel,
    typeof OwnerPromotionCreateInputSchema,
    typeof OwnerPromotionUpdateInputSchema,
    typeof OwnerPromotionSearchSchema
> {
    static readonly ENTITY_NAME = 'ownerPromotion';
    protected readonly entityName = OwnerPromotionService.ENTITY_NAME;
    protected readonly model: OwnerPromotionModel;

    protected readonly createSchema = OwnerPromotionCreateInputSchema;
    protected readonly updateSchema = OwnerPromotionUpdateInputSchema;
    protected readonly searchSchema = OwnerPromotionSearchSchema;

    protected getDefaultListRelations() {
        return { owner: true, accommodation: true };
    }

    constructor(ctx: ServiceContext & { model?: OwnerPromotionModel }) {
        super(ctx, OwnerPromotionService.ENTITY_NAME);
        this.model = ctx.model ?? new OwnerPromotionModel();
    }

    protected _canCreate(actor: Actor, data: OwnerPromotionCreateInput): void {
        checkCanCreate(actor, data);
    }

    protected _canUpdate(actor: Actor, entity: OwnerPromotion): void {
        checkCanUpdate(actor, entity);
    }

    protected _canSoftDelete(actor: Actor, entity: OwnerPromotion): void {
        checkCanSoftDelete(actor, entity);
    }

    protected _canHardDelete(actor: Actor, entity: OwnerPromotion): void {
        checkCanHardDelete(actor, entity);
    }

    protected _canRestore(actor: Actor, entity: OwnerPromotion): void {
        checkCanRestore(actor, entity);
    }

    protected _canView(actor: Actor, entity: OwnerPromotion): void {
        checkCanView(actor, entity);
    }

    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    protected _canUpdateVisibility(
        actor: Actor,
        entity: OwnerPromotion,
        newVisibility: unknown
    ): void {
        checkCanUpdateVisibility(actor, entity, newVisibility);
    }

    protected async _executeSearch(params: OwnerPromotionSearchInput, _actor: Actor) {
        const { page = 1, limit = 20, ...filterParams } = params;
        return this.model.findAll(filterParams, { page, pageSize: limit });
    }

    protected async _executeCount(params: OwnerPromotionSearchInput, _actor: Actor) {
        const { page, limit, ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }
}
