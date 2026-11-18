import { HostTradeCategoryGroupModel, hostTradeCategoryGroups } from '@repo/db';
import type {
    HostTradeCategoryGroup,
    HostTradeCategoryGroupAdminSearch,
    HostTradeCategoryGroupCreateInput
} from '@repo/schemas';
import {
    HostTradeCategoryGroupAdminSearchSchema,
    HostTradeCategoryGroupCreateInputSchema,
    HostTradeCategoryGroupUpdateInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { BaseCrudService } from '../../base/base.crud.service';
import {
    type Actor,
    type AdminSearchExecuteParams,
    type PaginatedListOutput,
    type ServiceConfig,
    type ServiceContext,
    ServiceError,
    type ServiceOutput
} from '../../types';
import { runInServiceTransaction } from '../../utils/service-transaction';
import {
    checkCanCreateHostTradeCatalog,
    checkCanDeleteHostTradeCatalog,
    checkCanHardDeleteHostTradeCatalog,
    checkCanRestoreHostTradeCatalog,
    checkCanUpdateHostTradeCatalog,
    checkCanViewHostTradeCatalog
} from './host-trade-category.permissions';
import { buildCatalogSearchCondition } from './host-trade-category.search';

/** `hookState` key carrying the raw admin search term to `_executeAdminSearch`. */
const ADMIN_SEARCH_TERM_KEY = 'adminSearchTerm';

/**
 * `hookState` key telling `_executeAdminSearch` whether the caller sent an explicit
 * `sort` (HOS-2340). `AdminSearchBaseSchema.sort` has a Zod default, so after
 * validation an omitted sort and an explicit `createdAt:desc` are indistinguishable.
 */
const ADMIN_HAS_EXPLICIT_SORT_KEY = 'adminHasExplicitSort';

/**
 * Service for the provider-trade category GROUPS (HOS-919): the headings under
 * which categories are listed in the selector and on the marketing page.
 *
 * Rules (spec section 3):
 * - create and update go through the catalog schemas (`slug` is immutable: the
 *   update schema is strict and does not accept it);
 * - a slug is never reusable, even after the group is soft-deleted;
 * - deactivating a group is always allowed (it hides the group and its
 *   categories from the public catalog);
 * - soft-deleting a group that still has non-deleted categories answers
 *   `CATEGORY_IN_USE` (HTTP 409);
 * - restore is allowed.
 *
 * @extends BaseCrudService
 */
export class HostTradeCategoryGroupService extends BaseCrudService<
    HostTradeCategoryGroup,
    HostTradeCategoryGroupModel,
    typeof HostTradeCategoryGroupCreateInputSchema,
    typeof HostTradeCategoryGroupUpdateInputSchema,
    typeof HostTradeCategoryGroupAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'hostTradeCategoryGroup';
    protected readonly entityName = HostTradeCategoryGroupService.ENTITY_NAME;
    public readonly model: HostTradeCategoryGroupModel;

    public readonly createSchema = HostTradeCategoryGroupCreateInputSchema;
    public readonly updateSchema = HostTradeCategoryGroupUpdateInputSchema;
    public readonly searchSchema = HostTradeCategoryGroupAdminSearchSchema;
    protected readonly adminSearchSchema = HostTradeCategoryGroupAdminSearchSchema;

    constructor(ctx: ServiceConfig, model?: HostTradeCategoryGroupModel) {
        super(ctx, HostTradeCategoryGroupService.ENTITY_NAME);
        this.model = model ?? new HostTradeCategoryGroupModel();
    }

    protected getDefaultListRelations() {
        return undefined;
    }

    /**
     * No plain-column search: the text search spans slug and per-locale names,
     * built by {@link buildCatalogSearchCondition} in `_executeAdminSearch`.
     */
    protected override getSearchableColumns(): string[] {
        return [];
    }

    protected _canCreate(actor: Actor): void {
        checkCanCreateHostTradeCatalog(actor);
    }
    protected _canUpdate(actor: Actor): void {
        checkCanUpdateHostTradeCatalog(actor);
    }
    protected _canView(actor: Actor): void {
        checkCanViewHostTradeCatalog(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanViewHostTradeCatalog(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanViewHostTradeCatalog(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanViewHostTradeCatalog(actor);
    }
    protected _canSoftDelete(actor: Actor): void {
        checkCanDeleteHostTradeCatalog(actor);
    }
    protected _canHardDelete(actor: Actor): void {
        checkCanHardDeleteHostTradeCatalog(actor);
    }
    protected _canRestore(actor: Actor): void {
        checkCanRestoreHostTradeCatalog(actor);
    }
    protected _canUpdateVisibility(actor: Actor): void {
        checkCanUpdateHostTradeCatalog(actor);
    }

    /**
     * Refuses a slug that already exists, soft-deleted rows included (a deleted
     * slug stays reserved). The DB unique constraint is the backstop; this
     * answers with a typed error instead of a driver failure.
     */
    protected override async _beforeCreate(
        data: HostTradeCategoryGroupCreateInput,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<Partial<HostTradeCategoryGroup>> {
        const existing = await this.model.findOne({ slug: data.slug }, ctx?.tx);
        if (existing) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                `A category group with slug "${data.slug}" already exists`,
                { field: 'slug', slug: data.slug }
            );
        }
        return data;
    }

    /**
     * Soft-deletes a group inside ONE transaction (the caller's when `ctx.tx` is
     * set), so the child check in {@link _beforeSoftDelete} and the delete
     * itself cannot be interleaved with a concurrent category write.
     */
    public override async softDelete(
        actor: Actor,
        id: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ count: number }>> {
        return runInServiceTransaction(ctx, (txCtx) => super.softDelete(actor, id, txCtx));
    }

    /**
     * Blocks deleting a group that still has non-deleted categories (AC-3.4).
     * Deactivating is the supported way to retire a group with children.
     *
     * Locks the group row first (`SELECT ... FOR UPDATE`). Category writes
     * validate their group with `FOR SHARE` (`findByIdForShare`), which
     * conflicts with it, so a concurrent category create, move or restore and
     * this delete serialize: the second one sees the first one's result.
     *
     * @throws {ServiceError} `CATEGORY_IN_USE` when any non-deleted child exists.
     */
    protected override async _beforeSoftDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<string> {
        await this.model.lockForUpdate(id, ctx?.tx);
        const children = await this.model.countActiveChildren(id, ctx?.tx);
        if (children > 0) {
            throw new ServiceError(
                ServiceErrorCode.CATEGORY_IN_USE,
                'This group still has categories. Deactivate it instead, or remove its categories first.',
                { groupId: id, categoryCount: children }
            );
        }
        return id;
    }

    /**
     * Admin list. Carries the raw `search` term to {@link _executeAdminSearch}
     * through `hookState`, because the base class only turns it into SQL over
     * plain columns, and whether the caller sent an explicit `sort` (read from the
     * RAW params, before the schema default hides it).
     */
    public override async adminList(
        actor: Actor,
        params: Record<string, unknown>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PaginatedListOutput<HostTradeCategoryGroup>>> {
        const term = typeof params.search === 'string' ? params.search : undefined;
        return super.adminList(actor, params, {
            ...ctx,
            hookState: {
                ...ctx?.hookState,
                [ADMIN_SEARCH_TERM_KEY]: term,
                [ADMIN_HAS_EXPLICIT_SORT_KEY]: typeof params.sort === 'string'
            }
        });
    }

    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams
    ): Promise<PaginatedListOutput<HostTradeCategoryGroup>> {
        const term = params.ctx?.hookState?.[ADMIN_SEARCH_TERM_KEY];
        const textCondition = buildCatalogSearchCondition({
            term: typeof term === 'string' ? term : undefined,
            columns: hostTradeCategoryGroups
        });
        const extraConditions: SQL[] = [...(params.extraConditions ?? [])];
        if (textCondition) extraConditions.push(textCondition);
        if (params.ctx?.hookState?.[ADMIN_HAS_EXPLICIT_SORT_KEY] === true) {
            return super._executeAdminSearch({ ...params, extraConditions });
        }
        // No explicit sort: display weight, Spanish name, id (HOS-2340 D3).
        return this.model.findAdminPage({
            where: { ...params.where, ...params.entityFilters },
            additionalConditions: [...(params.search ? [params.search] : []), ...extraConditions],
            page: params.pagination.page,
            pageSize: params.pagination.pageSize,
            tx: params.ctx?.tx
        });
    }

    protected async _executeSearch(
        params: HostTradeCategoryGroupAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<HostTradeCategoryGroup>> {
        const where = this.buildSearchWhere(params);
        return this.model.findAll(
            where,
            {
                page: ctx.pagination?.page ?? 1,
                pageSize: ctx.pagination?.pageSize ?? 10,
                sortBy: ctx.pagination?.sortBy,
                sortOrder: ctx.pagination?.sortOrder
            },
            undefined,
            ctx.tx
        );
    }

    protected async _executeCount(
        params: HostTradeCategoryGroupAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<{ count: number }> {
        const count = await this.model.count(this.buildSearchWhere(params), { tx: ctx.tx });
        return { count };
    }

    /** Translates the validated search params into a model `where` map. */
    private buildSearchWhere(params: HostTradeCategoryGroupAdminSearch): Record<string, unknown> {
        // Soft-deleted rows are excluded explicitly: `BaseModelImpl.findAll` does not.
        const where: Record<string, unknown> = { deletedAt: null };
        if (params.lifecycleState !== undefined) where.lifecycleState = params.lifecycleState;
        return where;
    }
}
