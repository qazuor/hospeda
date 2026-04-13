import { SponsorshipModel } from '@repo/db';
import type {
    EntityFilters,
    Sponsorship,
    SponsorshipCreateInput,
    SponsorshipSearchInput
} from '@repo/schemas';
import {
    SponsorshipAdminSearchSchema,
    SponsorshipCreateInputSchema,
    SponsorshipSearchSchema,
    SponsorshipUpdateInputSchema
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type {
    Actor,
    AdminSearchExecuteParams,
    PaginatedListOutput,
    ServiceConfig
} from '../../types';
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
    checkCanUpdateVisibility,
    checkCanView
} from './sponsorship.permissions';

/** Entity-specific filter fields for sponsorship admin search. */
type SponsorshipEntityFilters = EntityFilters<typeof SponsorshipAdminSearchSchema>;

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

    constructor(ctx: ServiceConfig & { model?: SponsorshipModel }) {
        super(ctx, SponsorshipService.ENTITY_NAME);
        this.model = ctx.model ?? new SponsorshipModel();
        this.adminSearchSchema = SponsorshipAdminSearchSchema;
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
     * Executes admin search with column rename for sponsorship status.
     *
     * The `sponsorships` table has no `lifecycleState` column, so the base
     * `status` filter from `AdminSearchBaseSchema` is silently ignored by
     * `buildWhereClause`. The entity-specific `sponsorshipStatus` filter is
     * remapped to the DB `status` column here.
     *
     * @param params - The assembled admin search parameters.
     * @returns A paginated list of matching sponsorships.
     */
    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams<SponsorshipEntityFilters>
    ): Promise<PaginatedListOutput<Sponsorship>> {
        const { entityFilters, ...rest } = params;
        const { sponsorshipStatus, ...otherFilters } = entityFilters;
        const mappedFilters: Record<string, unknown> = { ...otherFilters };
        if (sponsorshipStatus) {
            mappedFilters.status = sponsorshipStatus;
        }
        return super._executeAdminSearch({ ...rest, entityFilters: mappedFilters });
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
        const { page: _page, limit: _limit, ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }
}
