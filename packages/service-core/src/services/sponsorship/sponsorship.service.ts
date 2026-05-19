import { SponsorshipLevelModel, SponsorshipModel } from '@repo/db';
import type { Sponsorship, SponsorshipCreateInput, SponsorshipSearchInput } from '@repo/schemas';
import {
    LifecycleStatusEnum,
    ServiceErrorCode,
    SponsorshipAdminSearchSchema,
    SponsorshipCreateInputSchema,
    SponsorshipSearchSchema,
    SponsorshipUpdateInputSchema
} from '@repo/schemas';
import { toSlug } from '@repo/utils';
import { BaseCrudService } from '../../base/base.crud.service';
import { ServiceError } from '../../types';
import type { Actor, ServiceConfig, ServiceContext } from '../../types';
import {
    checkCanAdminList,
    checkCanCount,
    checkCanCreate,
    checkCanHardDelete,
    checkCanList,
    checkCanManageSponsorshipStatus,
    checkCanRestore,
    checkCanSearch,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanUpdateVisibility,
    checkCanView
} from './sponsorship.permissions';

/**
 * Service for managing sponsorships.
 * Provides CRUD operations and permission/lifecycle hooks for Sponsorship entities.
 * Ownership-scoped access control is enforced via `sponsorUserId` comparisons.
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
    protected readonly levelModel: SponsorshipLevelModel;

    protected readonly createSchema = SponsorshipCreateInputSchema;
    protected readonly updateSchema = SponsorshipUpdateInputSchema;
    protected readonly searchSchema = SponsorshipSearchSchema;

    protected getDefaultListRelations() {
        return { sponsorUser: true, level: true, package: true };
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Sponsorships are searched by slug and coupon code.
     */
    protected override getSearchableColumns(): string[] {
        return ['slug', 'couponCode'];
    }

    constructor(
        ctx: ServiceConfig & { model?: SponsorshipModel; levelModel?: SponsorshipLevelModel }
    ) {
        super(ctx, SponsorshipService.ENTITY_NAME);
        this.model = ctx.model ?? new SponsorshipModel();
        this.levelModel = ctx.levelModel ?? new SponsorshipLevelModel();
        this.adminSearchSchema = SponsorshipAdminSearchSchema;
    }

    /**
     * Lifecycle hook: runs after `_canCreate` and before persistence.
     *
     * SPEC-117 follow-up #3 — auto-generate `slug` from sponsor + target when
     * not provided. The DB column is NOT NULL; the create schema marks slug
     * optional, so the gap was filled by callers (admin dialog, web flow) on
     * their own. This hook closes the gap server-side.
     *
     * SPEC-117 follow-up #4 — validate that the chosen level's `target_type`
     * matches the sponsorship's `targetType`. Without this, the DB FK accepts
     * any combination and Postgres returns an opaque DATABASE_ERROR when a
     * downstream constraint trips (or worse, the row persists with mismatched
     * semantics). Surface a clear 400 instead.
     */
    protected async _beforeCreate(
        data: SponsorshipCreateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<Sponsorship>> {
        const updates: Partial<Sponsorship> = {};

        if (data.levelId) {
            const level = await this.levelModel.findById(data.levelId);
            if (!level) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    `Sponsorship level ${data.levelId} does not exist`
                );
            }
            if (level.targetType !== data.targetType) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    `Level "${level.name}" applies to ${level.targetType}, not ${data.targetType}. Choose a matching level.`
                );
            }
        }

        if (!data.slug || data.slug.trim().length === 0) {
            const base = `${data.targetType ?? 'sponsorship'}-${data.sponsorUserId?.slice(0, 8) ?? ''}`;
            const suffix = Date.now().toString(36);
            updates.slug = `${toSlug(base) || 'sponsorship'}-${suffix}`;
        }

        return updates;
    }

    /**
     * Permission hook: checks if the actor can create a sponsorship.
     * Requires `SPONSORSHIP_CREATE`.
     */
    protected _canCreate(actor: Actor, data: SponsorshipCreateInput): void {
        checkCanCreate(actor, data);
    }

    /**
     * Permission hook: checks if the actor can update a sponsorship.
     * Requires `SPONSORSHIP_UPDATE_ANY` for any sponsorship, or
     * `SPONSORSHIP_UPDATE_OWN` if the actor is the sponsor.
     */
    protected _canUpdate(actor: Actor, entity: Sponsorship): void {
        checkCanUpdate(actor, entity);
    }

    /**
     * Lifecycle hook: runs after `_canUpdate` and before persistence.
     *
     * Adds a field-level guard for the `sponsorshipStatus` field per SPEC-063
     * Phase 3 R6 — actors with `SPONSORSHIP_UPDATE_*` cannot mutate
     * `sponsorshipStatus` unless they ALSO hold `SPONSORSHIP_STATUS_MANAGE`.
     *
     * Returns the data unchanged (no normalization performed here).
     */
    protected async _beforeUpdate(
        data: Partial<Sponsorship>,
        actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<Sponsorship>> {
        checkCanManageSponsorshipStatus(actor, data);
        return data;
    }

    /**
     * Permission hook: checks if the actor can soft-delete a sponsorship.
     * Requires `SPONSORSHIP_SOFT_DELETE_ANY` for any sponsorship, or
     * `SPONSORSHIP_SOFT_DELETE_OWN` if the actor is the sponsor.
     */
    protected _canSoftDelete(actor: Actor, entity: Sponsorship): void {
        checkCanSoftDelete(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can hard-delete a sponsorship.
     * Requires `SPONSORSHIP_HARD_DELETE_ANY` for any sponsorship, or
     * `SPONSORSHIP_HARD_DELETE_OWN` if the actor is the sponsor.
     */
    protected _canHardDelete(actor: Actor, entity: Sponsorship): void {
        checkCanHardDelete(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can restore a sponsorship.
     * Requires `SPONSORSHIP_RESTORE_ANY` for any sponsorship, or
     * `SPONSORSHIP_RESTORE_OWN` if the actor is the sponsor.
     */
    protected _canRestore(actor: Actor, entity: Sponsorship): void {
        checkCanRestore(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can view a sponsorship.
     * Requires `SPONSORSHIP_VIEW_ANY` for any sponsorship, or
     * `SPONSORSHIP_VIEW_OWN` if the actor is the sponsor.
     */
    protected _canView(actor: Actor, entity: Sponsorship): void {
        checkCanView(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can list sponsorships.
     * Requires `SPONSORSHIP_VIEW_ANY` or `SPONSORSHIP_VIEW_OWN`.
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * Permission hook: checks if the actor can search sponsorships.
     * Requires `SPONSORSHIP_VIEW_ANY` or `SPONSORSHIP_VIEW_OWN`.
     */
    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    /**
     * Permission hook: checks if the actor can count sponsorships.
     * Requires `SPONSORSHIP_VIEW_ANY` or `SPONSORSHIP_VIEW_OWN`.
     */
    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    /**
     * Permission hook: checks if the actor can update the visibility of a sponsorship.
     * Requires `SPONSORSHIP_UPDATE_VISIBILITY_ANY` for any sponsorship, or
     * `SPONSORSHIP_UPDATE_VISIBILITY_OWN` if the actor is the sponsor.
     */
    protected _canUpdateVisibility(
        actor: Actor,
        entity: Sponsorship,
        _newVisibility: unknown
    ): void {
        checkCanUpdateVisibility(actor, entity);
    }

    /**
     * Permission hook: checks if the actor can use admin list for sponsorships.
     * Requires admin access (base class) plus SPONSORSHIP_VIEW_ANY.
     * Calls super to enforce ACCESS_PANEL_ADMIN / ACCESS_API_ADMIN first, then
     * applies the entity-specific SPONSORSHIP_VIEW_ANY check.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }

    /**
     * Executes the search for sponsorships.
     *
     * AC-005-01 security hardening: public/protected list endpoints force
     * `lifecycleState = ACTIVE` regardless of caller-supplied value.
     * Admin list uses the separate `adminList()` pipeline so it is unaffected.
     */
    protected async _executeSearch(
        params: SponsorshipSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        const { page = 1, pageSize = 20, ...filterParams } = params;
        // Force-override: never trust caller-supplied lifecycleState on public path.
        (filterParams as Record<string, unknown>).lifecycleState = LifecycleStatusEnum.ACTIVE;
        return this.model.findAll(filterParams, { page, pageSize });
    }

    /**
     * Executes the count for sponsorships.
     *
     * Mirrors `_executeSearch` force-override so pagination `total` stays
     * consistent with filtered items on public endpoints.
     */
    protected async _executeCount(
        params: SponsorshipSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        const { page: _page, pageSize: _pageSize, ...filterParams } = params;
        (filterParams as Record<string, unknown>).lifecycleState = LifecycleStatusEnum.ACTIVE;
        const count = await this.model.count(filterParams);
        return { count };
    }
}
