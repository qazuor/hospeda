import { SponsorshipModel } from '@repo/db';
import type { Sponsorship, SponsorshipCreateInput, SponsorshipSearchInput } from '@repo/schemas';
import {
    PermissionEnum,
    ServiceErrorCode,
    SponsorshipCreateInputSchema,
    SponsorshipSearchSchema,
    SponsorshipUpdateInputSchema
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing sponsorships.
 * Provides CRUD operations and permission/lifecycle hooks for Sponsorship entities.
 */
export class SponsorshipService extends BaseCrudService<
    Sponsorship,
    SponsorshipModel,
    typeof SponsorshipCreateInputSchema,
    typeof SponsorshipUpdateInputSchema,
    typeof SponsorshipSearchSchema
> {
    static readonly ENTITY_NAME = 'sponsorship';
    protected readonly entityName = SponsorshipService.ENTITY_NAME;
    protected readonly model: SponsorshipModel;

    protected readonly createSchema = SponsorshipCreateInputSchema;
    protected readonly updateSchema = SponsorshipUpdateInputSchema;
    protected readonly searchSchema = SponsorshipSearchSchema;

    protected getDefaultListRelations() {
        return { sponsorUser: true, level: true, package: true };
    }

    constructor(ctx: ServiceContext & { model?: SponsorshipModel }) {
        super(ctx, SponsorshipService.ENTITY_NAME);
        this.model = ctx.model ?? new SponsorshipModel();
    }

    /**
     * Permission hook: checks if the actor can create a sponsorship.
     */
    protected _canCreate(actor: Actor, _data: SponsorshipCreateInput): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_CREATE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to create sponsorship'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can update a sponsorship.
     */
    protected _canUpdate(actor: Actor, _entity: Sponsorship): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_UPDATE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to update sponsorship'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can soft-delete a sponsorship.
     */
    protected _canSoftDelete(actor: Actor, _entity: Sponsorship): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_DELETE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to delete sponsorship'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can hard-delete a sponsorship.
     */
    protected _canHardDelete(actor: Actor, _entity: Sponsorship): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.SPONSORSHIP_HARD_DELETE)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to permanently delete sponsorship'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can restore a sponsorship.
     */
    protected _canRestore(actor: Actor, _entity: Sponsorship): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.SPONSORSHIP_RESTORE)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to restore sponsorship'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can view a sponsorship.
     */
    protected _canView(actor: Actor, _entity: Sponsorship): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to view sponsorship'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can list sponsorships.
     */
    protected _canList(actor: Actor): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to list sponsorships'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can search sponsorships.
     */
    protected _canSearch(actor: Actor): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to search sponsorships'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can count sponsorships.
     */
    protected _canCount(actor: Actor): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to count sponsorships'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can update the visibility of a sponsorship.
     */
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: Sponsorship,
        _newVisibility: unknown
    ): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_UPDATE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to update sponsorship visibility'
            );
        }
    }

    /**
     * Executes the search for sponsorships.
     */
    protected async _executeSearch(params: SponsorshipSearchInput, _actor: Actor) {
        const { page = 1, limit = 20, ...filterParams } = params;
        return this.model.findAll(filterParams, { page, pageSize: limit });
    }

    /**
     * Executes the count for sponsorships.
     */
    protected async _executeCount(params: SponsorshipSearchInput, _actor: Actor) {
        const { page, limit, ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }
}
