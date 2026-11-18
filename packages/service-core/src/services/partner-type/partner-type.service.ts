import { PartnerTypeModel, partnerTypes } from '@repo/db';
import type {
    PartnerType,
    PartnerTypeAdminListItem,
    PartnerTypeAdminSearch,
    PartnerTypeCreateInput,
    PartnerTypeUpdateInput,
    PublicPartnerTypeList
} from '@repo/schemas';
import {
    LifecycleStatusEnum,
    PartnerTypeAdminSearchSchema,
    PartnerTypeCreateInputSchema,
    PartnerTypeUpdateInputSchema,
    PublicPartnerTypeListSchema,
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
import { runInServiceTransaction } from '../../utils/service-transaction';
import { buildCatalogSearchCondition } from '../host-trade-category/host-trade-category.search';
import {
    checkCanCreatePartnerType,
    checkCanDeletePartnerType,
    checkCanHardDeletePartnerType,
    checkCanRestorePartnerType,
    checkCanUpdatePartnerType,
    checkCanViewPartnerType
} from './partner-type.permissions';

/** `hookState` key carrying the raw admin search term to `_executeAdminSearch`. */
const ADMIN_SEARCH_TERM_KEY = 'adminSearchTerm';

/** `hookState` key carrying the id being updated to `_beforeUpdate`. */
const UPDATE_ID_KEY = 'partnerTypeUpdateId';

/**
 * Service for the partner type catalog (HOS-2336): the admin-managed list a
 * partner points at through `partners.type_id`.
 *
 * Rules (spec section 4, US-3):
 * - `slug` is immutable (the update schema is strict and rejects it) and never
 *   reusable, even after a soft delete (`ALREADY_EXISTS`, 409);
 * - deactivating (any `lifecycleState` other than `ACTIVE`) or soft-deleting a
 *   type used by at least one NON-deleted partner answers
 *   `PARTNER_TYPE_IN_USE` (409) with the partner `count` in the details, and
 *   nothing changes (AC-3.4);
 * - restore is allowed;
 * - the public list is a guest-readable read ({@link getPublicList}).
 *
 * The in-use check and the write it guards run in ONE transaction with the
 * type row locked `FOR UPDATE`; partner writes read the type `FOR SHARE`, so a
 * concurrent assignment and a deactivation serialize.
 *
 * @extends BaseCrudService
 */
export class PartnerTypeService extends BaseCrudService<
    PartnerType,
    PartnerTypeModel,
    typeof PartnerTypeCreateInputSchema,
    typeof PartnerTypeUpdateInputSchema,
    typeof PartnerTypeAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'partnerType';
    protected readonly entityName = PartnerTypeService.ENTITY_NAME;
    public readonly model: PartnerTypeModel;

    public readonly createSchema = PartnerTypeCreateInputSchema;
    public readonly updateSchema = PartnerTypeUpdateInputSchema;
    public readonly searchSchema = PartnerTypeAdminSearchSchema;
    protected readonly adminSearchSchema = PartnerTypeAdminSearchSchema;

    constructor(ctx: ServiceConfig, model?: PartnerTypeModel) {
        super(ctx, PartnerTypeService.ENTITY_NAME);
        this.model = model ?? new PartnerTypeModel();
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
        checkCanCreatePartnerType(actor);
    }
    protected _canUpdate(actor: Actor): void {
        checkCanUpdatePartnerType(actor);
    }
    protected _canView(actor: Actor): void {
        checkCanViewPartnerType(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanViewPartnerType(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanViewPartnerType(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanViewPartnerType(actor);
    }
    protected _canSoftDelete(actor: Actor): void {
        checkCanDeletePartnerType(actor);
    }
    protected _canHardDelete(actor: Actor): void {
        checkCanHardDeletePartnerType(actor);
    }
    protected _canRestore(actor: Actor): void {
        checkCanRestorePartnerType(actor);
    }
    protected _canUpdateVisibility(actor: Actor): void {
        checkCanUpdatePartnerType(actor);
    }

    /**
     * Refuses a slug that already exists, soft-deleted rows included (a deleted
     * slug stays reserved, AC-3.2). The DB unique constraint is the backstop;
     * this answers with a typed error instead of a driver failure.
     */
    protected override async _beforeCreate(
        data: PartnerTypeCreateInput,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<Partial<PartnerType>> {
        const existing = await this.model.findOne({ slug: data.slug }, ctx?.tx);
        if (existing) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                `A partner type with slug "${data.slug}" already exists`,
                { field: 'slug', slug: data.slug }
            );
        }
        return data;
    }

    /**
     * Updates a type inside ONE transaction, carrying the id to
     * {@link _beforeUpdate} so the deactivation guard can lock and count.
     */
    public override async update(
        actor: Actor,
        id: string,
        data: PartnerTypeUpdateInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PartnerType>> {
        return runInServiceTransaction(ctx, (txCtx) =>
            super.update(actor, id, data, {
                ...txCtx,
                hookState: { ...txCtx.hookState, [UPDATE_ID_KEY]: id }
            })
        );
    }

    /**
     * Refuses to deactivate a type that a non-deleted partner uses (AC-3.4).
     * Runs after validation (400), existence (404) and permission (403), so the
     * error order of the contract holds.
     *
     * @throws {ServiceError} `PARTNER_TYPE_IN_USE` with `details.count`.
     */
    protected override async _beforeUpdate(
        data: PartnerTypeUpdateInput,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<Partial<PartnerType>> {
        const id = ctx?.hookState?.[UPDATE_ID_KEY];
        if (
            typeof id === 'string' &&
            data.lifecycleState !== undefined &&
            data.lifecycleState !== LifecycleStatusEnum.ACTIVE
        ) {
            await this.assertUnused(id, ctx);
        }
        return data;
    }

    /** @see {@link update} for why this runs in a transaction. */
    public override async restore(
        actor: Actor,
        id: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ count: number }>> {
        return runInServiceTransaction(ctx, (txCtx) => super.restore(actor, id, txCtx));
    }

    /**
     * Soft-deletes a type inside ONE transaction, so the in-use check in
     * {@link _beforeSoftDelete} and the delete cannot be interleaved with a
     * concurrent partner write.
     */
    public override async softDelete(
        actor: Actor,
        id: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ count: number }>> {
        return runInServiceTransaction(ctx, (txCtx) => super.softDelete(actor, id, txCtx));
    }

    /**
     * Blocks deleting a type that a non-deleted partner uses (AC-3.4).
     *
     * @throws {ServiceError} `PARTNER_TYPE_IN_USE` with `details.count`.
     */
    protected override async _beforeSoftDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<string> {
        await this.assertUnused(id, ctx);
        return id;
    }

    /**
     * Locks the type row `FOR UPDATE` and counts the non-deleted partners that
     * use it. The lock conflicts with the `FOR SHARE` every partner write takes
     * on its type, so the count cannot be stale by the time the write commits.
     *
     * @throws {ServiceError} `PARTNER_TYPE_IN_USE` when the count is above zero.
     */
    private async assertUnused(id: string, ctx: ServiceContext): Promise<void> {
        await this.model.lockForUpdate(id, ctx?.tx);
        const count = await this.model.countPartners(id, ctx?.tx);
        if (count > 0) {
            throw new ServiceError(
                ServiceErrorCode.PARTNER_TYPE_IN_USE,
                'This partner type is used by partners. Assign them another type first.',
                { partnerTypeId: id, count }
            );
        }
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
    ): Promise<ServiceOutput<PaginatedListOutput<PartnerType>>> {
        const term = typeof params.search === 'string' ? params.search : undefined;
        return super.adminList(actor, params, {
            ...ctx,
            hookState: { ...ctx?.hookState, [ADMIN_SEARCH_TERM_KEY]: term }
        });
    }

    /**
     * Adds `partnerCount` (non-deleted partners per type) to each admin row in
     * ONE grouped query (AC-3.1).
     */
    protected override async _afterAdminList(
        result: PaginatedListOutput<PartnerType>,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<PartnerType>> {
        const counts = await this.model.countPartnersByTypeIds(
            result.items.map((item) => item.id),
            ctx?.tx
        );
        const items: PartnerTypeAdminListItem[] = result.items.map((item) => ({
            ...item,
            partnerCount: counts.get(item.id) ?? 0
        }));
        return { ...result, items };
    }

    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams
    ): Promise<PaginatedListOutput<PartnerType>> {
        const term = params.ctx?.hookState?.[ADMIN_SEARCH_TERM_KEY];
        const textCondition = buildCatalogSearchCondition({
            term: typeof term === 'string' ? term : undefined,
            columns: partnerTypes
        });
        const extraConditions: SQL[] = [...(params.extraConditions ?? [])];
        if (textCondition) extraConditions.push(textCondition);
        return super._executeAdminSearch({ ...params, extraConditions });
    }

    protected async _executeSearch(
        params: PartnerTypeAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<PartnerType>> {
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
        params: PartnerTypeAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<{ count: number }> {
        const count = await this.model.count(this.buildSearchWhere(params), { tx: ctx.tx });
        return { count };
    }

    /** Translates the validated search params into a model `where` map. */
    private buildSearchWhere(params: PartnerTypeAdminSearch): Record<string, unknown> {
        // Soft-deleted rows are excluded explicitly: `BaseModelImpl.findAll` does not.
        const where: Record<string, unknown> = { deletedAt: null };
        if (params.lifecycleState !== undefined) where.lifecycleState = params.lifecycleState;
        return where;
    }

    /**
     * Returns the public list: ACTIVE, non-deleted types ordered by weight,
     * Spanish name and slug (`PartnerTypeModel.findPublicList`).
     *
     * No permission is required and a guest actor is fine: the list feeds the
     * anonymous alliance form. The output is validated against
     * {@link PublicPartnerTypeListSchema}, so a field added to the model cannot
     * leak to the public tier unnoticed.
     *
     * @param actor - The actor performing the read (guest allowed).
     * @param ctx - Optional service context.
     * @returns `{ items }`, possibly empty.
     */
    public async getPublicList(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PublicPartnerTypeList>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPublicList',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validated, _actor, execCtx) => {
                const items = await this.model.findPublicList(execCtx?.tx);
                return PublicPartnerTypeListSchema.parse({ items });
            }
        });
    }
}
