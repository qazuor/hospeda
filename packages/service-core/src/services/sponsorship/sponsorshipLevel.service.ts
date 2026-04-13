import { SponsorshipLevelModel } from '@repo/db';
import type {
    SponsorshipLevel,
    SponsorshipLevelCreateInput,
    SponsorshipLevelSearchInput
} from '@repo/schemas';
import {
    PermissionEnum,
    ServiceErrorCode,
    SponsorshipLevelCreateInputSchema,
    SponsorshipLevelSearchSchema,
    SponsorshipLevelUpdateInputSchema
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceConfig, ServiceContext } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing sponsorship levels.
 * Provides CRUD operations and permission/lifecycle hooks for SponsorshipLevel entities.
 */
export class SponsorshipLevelService extends BaseCrudService<
    SponsorshipLevel,
    SponsorshipLevelModel,
    typeof SponsorshipLevelCreateInputSchema,
    typeof SponsorshipLevelUpdateInputSchema,
    typeof SponsorshipLevelSearchSchema
> {
    static readonly ENTITY_NAME = 'sponsorshipLevel';
    protected readonly entityName = SponsorshipLevelService.ENTITY_NAME;
    protected readonly model: SponsorshipLevelModel;

    protected readonly createSchema = SponsorshipLevelCreateInputSchema;
    protected readonly updateSchema = SponsorshipLevelUpdateInputSchema;
    protected readonly searchSchema = SponsorshipLevelSearchSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    constructor(ctx: ServiceConfig & { model?: SponsorshipLevelModel }) {
        super(ctx, SponsorshipLevelService.ENTITY_NAME);
        this.model = ctx.model ?? new SponsorshipLevelModel();
    }

    /**
     * Permission hook: checks if the actor can create a sponsorship level.
     */
    protected _canCreate(actor: Actor, _data: SponsorshipLevelCreateInput): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_CREATE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to create sponsorship level'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can update a sponsorship level.
     */
    protected _canUpdate(actor: Actor, _entity: SponsorshipLevel): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_UPDATE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to update sponsorship level'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can soft-delete a sponsorship level.
     */
    protected _canSoftDelete(actor: Actor, _entity: SponsorshipLevel): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_DELETE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to delete sponsorship level'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can hard-delete a sponsorship level.
     */
    protected _canHardDelete(actor: Actor, _entity: SponsorshipLevel): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.SPONSORSHIP_HARD_DELETE)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to permanently delete sponsorship level'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can restore a sponsorship level.
     */
    protected _canRestore(actor: Actor, _entity: SponsorshipLevel): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.SPONSORSHIP_RESTORE)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to restore sponsorship level'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can view a sponsorship level.
     */
    protected _canView(actor: Actor, _entity: SponsorshipLevel): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to view sponsorship level'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can list sponsorship levels.
     */
    protected _canList(actor: Actor): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to list sponsorship levels'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can search sponsorship levels.
     */
    protected _canSearch(actor: Actor): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to search sponsorship levels'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can count sponsorship levels.
     */
    protected _canCount(actor: Actor): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to count sponsorship levels'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can update the visibility of a sponsorship level.
     */
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: SponsorshipLevel,
        _newVisibility: unknown
    ): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_UPDATE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to update sponsorship level visibility'
            );
        }
    }

    /**
     * Executes the search for sponsorship levels.
     */
    protected async _executeSearch(
        params: SponsorshipLevelSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        const { page = 1, limit = 20, ...filterParams } = params;
        return this.model.findAll(filterParams, { page, pageSize: limit });
    }

    /**
     * Executes the count for sponsorship levels.
     */
    protected async _executeCount(
        params: SponsorshipLevelSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        const { page, limit, ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }
}
