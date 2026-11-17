import { HostTradeCategoryGroupModel, HostTradeCategoryModel, hostTradeCategories } from '@repo/db';
import type {
    HostTradeCategory,
    HostTradeCategoryAdminSearch,
    HostTradeCategoryCreateInput,
    HostTradeCategoryUpdateInput,
    PublicHostTradeCatalog
} from '@repo/schemas';
import {
    HostTradeCategoryAdminSearchSchema,
    HostTradeCategoryCreateInputSchema,
    HostTradeCategoryUpdateInputSchema,
    PublicHostTradeCatalogSchema,
    ServiceErrorCode
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { z } from 'zod';
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
import { runInTransaction } from '../hostTrade/host-trade.categories';
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
 * Service for the provider trade CATEGORIES (HOS-919): the editable catalog a
 * provider links to (1..N) through `r_host_trade_category`.
 *
 * Rules (spec section 3):
 * - a category belongs to an existing, non-deleted group (`groupId`);
 * - `slug` is immutable (the update schema is strict) and never reusable, even
 *   after a soft delete;
 * - deactivating (`lifecycleState: INACTIVE`) is always allowed, also while
 *   providers use it: they keep it, it just stops being offered;
 * - soft-deleting a category linked to at least one NON-deleted provider
 *   answers `CATEGORY_IN_USE` (HTTP 409); links held only by soft-deleted
 *   providers do not block;
 * - restore is allowed;
 * - the public catalog is a guest-readable read ({@link getPublicCatalog}).
 *
 * @extends BaseCrudService
 */
export class HostTradeCategoryService extends BaseCrudService<
    HostTradeCategory,
    HostTradeCategoryModel,
    typeof HostTradeCategoryCreateInputSchema,
    typeof HostTradeCategoryUpdateInputSchema,
    typeof HostTradeCategoryAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'hostTradeCategory';
    protected readonly entityName = HostTradeCategoryService.ENTITY_NAME;
    public readonly model: HostTradeCategoryModel;

    public readonly createSchema = HostTradeCategoryCreateInputSchema;
    public readonly updateSchema = HostTradeCategoryUpdateInputSchema;
    public readonly searchSchema = HostTradeCategoryAdminSearchSchema;
    protected readonly adminSearchSchema = HostTradeCategoryAdminSearchSchema;

    /** Group model, used to validate the `groupId` of a create or move. */
    private readonly groupModel: HostTradeCategoryGroupModel;

    constructor(
        ctx: ServiceConfig,
        model?: HostTradeCategoryModel,
        groupModel?: HostTradeCategoryGroupModel
    ) {
        super(ctx, HostTradeCategoryService.ENTITY_NAME);
        this.model = model ?? new HostTradeCategoryModel();
        this.groupModel = groupModel ?? new HostTradeCategoryGroupModel();
    }

    protected getDefaultListRelations() {
        return undefined;
    }

    /**
     * No plain-column search: the text search spans slug, per-locale names and
     * per-locale keywords, built by {@link buildCatalogSearchCondition} in
     * `_executeAdminSearch`.
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
     * Asserts that `groupId` points to an existing, non-deleted group.
     *
     * @throws {ServiceError} VALIDATION_ERROR naming the `groupId` field.
     */
    private async assertGroupUsable(groupId: string, ctx: ServiceContext): Promise<void> {
        const group = await this.groupModel.findById(groupId, ctx?.tx);
        if (!group || group.deletedAt) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'The category group does not exist or was deleted',
                { field: 'groupId', groupId }
            );
        }
    }

    /**
     * Requires a usable group and a slug nobody holds, soft-deleted rows
     * included (a deleted slug stays reserved).
     */
    protected override async _beforeCreate(
        data: HostTradeCategoryCreateInput,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<Partial<HostTradeCategory>> {
        await this.assertGroupUsable(data.groupId, ctx);
        const existing = await this.model.findOne({ slug: data.slug }, ctx?.tx);
        if (existing) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                `A category with slug "${data.slug}" already exists`,
                { field: 'slug', slug: data.slug }
            );
        }
        return data;
    }

    /** Moving a category to another group requires that group to be usable. */
    protected override async _beforeUpdate(
        data: HostTradeCategoryUpdateInput,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<Partial<HostTradeCategory>> {
        if (data.groupId !== undefined) {
            await this.assertGroupUsable(data.groupId, ctx);
        }
        return data;
    }

    /**
     * Refuses to restore a category whose group is still soft-deleted: the
     * category would come back unreachable (hidden with its group) yet be
     * flagged live. Restore the group first.
     *
     * @throws {ServiceError} VALIDATION_ERROR naming the `groupId` field.
     */
    protected override async _beforeRestore(
        id: string,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<string> {
        const category = await this.model.findById(id, ctx?.tx);
        if (category) await this.assertGroupUsable(category.groupId, ctx);
        return id;
    }

    /**
     * Soft-deletes a category inside ONE transaction (the caller's when `ctx.tx`
     * is set), so the in-use check in {@link _beforeSoftDelete} and the delete
     * itself cannot be interleaved with a concurrent link insert.
     */
    public override async softDelete(
        actor: Actor,
        id: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ count: number }>> {
        return runInTransaction(ctx, (txCtx) => super.softDelete(actor, id, txCtx));
    }

    /**
     * Blocks deleting a category that a live provider still uses (AC-3.4).
     *
     * Locks the category row first (`SELECT ... FOR UPDATE`). Provider writes
     * validate their category ids with `FOR SHARE` (`findByIdsForShare`), which
     * conflicts with it, so a concurrent link and this delete serialize: the
     * second one sees the first one's result (a new link makes the count below
     * non-zero; a committed delete makes the write refuse the category). The
     * join table's foreign key does NOT cover this, a soft delete leaves the row
     * in place.
     *
     * @throws {ServiceError} `CATEGORY_IN_USE` when a non-deleted provider links it.
     */
    protected override async _beforeSoftDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<string> {
        await this.model.lockForUpdate(id, ctx?.tx);
        const linked = await this.model.countLinkedHostTrades(id, ctx?.tx);
        if (linked > 0) {
            throw new ServiceError(
                ServiceErrorCode.CATEGORY_IN_USE,
                'This category is used by providers. Deactivate it instead.',
                { categoryId: id, providerCount: linked }
            );
        }
        return id;
    }

    /**
     * Admin list. Carries the raw `search` term to {@link _executeAdminSearch}
     * through `hookState`, because the base class only turns it into SQL over
     * plain columns.
     */
    public override async adminList(
        actor: Actor,
        params: Record<string, unknown>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PaginatedListOutput<HostTradeCategory>>> {
        const term = typeof params.search === 'string' ? params.search : undefined;
        return super.adminList(actor, params, {
            ...ctx,
            hookState: { ...ctx?.hookState, [ADMIN_SEARCH_TERM_KEY]: term }
        });
    }

    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams
    ): Promise<PaginatedListOutput<HostTradeCategory>> {
        const term = params.ctx?.hookState?.[ADMIN_SEARCH_TERM_KEY];
        const textCondition = buildCatalogSearchCondition({
            term: typeof term === 'string' ? term : undefined,
            columns: hostTradeCategories
        });
        const extraConditions: SQL[] = [...(params.extraConditions ?? [])];
        if (textCondition) extraConditions.push(textCondition);
        return super._executeAdminSearch({ ...params, extraConditions });
    }

    protected async _executeSearch(
        params: HostTradeCategoryAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<HostTradeCategory>> {
        return this.model.findAll(
            this.buildSearchWhere(params),
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
        params: HostTradeCategoryAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<{ count: number }> {
        const count = await this.model.count(this.buildSearchWhere(params), { tx: ctx.tx });
        return { count };
    }

    /**
     * Translates the validated search params into a model `where` map. Soft
     * deleted rows are excluded explicitly: `BaseModelImpl.findAll` does not.
     */
    private buildSearchWhere(params: HostTradeCategoryAdminSearch): Record<string, unknown> {
        const where: Record<string, unknown> = { deletedAt: null };
        if (params.lifecycleState !== undefined) where.lifecycleState = params.lifecycleState;
        if (params.groupId !== undefined) where.groupId = params.groupId;
        return where;
    }

    /**
     * Returns the public catalog: active groups with their active categories,
     * ordered by group weight, category weight and name, in ONE query
     * (`HostTradeCategoryModel.findPublicCatalog`).
     *
     * No permission is required and a guest actor is fine: the catalog feeds
     * the anonymous alliance form and the public directory filter. Inactive or
     * deleted rows, and groups left without categories, never appear. The
     * output is validated against {@link PublicHostTradeCatalogSchema}, so a
     * field added to the model cannot leak to the public tier unnoticed.
     *
     * @param actor - The actor performing the read (guest allowed).
     * @param ctx - Optional service context.
     * @returns `{ groups }`, possibly empty.
     */
    public async getPublicCatalog(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PublicHostTradeCatalog>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPublicCatalog',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validated, _actor, execCtx) => {
                const catalog = await this.model.findPublicCatalog(execCtx?.tx);
                return PublicHostTradeCatalogSchema.parse(catalog);
            }
        });
    }
}
