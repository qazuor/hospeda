import {
    PoiCategoryModel,
    PointOfInterestModel,
    poiCategories,
    pointsOfInterest,
    RPoiCategoryModel,
    safeIlike
} from '@repo/db';
import type {
    CountResponse,
    PoiCategory,
    PoiCategoryIdType,
    PoiCategoryPublic,
    PointOfInterest,
    PointOfInterestCategoryAssignment,
    PointOfInterestCategoryRelation,
    PointOfInterestIdType
} from '@repo/schemas';
import {
    type AssignCategoryToPointOfInterestInput,
    AssignCategoryToPointOfInterestInputSchema,
    deriveTypeFromCategorySlug,
    type PoiCategoriesByPointOfInterestInput,
    PoiCategoriesByPointOfInterestInputSchema,
    PoiCategoryCreateInputSchema,
    type PoiCategorySearchInput,
    PoiCategorySearchInputSchema,
    PoiCategoryUpdateInputSchema,
    type PointOfInterestSetCategoriesInput,
    PointOfInterestSetCategoriesInputSchema,
    type PointsOfInterestByPoiCategoryInput,
    PointsOfInterestByPoiCategoryInputSchema,
    ServiceErrorCode,
    type SetPrimaryCategoryInput,
    SetPrimaryCategoryInputSchema,
    type UnassignCategoryFromPointOfInterestInput,
    UnassignCategoryFromPointOfInterestInputSchema
} from '@repo/schemas';
import { inArray, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { BaseCrudRelatedService } from '../../base/base.crud.related.service';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import {
    type Actor,
    type PaginatedListOutput,
    type ServiceConfig,
    type ServiceContext,
    ServiceError,
    type ServiceOutput
} from '../../types';
import { withServiceTransaction } from '../../utils/transaction';
import {
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeViewInput
} from './poi-category.normalizers';
import {
    checkCanAdminList,
    checkCanCreatePoiCategory,
    checkCanDeletePoiCategory,
    checkCanHardDeletePoiCategory,
    checkCanListPoiCategories,
    checkCanListPublicPoiCategories,
    checkCanRestorePoiCategory,
    checkCanUpdatePoiCategory,
    checkCanViewPoiCategory
} from './poi-category.permissions';

/**
 * Upper bound for a single POI's category-relation lookup (mirrors
 * `AttractionService`'s `DESTINATION_RELATIONS_PAGE_SIZE` precedent). The
 * base model caps `pageSize` at `MAX_PAGE_SIZE` (200), so this pulls the
 * full relation set for a single POI rather than the default page of 20.
 */
const POI_CATEGORY_RELATIONS_PAGE_SIZE = 200;

/**
 * Service for managing the POI category catalog + POI assignment (HOS-139).
 * Implements the catalog's own CRUD (create/update/delete/restore/list/
 * search a `poi_categories` row — same 12-method permission-hook shape as
 * `PointOfInterestService`), plus dedicated methods for the
 * `r_poi_category` join, mirroring `PointOfInterestService`'s
 * `addPointOfInterestToDestination`/`removePointOfInterestFromDestination`
 * shape (spec §6.4).
 *
 * Every method that changes which category is primary
 * (`assignCategoryToPointOfInterest` with `isPrimary: true`,
 * `setPrimaryCategory`, and `unassignCategoryFromPointOfInterest`'s
 * auto-promotion path) also writes the derived `points_of_interest.type` in
 * the SAME transaction (spec §6.5/§7.6, HOS-138 R-4) via
 * {@link deriveTypeFromCategorySlug} — never a separate call the caller can
 * forget.
 *
 * @extends BaseCrudRelatedService
 */
export class PointOfInterestCategoryService extends BaseCrudRelatedService<
    PoiCategory,
    PoiCategoryModel,
    RPoiCategoryModel,
    typeof PoiCategoryCreateInputSchema,
    typeof PoiCategoryUpdateInputSchema,
    typeof PoiCategorySearchInputSchema
> {
    static readonly ENTITY_NAME = 'poiCategory';
    protected readonly entityName = PointOfInterestCategoryService.ENTITY_NAME;
    public readonly model: PoiCategoryModel;

    public readonly createSchema = PoiCategoryCreateInputSchema;
    public readonly updateSchema = PoiCategoryUpdateInputSchema;
    public readonly searchSchema = PoiCategorySearchInputSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    /**
     * Returns the columns to search against when the `search` query param is
     * provided. POI categories are searched by `slug` — `nameI18n` is JSONB
     * content, not a plain text column (mirrors `PointOfInterestService`'s
     * `['slug', 'description']` precedent, restricted to the one plain text
     * column this entity has).
     */
    protected override getSearchableColumns(): string[] {
        return ['slug'];
    }

    /** POI model, used to read/write `points_of_interest.type` during the primary-category sync (spec §6.5). */
    protected readonly pointOfInterestModel: PointOfInterestModel;
    protected normalizers: CrudNormalizersFromSchemas<
        typeof PoiCategoryCreateInputSchema,
        typeof PoiCategoryUpdateInputSchema,
        typeof PoiCategorySearchInputSchema
    > = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput,
        list: normalizeListInput,
        view: normalizeViewInput
    };

    constructor(
        ctx: ServiceConfig,
        model?: PoiCategoryModel,
        relatedModel?: RPoiCategoryModel,
        pointOfInterestModel?: PointOfInterestModel
    ) {
        super(ctx, PointOfInterestCategoryService.ENTITY_NAME, relatedModel);
        this.model = model ?? new PoiCategoryModel();
        this.pointOfInterestModel = pointOfInterestModel ?? new PointOfInterestModel();
    }

    protected _canCreate(actor: Actor): void {
        checkCanCreatePoiCategory(actor);
    }
    protected _canUpdate(actor: Actor): void {
        checkCanUpdatePoiCategory(actor);
    }
    protected _canView(actor: Actor): void {
        checkCanViewPoiCategory(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanListPoiCategories(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanListPoiCategories(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanListPoiCategories(actor);
    }
    protected _canSoftDelete(actor: Actor): void {
        checkCanDeletePoiCategory(actor);
    }
    protected _canHardDelete(actor: Actor): void {
        checkCanHardDeletePoiCategory(actor);
    }
    protected _canRestore(actor: Actor): void {
        checkCanRestorePoiCategory(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: PoiCategory,
        _newVisibility?: unknown
    ): void {
        checkCanUpdatePoiCategory(actor);
    }
    protected _canAssignCategoryToPointOfInterest(actor: Actor): void {
        checkCanCreatePoiCategory(actor);
    }
    protected _canUnassignCategoryFromPointOfInterest(actor: Actor): void {
        checkCanDeletePoiCategory(actor);
    }
    protected _canSetPrimaryCategory(actor: Actor): void {
        checkCanUpdatePoiCategory(actor);
    }
    /**
     * Full-replace of a POI's category set (spec §6.4, HOS-143 T-006) is
     * gated the same as {@link setPrimaryCategory} — it mutates the same
     * "which categories + which is primary" state, just for the whole set at
     * once instead of one relation. No dedicated permission is minted (spec
     * §7.3 precedent: reuse the existing `POI_CATEGORY_*` family).
     */
    protected _canSetCategoriesForPointOfInterest(actor: Actor): void {
        checkCanUpdatePoiCategory(actor);
    }
    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks entity-specific permission.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }
    protected createDefaultRelatedModel(): RPoiCategoryModel {
        return new RPoiCategoryModel();
    }

    /**
     * Assigns a category to a point of interest (spec §6.4). Creates the
     * `r_poi_category` join row.
     *
     * If `isPrimary: true` is passed and the POI already has a DIFFERENT
     * primary category, the existing primary's row is flipped to
     * `isPrimary: false` in the SAME transaction — never two primaries
     * simultaneously, reinforcing the DB partial unique index rather than
     * racing against it. The derived `points_of_interest.type` (spec
     * §6.5/§7.6) is also written in that same transaction.
     *
     * @param actor - The actor performing the action.
     * @param params - `pointOfInterestId`, `categoryId`, and optional `isPrimary`.
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async assignCategoryToPointOfInterest(
        actor: Actor,
        params: AssignCategoryToPointOfInterestInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ relation: PointOfInterestCategoryRelation }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'assignCategoryToPointOfInterest',
            input: { ...params, actor },
            schema: AssignCategoryToPointOfInterestInputSchema,
            ctx,
            execute: async (validatedParams, actor, execCtx) => {
                this._canAssignCategoryToPointOfInterest(actor);
                const { pointOfInterestId, categoryId, isPrimary } = validatedParams;

                const [pointOfInterest, category, existing] = await Promise.all([
                    this.pointOfInterestModel.findOne(
                        { id: pointOfInterestId as PointOfInterestIdType },
                        execCtx?.tx
                    ),
                    this.model.findOne({ id: categoryId as PoiCategoryIdType }, execCtx?.tx),
                    this.relatedModel.findOne(
                        {
                            pointOfInterestId: pointOfInterestId as PointOfInterestIdType,
                            categoryId: categoryId as PoiCategoryIdType
                        },
                        execCtx?.tx
                    )
                ]);

                if (!pointOfInterest) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Point of interest not found'
                    );
                }
                if (!category) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'POI category not found');
                }
                if (existing) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        'Category already assigned to point of interest'
                    );
                }

                if (!isPrimary) {
                    const relation = await this.relatedModel.create(
                        {
                            pointOfInterestId: pointOfInterestId as PointOfInterestIdType,
                            categoryId: categoryId as PoiCategoryIdType,
                            isPrimary: false
                        },
                        execCtx?.tx
                    );
                    return { relation: relation as PointOfInterestCategoryRelation };
                }

                const runAssignPrimaryChange = async (
                    txCtx: ServiceContext
                ): Promise<{ relation: PointOfInterestCategoryRelation }> => {
                    // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                    const tx = txCtx.tx!;

                    const existingPrimary = await this.relatedModel.findOne(
                        {
                            pointOfInterestId: pointOfInterestId as PointOfInterestIdType,
                            isPrimary: true
                        },
                        tx
                    );
                    if (
                        existingPrimary &&
                        existingPrimary.categoryId !== (categoryId as PoiCategoryIdType)
                    ) {
                        await this.relatedModel.update(
                            {
                                pointOfInterestId: pointOfInterestId as PointOfInterestIdType,
                                categoryId: existingPrimary.categoryId
                            },
                            { isPrimary: false },
                            tx
                        );
                    }

                    const relation = await this.relatedModel.create(
                        {
                            pointOfInterestId: pointOfInterestId as PointOfInterestIdType,
                            categoryId: categoryId as PoiCategoryIdType,
                            isPrimary: true
                        },
                        tx
                    );

                    const derivedType = deriveTypeFromCategorySlug(category.slug);
                    await this.pointOfInterestModel.update(
                        { id: pointOfInterestId as PointOfInterestIdType },
                        { type: derivedType },
                        tx
                    );

                    return { relation: relation as PointOfInterestCategoryRelation };
                };

                // If the caller already provides an active transaction, join it instead
                // of opening a new, independent one (HOS-139 judgment-day WARNING).
                if (execCtx?.tx) {
                    return runAssignPrimaryChange(execCtx);
                }
                return withServiceTransaction(runAssignPrimaryChange, execCtx);
            }
        });
    }

    /**
     * Unassigns a category from a point of interest (spec §6.4). Removes
     * the `r_poi_category` join row via `hardDelete` (this join table has
     * no `deletedAt` column).
     *
     * If the removed row was the primary and other category rows remain
     * for the POI, the next-highest-`displayWeight` remaining category is
     * auto-promoted to primary (OQ-1, confirmed behavior) — the promotion
     * and the derived `points_of_interest.type` write (spec §6.5/§7.6) both
     * happen in the SAME transaction as the removal. If zero categories
     * remain, `type` is left untouched (never written to `null`).
     *
     * @param actor - The actor performing the action.
     * @param params - `pointOfInterestId` and `categoryId`.
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async unassignCategoryFromPointOfInterest(
        actor: Actor,
        params: UnassignCategoryFromPointOfInterestInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ relation: PointOfInterestCategoryRelation }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'unassignCategoryFromPointOfInterest',
            input: { ...params, actor },
            schema: UnassignCategoryFromPointOfInterestInputSchema,
            ctx,
            execute: async (validatedParams, actor, execCtx) => {
                this._canUnassignCategoryFromPointOfInterest(actor);
                const { pointOfInterestId, categoryId } = validatedParams;

                const [pointOfInterest, existing] = await Promise.all([
                    this.pointOfInterestModel.findOne(
                        { id: pointOfInterestId as PointOfInterestIdType },
                        execCtx?.tx
                    ),
                    this.relatedModel.findOne(
                        {
                            pointOfInterestId: pointOfInterestId as PointOfInterestIdType,
                            categoryId: categoryId as PoiCategoryIdType
                        },
                        execCtx?.tx
                    )
                ]);

                if (!pointOfInterest) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Point of interest not found'
                    );
                }
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Category relation not found for this point of interest'
                    );
                }

                const wasPrimary = existing.isPrimary === true;

                if (!wasPrimary) {
                    await this.relatedModel.hardDelete(
                        {
                            pointOfInterestId: pointOfInterestId as PointOfInterestIdType,
                            categoryId: categoryId as PoiCategoryIdType
                        },
                        execCtx?.tx
                    );
                    return { relation: existing };
                }

                const runUnassignPrimaryChange = async (
                    txCtx: ServiceContext
                ): Promise<{ relation: PointOfInterestCategoryRelation }> => {
                    // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                    const tx = txCtx.tx!;

                    await this.relatedModel.hardDelete(
                        {
                            pointOfInterestId: pointOfInterestId as PointOfInterestIdType,
                            categoryId: categoryId as PoiCategoryIdType
                        },
                        tx
                    );

                    const { items: remaining } = await this.relatedModel.findAll(
                        { pointOfInterestId: pointOfInterestId as PointOfInterestIdType },
                        { pageSize: POI_CATEGORY_RELATIONS_PAGE_SIZE },
                        undefined,
                        tx
                    );

                    if (remaining.length > 0) {
                        const remainingCategoryIds = remaining.map(
                            (r: PointOfInterestCategoryRelation) => r.categoryId
                        );
                        const { items: remainingCategories } = await this.model.findAll(
                            {},
                            { pageSize: POI_CATEGORY_RELATIONS_PAGE_SIZE },
                            [inArray(poiCategories.id, remainingCategoryIds)],
                            tx
                        );
                        const sorted = [...remainingCategories].sort(
                            (a, b) => (b.displayWeight ?? 50) - (a.displayWeight ?? 50)
                        );
                        const nextPrimary = sorted[0];
                        if (nextPrimary) {
                            await this.relatedModel.update(
                                {
                                    pointOfInterestId: pointOfInterestId as PointOfInterestIdType,
                                    categoryId: nextPrimary.id
                                },
                                { isPrimary: true },
                                tx
                            );
                            const derivedType = deriveTypeFromCategorySlug(nextPrimary.slug);
                            await this.pointOfInterestModel.update(
                                { id: pointOfInterestId as PointOfInterestIdType },
                                { type: derivedType },
                                tx
                            );
                        }
                    }
                    // Zero categories remain: `type` is intentionally left untouched
                    // (spec §6.5 — never write `null` to the NOT NULL column).

                    return { relation: existing };
                };

                // If the caller already provides an active transaction, join it instead
                // of opening a new, independent one (HOS-139 judgment-day WARNING).
                if (execCtx?.tx) {
                    return runUnassignPrimaryChange(execCtx);
                }
                return withServiceTransaction(runUnassignPrimaryChange, execCtx);
            }
        });
    }

    /**
     * Explicitly re-assigns a point of interest's primary category among
     * its already-assigned categories (spec §6.4). Flips the old primary
     * off, the new one on, and writes the derived `points_of_interest.type`
     * (spec §6.5/§7.6) — all in one transaction.
     *
     * @param actor - The actor performing the action.
     * @param params - `pointOfInterestId` and `categoryId` (must already be assigned).
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async setPrimaryCategory(
        actor: Actor,
        params: SetPrimaryCategoryInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ relation: PointOfInterestCategoryRelation }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'setPrimaryCategory',
            input: { ...params, actor },
            schema: SetPrimaryCategoryInputSchema,
            ctx,
            execute: async (validatedParams, actor, execCtx) => {
                this._canSetPrimaryCategory(actor);
                const { pointOfInterestId, categoryId } = validatedParams;

                const [pointOfInterest, category, existing] = await Promise.all([
                    this.pointOfInterestModel.findOne(
                        { id: pointOfInterestId as PointOfInterestIdType },
                        execCtx?.tx
                    ),
                    this.model.findOne({ id: categoryId as PoiCategoryIdType }, execCtx?.tx),
                    this.relatedModel.findOne(
                        {
                            pointOfInterestId: pointOfInterestId as PointOfInterestIdType,
                            categoryId: categoryId as PoiCategoryIdType
                        },
                        execCtx?.tx
                    )
                ]);

                if (!pointOfInterest) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Point of interest not found'
                    );
                }
                if (!category) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'POI category not found');
                }
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Category not assigned to point of interest'
                    );
                }

                if (existing.isPrimary === true) {
                    // Already the primary — no-op, nothing to sync.
                    return { relation: existing };
                }

                const runSetPrimaryChange = async (
                    txCtx: ServiceContext
                ): Promise<{ relation: PointOfInterestCategoryRelation }> => {
                    // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                    const tx = txCtx.tx!;

                    const existingPrimary = await this.relatedModel.findOne(
                        {
                            pointOfInterestId: pointOfInterestId as PointOfInterestIdType,
                            isPrimary: true
                        },
                        tx
                    );
                    if (existingPrimary) {
                        await this.relatedModel.update(
                            {
                                pointOfInterestId: pointOfInterestId as PointOfInterestIdType,
                                categoryId: existingPrimary.categoryId
                            },
                            { isPrimary: false },
                            tx
                        );
                    }

                    const updated = await this.relatedModel.update(
                        {
                            pointOfInterestId: pointOfInterestId as PointOfInterestIdType,
                            categoryId: categoryId as PoiCategoryIdType
                        },
                        { isPrimary: true },
                        tx
                    );

                    const derivedType = deriveTypeFromCategorySlug(category.slug);
                    await this.pointOfInterestModel.update(
                        { id: pointOfInterestId as PointOfInterestIdType },
                        { type: derivedType },
                        tx
                    );

                    return {
                        relation: (updated ?? existing) as PointOfInterestCategoryRelation
                    };
                };

                // If the caller already provides an active transaction, join it instead
                // of opening a new, independent one (HOS-139 judgment-day WARNING).
                if (execCtx?.tx) {
                    return runSetPrimaryChange(execCtx);
                }
                return withServiceTransaction(runSetPrimaryChange, execCtx);
            }
        });
    }

    /**
     * Replaces the ENTIRE set of categories assigned to a point of interest
     * in one call (HOS-143 T-006), the transactional counterpart to the
     * admin category-picker UI's "save" action. Unlike
     * `assignCategoryToPointOfInterest`/`unassignCategoryFromPointOfInterest`
     * (single-relation mutations), this deletes every existing
     * `r_poi_category` row for the POI and re-inserts the submitted set —
     * `isPrimary: true` on exactly `primaryCategoryId`, `false` on the rest.
     *
     * Every id in `categoryIds` (including `primaryCategoryId`, which the
     * schema's refinement already guarantees is one of them) is resolved
     * against the `poi_categories` catalog BEFORE any write, so a single bad
     * id fails the whole call with zero mutation. The delete + re-insert +
     * derived `points_of_interest.type` write (spec §6.5/§7.6) all happen in
     * the SAME transaction (AC-6) — a failure partway through rolls back, so
     * the POI never ends up with zero categories or a stale `type`.
     *
     * @param actor - The actor performing the action.
     * @param params - `pointOfInterestId`, the full `categoryIds` set, and
     *   `primaryCategoryId` (must be one of `categoryIds`).
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async setCategoriesForPointOfInterest(
        actor: Actor,
        params: PointOfInterestSetCategoriesInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ categories: PointOfInterestCategoryAssignment[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'setCategoriesForPointOfInterest',
            input: { ...params, actor },
            schema: PointOfInterestSetCategoriesInputSchema,
            ctx,
            execute: async (validatedParams, actor, execCtx) => {
                this._canSetCategoriesForPointOfInterest(actor);
                const { pointOfInterestId, categoryIds, primaryCategoryId } = validatedParams;

                // NOTE: `primaryCategoryId ∈ categoryIds` is enforced by
                // `PointOfInterestSetCategoriesInputSchema`'s `.refine(...)`,
                // which runs INSIDE `runWithLoggingAndValidation` before this
                // `execute` callback is ever invoked (see `BaseService`).
                // A redundant re-check here would be permanently unreachable
                // dead code — unlike the sibling methods' guards below, which
                // all validate against live DB state the schema cannot see
                // (existence, already-assigned), this invariant is pure input
                // shape and the schema is the single source of truth for it.

                const pointOfInterest = await this.pointOfInterestModel.findOne(
                    { id: pointOfInterestId as PointOfInterestIdType },
                    execCtx?.tx
                );
                if (!pointOfInterest) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Point of interest not found'
                    );
                }

                // Resolve every submitted id BEFORE any write (AC-6): a
                // missing/deleted category id must fail the whole call, never
                // leave a partial delete+insert behind.
                const uniqueCategoryIds = Array.from(new Set(categoryIds)) as PoiCategoryIdType[];
                const foundCategories = await Promise.all(
                    uniqueCategoryIds.map((id) => this.model.findOne({ id }, execCtx?.tx))
                );
                const missingIndex = foundCategories.findIndex((found) => !found);
                if (missingIndex !== -1) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `POI category not found: ${uniqueCategoryIds[missingIndex]}`
                    );
                }
                const categoriesById = new Map<PoiCategoryIdType, PoiCategory>(
                    foundCategories.map((found, idx) => {
                        // biome-ignore lint/style/noNonNullAssertion: verified non-null by the missingIndex check above
                        const id = uniqueCategoryIds[idx]!;
                        return [id, found as PoiCategory];
                    })
                );
                // biome-ignore lint/style/noNonNullAssertion: primaryCategoryId is in categoryIds (checked above), so it resolved in the loop above
                const primaryCategory = categoriesById.get(primaryCategoryId as PoiCategoryIdType)!;
                const derivedType = deriveTypeFromCategorySlug(primaryCategory.slug);

                const runSetCategoriesChange = async (
                    txCtx: ServiceContext
                ): Promise<{ categories: PointOfInterestCategoryAssignment[] }> => {
                    // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                    const tx = txCtx.tx!;

                    // Full replace: remove every existing relation row for
                    // this POI, then re-insert the submitted set. Both steps
                    // share this transaction, so a failure on the insert
                    // rolls back the delete too (AC-6).
                    await this.relatedModel.hardDelete(
                        { pointOfInterestId: pointOfInterestId as PointOfInterestIdType },
                        tx
                    );

                    await Promise.all(
                        uniqueCategoryIds.map((catId) =>
                            this.relatedModel.create(
                                {
                                    pointOfInterestId: pointOfInterestId as PointOfInterestIdType,
                                    categoryId: catId,
                                    isPrimary: catId === (primaryCategoryId as PoiCategoryIdType)
                                },
                                tx
                            )
                        )
                    );

                    await this.pointOfInterestModel.update(
                        { id: pointOfInterestId as PointOfInterestIdType },
                        { type: derivedType },
                        tx
                    );

                    const sortedAssignments = uniqueCategoryIds
                        // biome-ignore lint/style/noNonNullAssertion: every id in uniqueCategoryIds resolved above
                        .map((id) => categoriesById.get(id)!)
                        .sort((a, b) => (b.displayWeight ?? 50) - (a.displayWeight ?? 50))
                        .map(
                            (found): PointOfInterestCategoryAssignment => ({
                                id: found.id,
                                slug: found.slug,
                                nameI18n: found.nameI18n,
                                icon: found.icon,
                                isPrimary: found.id === (primaryCategoryId as PoiCategoryIdType)
                            })
                        );

                    return { categories: sortedAssignments };
                };

                // If the caller already provides an active transaction, join it instead
                // of opening a new, independent one (HOS-139 judgment-day WARNING).
                if (execCtx?.tx) {
                    return runSetCategoriesChange(execCtx);
                }
                return withServiceTransaction(runSetCategoriesChange, execCtx);
            }
        });
    }

    /**
     * Lists all categories assigned to a point of interest, sorted by
     * `displayWeight` descending. Mirrors
     * `PointOfInterestService.getPointsOfInterestForDestination`.
     *
     * Each returned category carries the per-POI `isPrimary` flag from the
     * `r_poi_category` join row (HOS-144), symmetric with what
     * `setCategoriesForPointOfInterest` already returns — the admin
     * category-manager UI needs this to pre-select the primary category
     * when the tab loads.
     * @param actor - The actor performing the action.
     * @param params - The params containing the point-of-interest ID.
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async getCategoriesForPointOfInterest(
        actor: Actor,
        params: PoiCategoriesByPointOfInterestInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ categories: PointOfInterestCategoryAssignment[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getCategoriesForPointOfInterest',
            input: { ...params, actor },
            schema: PoiCategoriesByPointOfInterestInputSchema,
            ctx,
            execute: async (validatedParams, actor, execCtx) => {
                this._canList(actor);
                const { pointOfInterestId } = validatedParams;

                const [pointOfInterest, relationsResult] = await Promise.all([
                    this.pointOfInterestModel.findOne(
                        { id: pointOfInterestId as PointOfInterestIdType },
                        execCtx?.tx
                    ),
                    this.relatedModel.findAll(
                        { pointOfInterestId },
                        { pageSize: POI_CATEGORY_RELATIONS_PAGE_SIZE },
                        undefined,
                        execCtx?.tx
                    )
                ]);

                if (!pointOfInterest) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Point of interest not found'
                    );
                }

                const { items: relations } = relationsResult;
                if (relations.length === 0) {
                    return { categories: [] };
                }

                const categoryIds = relations.map(
                    (r: PointOfInterestCategoryRelation) => r.categoryId
                );
                const isPrimaryByCategoryId = new Map<PoiCategoryIdType, boolean>(
                    relations.map((r: PointOfInterestCategoryRelation) => [
                        r.categoryId,
                        r.isPrimary
                    ])
                );

                const { items: categories } = await this.model.findAll(
                    {},
                    { pageSize: POI_CATEGORY_RELATIONS_PAGE_SIZE },
                    [inArray(poiCategories.id, categoryIds)],
                    execCtx?.tx
                );
                const sorted = [...categories].sort(
                    (a, b) => (b.displayWeight ?? 50) - (a.displayWeight ?? 50)
                );
                const assignments: PointOfInterestCategoryAssignment[] = sorted.map((category) => ({
                    id: category.id,
                    slug: category.slug,
                    nameI18n: category.nameI18n,
                    icon: category.icon,
                    isPrimary: isPrimaryByCategoryId.get(category.id) ?? false
                }));
                return { categories: assignments };
            }
        });
    }

    /**
     * Lists the PUBLIC POI category catalog (HOS-147) — every ACTIVE,
     * non-deleted category, ordered by `displayWeight` descending (higher =
     * shown first, matching {@link getCategoriesForPointOfInterest} and the
     * amenity/feature catalog convention) with a `slug` ascending tiebreak for
     * deterministic ordering. Backs the thematic filter-chip UI's chip options
     * (`GET /api/v1/public/poi-categories`).
     *
     * Unlike the admin catalog list, this is a public read: it uses
     * {@link checkCanListPublicPoiCategories} (any actor), NOT the
     * `POI_CATEGORY_VIEW`-gated `_canList`. The result is projected to the
     * narrow {@link PoiCategoryPublic} shape (no audit/admin fields).
     *
     * @param actor - The actor performing the action (guest allowed).
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns A `ServiceOutput` with `{ categories }` sorted for display.
     */
    public async listPublicCategories(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ categories: PoiCategoryPublic[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listPublicCategories',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validated, actor, execCtx) => {
                checkCanListPublicPoiCategories(actor);

                const { items } = await this.model.findAll(
                    { lifecycleState: 'ACTIVE' },
                    { pageSize: POI_CATEGORY_RELATIONS_PAGE_SIZE },
                    undefined,
                    execCtx?.tx
                );

                const categories: PoiCategoryPublic[] = [...items]
                    .sort(
                        (a, b) =>
                            (b.displayWeight ?? 50) - (a.displayWeight ?? 50) ||
                            a.slug.localeCompare(b.slug)
                    )
                    .map((category) => ({
                        id: category.id,
                        slug: category.slug,
                        nameI18n: category.nameI18n,
                        icon: category.icon ?? null,
                        displayWeight: category.displayWeight ?? 50
                    }));

                return { categories };
            }
        });
    }

    /**
     * Lists all points of interest tagged with a given category. Mirrors
     * `PointOfInterestService.getDestinationsByPointOfInterest`.
     * @param actor - The actor performing the action.
     * @param params - The params containing the category ID.
     * @param ctx - Optional service context carrying transaction and hookState.
     */
    public async getPointsOfInterestForCategory(
        actor: Actor,
        params: PointsOfInterestByPoiCategoryInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ pointsOfInterest: PointOfInterest[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPointsOfInterestForCategory',
            input: { ...params, actor },
            schema: PointsOfInterestByPoiCategoryInputSchema,
            ctx,
            execute: async (validatedParams, actor, execCtx) => {
                this._canList(actor);
                const { categoryId } = validatedParams;

                const [category, relationsResult] = await Promise.all([
                    this.model.findOne({ id: categoryId as PoiCategoryIdType }, execCtx?.tx),
                    this.relatedModel.findAll(
                        { categoryId },
                        { pageSize: POI_CATEGORY_RELATIONS_PAGE_SIZE },
                        undefined,
                        execCtx?.tx
                    )
                ]);

                if (!category) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'POI category not found');
                }

                const { items: relations } = relationsResult;
                if (relations.length === 0) {
                    return { pointsOfInterest: [] };
                }

                const poiIds = relations.map(
                    (r: PointOfInterestCategoryRelation) => r.pointOfInterestId
                );

                const { items: matchedPointsOfInterest } = await this.pointOfInterestModel.findAll(
                    {},
                    { pageSize: POI_CATEGORY_RELATIONS_PAGE_SIZE },
                    [inArray(pointsOfInterest.id, poiIds)],
                    execCtx?.tx
                );
                return { pointsOfInterest: matchedPointsOfInterest };
            }
        });
    }

    /**
     * Builds the plain `where` object for the catalog's own search/count.
     * @param params - Search params containing the plain-column filters.
     * @returns A `where` object safe to pass to `model.findAll`/`model.count`.
     */
    private buildSearchWhere(
        params: Pick<PoiCategorySearchInput, 'slug' | 'lifecycleState'>
    ): Record<string, unknown> {
        const { slug, lifecycleState } = params;
        const where: Record<string, unknown> = {};
        if (slug) where.slug = slug;
        if (lifecycleState) where.lifecycleState = lifecycleState;
        return where;
    }

    /**
     * Builds the free-text `q` condition against `slug` (the only searchable
     * column per {@link getSearchableColumns}), via `safeIlike` — never a raw
     * LIKE operator (wildcard-injection convention). Mirrors
     * `EventLocationService._executeSearch`'s single-column `q` idiom.
     *
     * @param q - The free-text search term from search params, if any.
     * @returns An empty array when `q` is absent/blank, otherwise a single
     *   `safeIlike` condition to combine with the plain `where` object.
     */
    private buildQConditions(q: string | undefined): SQL[] {
        if (!q) {
            return [];
        }
        return [safeIlike(poiCategories.slug, q)];
    }

    protected async _executeSearch(
        params: PoiCategorySearchInput,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<PoiCategory>> {
        const where = this.buildSearchWhere(params);
        const additionalConditions = this.buildQConditions(params.q);
        // BaseCrudRead.search strips page/pageSize/sortBy/sortOrder from params
        // and re-publishes them via ctx.pagination. Forward them explicitly so
        // the model honors the caller-provided page/pageSize instead of falling
        // back to its default of 20.
        const { items, total } = await this.model.findAll(
            where,
            {
                page: ctx.pagination?.page ?? 1,
                pageSize: ctx.pagination?.pageSize ?? 10,
                sortBy: ctx.pagination?.sortBy,
                sortOrder: ctx.pagination?.sortOrder
            },
            additionalConditions
        );
        return { items, total };
    }

    protected async _executeCount(
        params: PoiCategorySearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<CountResponse> {
        const where = this.buildSearchWhere(params);
        const additionalConditions = this.buildQConditions(params.q);
        const count = await this.model.count(where, { additionalConditions });
        return { count };
    }
}
