import { SponsorshipModel } from '@repo/db';
import type { Sponsorship, SponsorshipCreateInput, SponsorshipSearchInput } from '@repo/schemas';
import {
    SponsorshipAdminSearchSchema,
    SponsorshipCreateInputSchema,
    SponsorshipSearchSchema,
    SponsorshipUpdateInputSchema
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, PaginatedListOutput, ServiceContext } from '../../types';
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

    protected readonly createSchema = SponsorshipCreateInputSchema;
    protected readonly updateSchema = SponsorshipUpdateInputSchema;
    protected readonly searchSchema = SponsorshipSearchSchema;

    protected getDefaultListRelations() {
        return { sponsorUser: true, level: true, package: true };
    }

    constructor(ctx: ServiceContext & { model?: SponsorshipModel }) {
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
    protected override async _executeAdminSearch(params: {
        readonly where: Record<string, unknown>;
        readonly entityFilters: Record<string, unknown>;
        readonly pagination: { readonly page: number; readonly pageSize: number };
        readonly sort: { readonly sortBy: string; readonly sortOrder: 'asc' | 'desc' };
        readonly search?: SQL;
        readonly extraConditions?: SQL[];
        readonly actor: Actor;
    }): Promise<PaginatedListOutput<Sponsorship>> {
        const { entityFilters, ...rest } = params;

        const { sponsorshipStatus, ...otherFilters } = entityFilters as {
            sponsorshipStatus?: string;
            [key: string]: unknown;
        };

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
        const { page, limit, ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }
}
