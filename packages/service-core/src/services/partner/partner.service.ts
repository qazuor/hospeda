import { PartnerModel } from '@repo/db';
import {
    type Partner,
    adminSearchPartnerSchema,
    createPartnerSchema,
    searchPartnerSchema,
    updatePartnerSchema
} from '@repo/schemas';
import {
    LifecycleStatusEnum,
    PartnerSubscriptionStatusEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { toSlug } from '@repo/utils';
import { BaseCrudService } from '../../base/base.crud.service';
import { ServiceError } from '../../types';
import type { Actor, PaginatedListOutput, ServiceConfig, ServiceContext } from '../../types';
import {
    checkCanAdminList,
    checkCanCount,
    checkCanCreate,
    checkCanHardDelete,
    checkCanList,
    checkCanRestore,
    checkCanSearch,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanView
} from './partner.permissions';

/**
 * Service for managing partners.
 * Provides CRUD operations and permission/lifecycle hooks for Partner entities.
 */
export class PartnerService extends BaseCrudService<
    Partner,
    PartnerModel,
    typeof createPartnerSchema,
    typeof updatePartnerSchema,
    typeof searchPartnerSchema
> {
    static readonly ENTITY_NAME = 'partner';
    protected readonly entityName = PartnerService.ENTITY_NAME;
    protected readonly model: PartnerModel;

    protected readonly createSchema = createPartnerSchema;
    protected readonly updateSchema = updatePartnerSchema;
    protected readonly searchSchema = searchPartnerSchema;

    protected getDefaultListRelations() {
        return {};
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Partners are searched by slug and name.
     */
    protected override getSearchableColumns(): string[] {
        return ['slug', 'name'];
    }

    constructor(ctx: ServiceConfig & { model?: PartnerModel }) {
        super(ctx, PartnerService.ENTITY_NAME);
        this.model = ctx.model ?? new PartnerModel();
        this.adminSearchSchema = adminSearchPartnerSchema;
    }

    /**
     * Lifecycle hook: runs before create.
     * Auto-generates slug from name when not provided.
     */
    protected async _beforeCreate(
        data: Record<string, unknown>,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<Partner>> {
        const updates: Partial<Partner> = {};

        if (!data.slug || (data.slug as string).trim().length === 0) {
            const base = `${(data.name as string) ?? 'partner'}`;
            const suffix = Date.now().toString(36);
            updates.slug = `${toSlug(base) || 'partner'}-${suffix}`;
        }

        return updates;
    }

    /**
     * Permission hook: checks if the actor can create a partner.
     * Requires `PARTNER_MANAGE`.
     */
    protected _canCreate(actor: Actor, data: Record<string, unknown>): void {
        checkCanCreate(actor, data);
    }

    /**
     * Permission hook: checks if the actor can update a partner.
     * Requires `PARTNER_MANAGE`.
     */
    protected _canUpdate(actor: Actor, entity: Partner): void {
        checkCanUpdate(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can soft-delete a partner.
     * Requires `PARTNER_MANAGE`.
     */
    protected _canSoftDelete(actor: Actor, entity: Partner): void {
        checkCanSoftDelete(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can hard-delete a partner.
     * Requires `PARTNER_MANAGE`.
     */
    protected _canHardDelete(actor: Actor, entity: Partner): void {
        checkCanHardDelete(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can restore a partner.
     * Requires `PARTNER_MANAGE`.
     */
    protected _canRestore(actor: Actor, entity: Partner): void {
        checkCanRestore(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can view a partner.
     * Requires `PARTNER_VIEW_ALL` (or `PARTNER_MANAGE`).
     */
    protected _canView(actor: Actor, entity: Partner): void {
        checkCanView(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can list partners.
     * Requires `PARTNER_VIEW_ALL` (or `PARTNER_MANAGE`).
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * Permission hook: checks if the actor can search partners.
     * Requires `PARTNER_VIEW_ALL` (or `PARTNER_MANAGE`).
     */
    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    /**
     * Permission hook: checks if the actor can count partners.
     * Requires `PARTNER_VIEW_ALL` (or `PARTNER_MANAGE`).
     */
    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    /**
     * Permission hook: checks if the actor can use admin list for partners.
     * Requires admin access (base class) plus `PARTNER_VIEW_ALL` (or `PARTNER_MANAGE`).
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }

    /**
     * Permission hook: checks if the actor can update the visibility of a partner.
     * Requires `PARTNER_MANAGE` (same as update).
     */
    protected _canUpdateVisibility(actor: Actor, entity: Partner, _newVisibility: unknown): void {
        checkCanUpdate(actor, entity);
    }

    /**
     * Executes the search for partners.
     * Forces lifecycleState = ACTIVE for public/protected paths.
     */
    protected async _executeSearch(
        params: Record<string, unknown>,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<Partner>> {
        const { page = 1, pageSize = 20, ...filterParams } = params;
        (filterParams as Record<string, unknown>).lifecycleState = LifecycleStatusEnum.ACTIVE;
        const items = await this.model.findByFilters(
            filterParams as Parameters<PartnerModel['findByFilters']>[0]
        );
        const total = await this.model.countActivePartners(
            filterParams as { q?: string; type?: string; tier?: string }
        );
        return { items, total };
    }

    /**
     * Executes the count for partners.
     * Forces lifecycleState = ACTIVE for public/protected paths.
     */
    protected async _executeCount(
        params: Record<string, unknown>,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        const { page: _page, pageSize: _pageSize, ...filterParams } = params;
        (filterParams as Record<string, unknown>).lifecycleState = LifecycleStatusEnum.ACTIVE;
        const count = await this.model.countActivePartners(
            filterParams as { q?: string; type?: string; tier?: string }
        );
        return { count };
    }

    /**
     * Register manual payment for partner
     */
    async registerManualPayment(
        actor: Actor,
        partnerId: string,
        _note?: string,
        _ctx?: ServiceContext
    ): Promise<Partner> {
        checkCanCreate(actor, {});

        const partner = await this.model.findById(partnerId);
        if (!partner) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Partner not found');
        }

        // Update partner status to active
        const updated = await this.model.update(
            { id: partnerId },
            {
                subscriptionStatus: PartnerSubscriptionStatusEnum.ACTIVE,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            }
        );

        if (!updated) {
            throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Failed to update partner');
        }

        // TODO: Log manual payment in audit log with note

        return updated;
    }
}
