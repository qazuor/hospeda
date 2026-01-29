import { OwnerPromotionModel } from '@repo/db';
import type {
    OwnerPromotion,
    OwnerPromotionCreateInput,
    OwnerPromotionSearchInput
} from '@repo/schemas';
import {
    OwnerPromotionCreateInputSchema,
    OwnerPromotionSearchSchema,
    OwnerPromotionUpdateInputSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing owner promotions (discounts for VIP tourists).
 * Only owners with Pro or Premium plans can create promotions.
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

    protected _canCreate(actor: Actor, _data: OwnerPromotionCreateInput): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.OWNER_PROMOTION_CREATE)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to create owner promotion'
            );
        }
    }

    protected _canUpdate(actor: Actor, _entity: OwnerPromotion): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.OWNER_PROMOTION_UPDATE)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to update owner promotion'
            );
        }
    }

    protected _canSoftDelete(actor: Actor, _entity: OwnerPromotion): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.OWNER_PROMOTION_DELETE)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to delete owner promotion'
            );
        }
    }

    protected _canHardDelete(actor: Actor, _entity: OwnerPromotion): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.OWNER_PROMOTION_HARD_DELETE)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to permanently delete owner promotion'
            );
        }
    }

    protected _canRestore(actor: Actor, _entity: OwnerPromotion): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.OWNER_PROMOTION_RESTORE)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to restore owner promotion'
            );
        }
    }

    protected _canView(actor: Actor, _entity: OwnerPromotion): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.OWNER_PROMOTION_VIEW)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to view owner promotion'
            );
        }
    }

    protected _canList(actor: Actor): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.OWNER_PROMOTION_VIEW)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to list owner promotions'
            );
        }
    }

    protected _canSearch(actor: Actor): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.OWNER_PROMOTION_VIEW)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to search owner promotions'
            );
        }
    }

    protected _canCount(actor: Actor): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.OWNER_PROMOTION_VIEW)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to count owner promotions'
            );
        }
    }

    protected _canUpdateVisibility(
        actor: Actor,
        _entity: OwnerPromotion,
        _newVisibility: unknown
    ): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.OWNER_PROMOTION_UPDATE)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to update owner promotion visibility'
            );
        }
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
