import { AccommodationModel, OwnerPromotionModel } from '@repo/db';
import { ownerPromotions } from '@repo/db/schemas';
import type {
    OwnerPromotion,
    OwnerPromotionCreateInput,
    OwnerPromotionSearchInput,
    OwnerPromotionUpdateInput
} from '@repo/schemas';
import {
    LifecycleStatusEnum,
    OwnerPromotionAdminSearchSchema,
    OwnerPromotionCreateInputSchema,
    OwnerPromotionSearchSchema,
    OwnerPromotionUpdateInputSchema
} from '@repo/schemas';
import { and, gte, isNull, lte, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { generateOwnerPromotionSlug } from './ownerPromotion.helpers';
import {
    OwnerPromotionLifecycleEventType,
    emitOwnerPromotionLifecycleEvent
} from './ownerPromotion.lifecycle-events';
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
} from './ownerPromotion.permissions';

/**
 * Per-request mutable hook state for `OwnerPromotionService`.
 *
 * Carried inside `ServiceContext.hookState` across `_beforeUpdate` → `_afterUpdate`
 * to detect the non-ACTIVE → ACTIVE lifecycle transition without re-fetching.
 */
export interface OwnerPromotionHookState {
    /** ID of the entity being updated (injected by the `update()` override). */
    updateId?: string;
    /**
     * The `lifecycleState` value of the entity BEFORE the update was applied.
     * `undefined` when the entity was not fetched (e.g. no `updateId` set).
     */
    previousLifecycleState?: string;
}

/**
 * Service for managing owner promotions (discounts for VIP tourists).
 * Only owners with Pro or Premium plans can create promotions.
 *
 * Permission model:
 * - `_ANY` permissions allow operating on any promotion regardless of ownership.
 * - `_OWN` permissions allow operating only on promotions owned by the actor.
 */
export class OwnerPromotionService extends BaseCrudService<
    OwnerPromotion,
    OwnerPromotionModel,
    typeof OwnerPromotionCreateInputSchema,
    typeof OwnerPromotionUpdateInputSchema,
    typeof OwnerPromotionSearchSchema
> {
    static readonly ENTITY_NAME = 'ownerPromotion';
    protected readonly entityName = OwnerPromotionService.ENTITY_NAME;
    protected readonly model: OwnerPromotionModel;

    protected readonly createSchema = OwnerPromotionCreateInputSchema;
    protected readonly updateSchema = OwnerPromotionUpdateInputSchema;
    protected readonly searchSchema = OwnerPromotionSearchSchema;

    protected getDefaultListRelations() {
        return { owner: true, accommodation: true };
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Owner promotions are searched by title and description.
     */
    protected override getSearchableColumns(): string[] {
        return ['title', 'description'];
    }

    /**
     * AccommodationModel instance, used to resolve the ownerId of an accommodation
     * for D-4 owner-wide promotions in `_executeSearch` / `_executeCount`.
     */
    private readonly accommodationModel: AccommodationModel;

    constructor(
        ctx: ServiceConfig & {
            model?: OwnerPromotionModel;
            accommodationModel?: AccommodationModel;
        }
    ) {
        super(ctx, OwnerPromotionService.ENTITY_NAME);
        this.model = ctx.model ?? new OwnerPromotionModel();
        this.accommodationModel = ctx.accommodationModel ?? new AccommodationModel();
        /** Uses default _executeAdminSearch() - all filter fields map directly to table columns. */
        this.adminSearchSchema = OwnerPromotionAdminSearchSchema;
    }

    /**
     * Builds the SQL condition that enforces G-3 active-window filtering:
     *   `validFrom <= now AND (validUntil IS NULL OR validUntil >= now)`
     *
     * `validFrom IS NOT NULL` by schema constraint so no null-guard needed.
     * `validUntil IS NULL` means the promo has no expiry — treated as always valid.
     *
     * The `?? sql\`1=1\`` fallback avoids an unsafe `as SQL` cast: `and()`
     * returns `SQL | undefined` when all args are undefined, which cannot
     * happen here because both sub-expressions are always defined.
     */
    private buildActiveWindowCondition(now: Date): SQL {
        return (
            and(
                lte(ownerPromotions.validFrom, now),
                or(isNull(ownerPromotions.validUntil), gte(ownerPromotions.validUntil, now))
            ) ?? sql`1=1`
        );
    }

    protected _canCreate(actor: Actor, data: OwnerPromotionCreateInput): void {
        checkCanCreate(actor, data);
    }

    /**
     * Lifecycle hook: generates a unique slug before creating a promotion.
     *
     * The `slug` column is NOT NULL and has no DB default; without this hook the
     * INSERT sends `DEFAULT` for slug and fails with a not-null violation. When
     * the caller does not supply a slug, derive a unique one from the title.
     */
    protected async _beforeCreate(
        data: OwnerPromotionCreateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<OwnerPromotion>> {
        const slug = data.slug ?? (await generateOwnerPromotionSlug(data.title, this.model));
        return { ...data, slug };
    }

    protected _canUpdate(actor: Actor, entity: OwnerPromotion): void {
        checkCanUpdate(actor, entity);
    }

    protected _canSoftDelete(actor: Actor, entity: OwnerPromotion): void {
        checkCanSoftDelete(actor, entity);
    }

    protected _canHardDelete(actor: Actor, entity: OwnerPromotion): void {
        checkCanHardDelete(actor, entity);
    }

    protected _canRestore(actor: Actor, entity: OwnerPromotion): void {
        checkCanRestore(actor, entity);
    }

    protected _canView(actor: Actor, entity: OwnerPromotion): void {
        checkCanView(actor, entity);
    }

    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    protected _canUpdateVisibility(
        actor: Actor,
        entity: OwnerPromotion,
        newVisibility: unknown
    ): void {
        checkCanUpdateVisibility(actor, entity, newVisibility);
    }
    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks entity-specific permission.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }
    protected async _executeSearch(
        params: OwnerPromotionSearchInput,
        _actor: Actor,
        ctx: ServiceContext
    ) {
        // BaseCrudRead.search() strips page/pageSize/sortBy/sortOrder from params
        // before reaching this hook (SPEC-088 AC-088-03) and re-publishes them via
        // ctx.pagination. Reading from params would always yield the Zod defaults
        // (1/20) — pagination would be permanently broken. Read from ctx instead.
        const page = ctx.pagination?.page ?? 1;
        const pageSize = ctx.pagination?.pageSize ?? 20;

        // AC-005-01 strict enforcement: public search always filters by ACTIVE,
        // overriding any caller-supplied lifecycleState to prevent DRAFT/ARCHIVED
        // leakage via query-param manipulation. Admin path (adminList ->
        // _executeAdminSearch) is unaffected and honors caller filters.
        const filterParams = { ...params };
        filterParams.lifecycleState = LifecycleStatusEnum.ACTIVE;
        // SPEC-167 T-004: plan-restricted promotions are excluded from all public reads.
        // SPEC-285 FIX 2: deletedAt: null guards against soft-deleted promos leaking
        // through the generic path (the D-4 path already filters these in the model).
        const publicFilter = { ...filterParams, planRestricted: false, deletedAt: null };

        // G-3 active-window: only return promos that are currently valid.
        // Added in SPEC-285 T-003a — previously the service did not filter by date.
        const now = new Date();
        const windowCondition = this.buildActiveWindowCondition(now);

        // D-4 (SPEC-285): when the caller supplies accommodationId, use the
        // OR query that includes owner-wide (accommodationId IS NULL) promos for
        // the same owner — these would be silently invisible otherwise.
        if (params.accommodationId) {
            const accommodation = await this.accommodationModel.findById(params.accommodationId);
            if (!accommodation) {
                return { items: [], total: 0 };
            }
            return this.model.findActiveForAccommodation(
                { accommodationId: params.accommodationId, ownerId: accommodation.ownerId },
                { page, pageSize }
            );
        }

        return this.model.findAll(publicFilter, { page, pageSize }, [windowCondition]);
    }

    protected async _executeCount(
        params: OwnerPromotionSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        // AC-005-01 consistency: pagination `total` must match the ACTIVE-only
        // result set returned by _executeSearch. Force-override ensures count
        // and items never diverge even if a caller injects a lifecycleState.
        const filterParams = { ...params };
        filterParams.lifecycleState = LifecycleStatusEnum.ACTIVE;
        // SPEC-167 T-004: plan-restricted promotions must NOT count toward the
        // MAX_ACTIVE_PROMOTIONS cap.
        // SPEC-285 FIX 2: mirror deletedAt: null from _executeSearch so counts
        // and items never diverge on soft-deleted rows.
        const publicFilter = { ...filterParams, planRestricted: false, deletedAt: null };

        // G-3 active-window: mirror _executeSearch so count and items never diverge.
        const now = new Date();
        const windowCondition = this.buildActiveWindowCondition(now);

        // D-4: use a dedicated count query (SPEC-285 FIX 3) to avoid fetching and
        // discarding up to 20 rows just to read `.total`. The WHERE conditions in
        // `countActiveForAccommodation` are identical to `findActiveForAccommodation`.
        if (params.accommodationId) {
            const accommodation = await this.accommodationModel.findById(params.accommodationId);
            if (!accommodation) {
                return { count: 0 };
            }
            const count = await this.model.countActiveForAccommodation({
                accommodationId: params.accommodationId,
                ownerId: accommodation.ownerId
            });
            return { count };
        }

        const count = await this.model.count(publicFilter, {
            additionalConditions: [windowCondition]
        });
        return { count };
    }

    // ── T-004 lifecycle hooks (SPEC-285 G-4) ──────────────────────────────────

    /**
     * Overrides `update()` to inject the entity ID into `hookState.updateId`
     * before the base class runs `_beforeUpdate`. The previous entity's
     * `lifecycleState` is then captured in `_beforeUpdate` and read in `_afterUpdate`
     * to detect the non-ACTIVE → ACTIVE transition that triggers the `activated` event.
     *
     * @param actor - The actor performing the update.
     * @param id - The ID of the promotion to update.
     * @param data - The partial update data.
     * @param ctx - Optional service context.
     */
    public override async update(
        actor: Actor,
        id: string,
        data: OwnerPromotionUpdateInput,
        ctx?: ServiceContext<OwnerPromotionHookState>
    ): Promise<ServiceOutput<OwnerPromotion>> {
        const resolvedCtx: ServiceContext<OwnerPromotionHookState> = {
            hookState: {},
            ...ctx
        };
        if (resolvedCtx.hookState) {
            resolvedCtx.hookState.updateId = id;
        }
        return super.update(actor, id, data, resolvedCtx as ServiceContext);
    }

    /**
     * Captures the previous `lifecycleState` before the update so `_afterUpdate`
     * can detect the non-ACTIVE → ACTIVE transition.
     */
    protected override async _beforeUpdate(
        data: OwnerPromotionUpdateInput,
        _actor: Actor,
        ctx: ServiceContext<OwnerPromotionHookState>
    ): Promise<Partial<OwnerPromotion>> {
        const id = ctx.hookState?.updateId;
        if (id && ctx.hookState) {
            const prev = await this.model.findById(id, ctx.tx);
            ctx.hookState.previousLifecycleState = prev?.lifecycleState ?? undefined;
        }
        return data as Partial<OwnerPromotion>;
    }

    /**
     * Emits the `owner_promotion.created` lifecycle event after a promotion is
     * successfully persisted (G-4, SPEC-285).
     */
    protected override async _afterCreate(
        entity: OwnerPromotion,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<OwnerPromotion> {
        await emitOwnerPromotionLifecycleEvent({
            type: OwnerPromotionLifecycleEventType.CREATED,
            promotionId: entity.id,
            ownerId: entity.ownerId,
            slug: entity.slug,
            accommodationId: entity.accommodationId ?? null,
            timestamp: new Date()
        });
        return entity;
    }

    /**
     * Emits the `owner_promotion.activated` lifecycle event when a promotion
     * transitions from a non-ACTIVE lifecycle state to ACTIVE (G-4, SPEC-285).
     *
     * Does NOT fire for:
     * - Updates that do not change the lifecycle state.
     * - Updates that start and end in ACTIVE state (no-op transition).
     * - Create-as-ACTIVE (handled by `_afterCreate`).
     */
    protected override async _afterUpdate(
        entity: OwnerPromotion,
        _actor: Actor,
        ctx: ServiceContext<OwnerPromotionHookState>
    ): Promise<OwnerPromotion> {
        const previousState = ctx.hookState?.previousLifecycleState;
        if (
            entity.lifecycleState === LifecycleStatusEnum.ACTIVE &&
            previousState !== undefined &&
            previousState !== LifecycleStatusEnum.ACTIVE
        ) {
            await emitOwnerPromotionLifecycleEvent({
                type: OwnerPromotionLifecycleEventType.ACTIVATED,
                promotionId: entity.id,
                ownerId: entity.ownerId,
                previousState,
                timestamp: new Date()
            });
        }
        return entity;
    }
}
