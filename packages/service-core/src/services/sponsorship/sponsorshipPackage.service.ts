import { SponsorshipPackageModel } from '@repo/db';
import type {
    SponsorshipPackage,
    SponsorshipPackageCreateInput,
    SponsorshipPackageSearchInput
} from '@repo/schemas';
import {
    PermissionEnum,
    ServiceErrorCode,
    SponsorshipPackageCreateInputSchema,
    SponsorshipPackageSearchSchema,
    SponsorshipPackageUpdateInputSchema
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceConfig, ServiceContext } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing sponsorship packages.
 * Provides CRUD operations and permission/lifecycle hooks for SponsorshipPackage entities.
 */
export class SponsorshipPackageService extends BaseCrudService<
    SponsorshipPackage,
    SponsorshipPackageModel,
    typeof SponsorshipPackageCreateInputSchema,
    typeof SponsorshipPackageUpdateInputSchema,
    typeof SponsorshipPackageSearchSchema
> {
    static readonly ENTITY_NAME = 'sponsorshipPackage';
    protected readonly entityName = SponsorshipPackageService.ENTITY_NAME;
    protected readonly model: SponsorshipPackageModel;

    protected readonly createSchema = SponsorshipPackageCreateInputSchema;
    protected readonly updateSchema = SponsorshipPackageUpdateInputSchema;
    protected readonly searchSchema = SponsorshipPackageSearchSchema;

    protected getDefaultListRelations() {
        return { eventLevel: true };
    }

    constructor(ctx: ServiceConfig & { model?: SponsorshipPackageModel }) {
        super(ctx, SponsorshipPackageService.ENTITY_NAME);
        this.model = ctx.model ?? new SponsorshipPackageModel();
    }

    /**
     * Permission hook: checks if the actor can create a sponsorship package.
     */
    protected _canCreate(actor: Actor, _data: SponsorshipPackageCreateInput): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_CREATE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to create sponsorship package'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can update a sponsorship package.
     */
    protected _canUpdate(actor: Actor, _entity: SponsorshipPackage): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_UPDATE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to update sponsorship package'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can soft-delete a sponsorship package.
     */
    protected _canSoftDelete(actor: Actor, _entity: SponsorshipPackage): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_DELETE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to delete sponsorship package'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can hard-delete a sponsorship package.
     */
    protected _canHardDelete(actor: Actor, _entity: SponsorshipPackage): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.SPONSORSHIP_HARD_DELETE)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to permanently delete sponsorship package'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can restore a sponsorship package.
     */
    protected _canRestore(actor: Actor, _entity: SponsorshipPackage): void {
        if (
            !actor ||
            !actor.id ||
            !actor.permissions.includes(PermissionEnum.SPONSORSHIP_RESTORE)
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to restore sponsorship package'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can view a sponsorship package.
     */
    protected _canView(actor: Actor, _entity: SponsorshipPackage): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to view sponsorship package'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can list sponsorship packages.
     */
    protected _canList(actor: Actor): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to list sponsorship packages'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can search sponsorship packages.
     */
    protected _canSearch(actor: Actor): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to search sponsorship packages'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can count sponsorship packages.
     */
    protected _canCount(actor: Actor): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to count sponsorship packages'
            );
        }
    }

    /**
     * Permission hook: checks if the actor can update the visibility of a sponsorship package.
     */
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: SponsorshipPackage,
        _newVisibility: unknown
    ): void {
        if (!actor || !actor.id || !actor.permissions.includes(PermissionEnum.SPONSORSHIP_UPDATE)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to update sponsorship package visibility'
            );
        }
    }

    /**
     * Executes the search for sponsorship packages.
     */
    protected async _executeSearch(
        params: SponsorshipPackageSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        const { page = 1, limit = 20, ...filterParams } = params;
        return this.model.findAll(filterParams, { page, pageSize: limit });
    }

    /**
     * Executes the count for sponsorship packages.
     */
    protected async _executeCount(
        params: SponsorshipPackageSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        const { page, limit, ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }
}
