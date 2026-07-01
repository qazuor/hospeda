import { AccommodationModel, TouristPriceAlertModel } from '@repo/db';
import type { CreatePriceAlertInput, PriceAlert } from '@repo/schemas';
import {
    CreatePriceAlertInputSchema,
    ListPriceAlertsInputSchema,
    PriceAlertUpdateInputSchema,
    ServiceErrorCode,
    UserIdSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ListOptions, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import {
    checkCanAccessAlert,
    checkCanCreate,
    checkCanListOwn
} from './alert-subscription.permissions';

/**
 * Local extension of `ListPriceAlertsInputSchema` (SPEC-286 T-002,
 * `@repo/schemas`) used ONLY as this service's `searchSchema`.
 *
 * `ListPriceAlertsInputSchema` is bare `page`/`pageSize` pagination — T-002
 * only anticipated it backing `list()` (via `ListOptions.where`, which is
 * untyped `Record<string, unknown>` and needs no schema extension). But
 * `BaseCrudService`'s `TSearchSchema` generic also backs the generic
 * `search()`/`count()` entry points, and `count()` IS a real, used entry
 * point here — `countActive()` calls it with `{ userId, isActive }`. Since
 * `z.object()` strips unrecognized keys by default, validating that payload
 * against the bare pagination schema would silently drop both filters before
 * `_executeCount` ever saw them. This local extension adds them back as
 * optional fields so they survive schema validation.
 *
 * `userId` is still force-overridden to `actor.id` inside `_executeSearch` /
 * `_executeCount` regardless of what's passed here — the schema field exists
 * only so the value isn't stripped in transit, not to grant caller control
 * over which user's alerts get counted.
 */
const AlertSubscriptionSearchSchema = ListPriceAlertsInputSchema.extend({
    userId: UserIdSchema.optional(),
    isActive: z.boolean().optional()
});

type AlertSubscriptionSearchInput = z.infer<typeof AlertSubscriptionSearchSchema>;

/**
 * Service for managing tourist price-alert subscriptions (SPEC-286 G-1).
 *
 * A price alert is a lightweight, per-user, per-accommodation subscription:
 * "notify me when this accommodation's price drops". This service owns
 * creation (with a price snapshot + duplicate-subscription guard),
 * cancellation (soft-delete), and self-scoped listing/counting. It does NOT
 * own entitlement/limit gating (whether the actor's plan allows alerts at
 * all, or whether they're at `MAX_ACTIVE_ALERTS`) — that's the `gateAlerts()`
 * route middleware's job (SPEC-286 T-005), applied before this service's
 * `create()` is ever called.
 *
 * ## API shape
 * This service exposes ONLY `BaseCrudService`'s native inherited methods
 * (`create`, `softDelete`, `list`, `count`, ...) with positional args —
 * exactly like every other `BaseCrudService` consumer in this codebase. The
 * one addition is `countActive()`, a thin convenience wrapper around
 * `count()` for the `gateAlerts()` pre-population use case.
 *
 * ## Operations with no product meaning for this entity
 * `update`, `hardDelete`, `restore`, `updateVisibility`, and the generic
 * `search()` are all hard-denied (`_can*` throws `FORBIDDEN`) because:
 * - **update**: a subscription's threshold is changed by deleting and
 *   re-creating it (see `PriceAlertUpdateInputSchema` doc comment).
 * - **hardDelete** / **restore**: only soft-delete (cancel) is supported;
 *   re-subscribing is just `create()` again.
 * - **updateVisibility**: price alerts have no visibility concept.
 * - **search**: there is no free-text search need for a per-user list this
 *   small; `list()` (self-scoped) covers every UI need. `_executeSearch` is
 *   still implemented (defensively, with the same forced scoping as
 *   `_executeCount`) purely to satisfy the abstract-method contract — it is
 *   unreachable via the public `search()` method because `_canSearch` throws
 *   first.
 *
 * `count()` is the one exception among the "read-only, filter-bearing"
 * abstract members that IS live: `countActive()` depends on it.
 */
export class AlertSubscriptionService extends BaseCrudService<
    PriceAlert,
    TouristPriceAlertModel,
    typeof CreatePriceAlertInputSchema,
    typeof PriceAlertUpdateInputSchema,
    typeof AlertSubscriptionSearchSchema
> {
    static readonly ENTITY_NAME = 'priceAlert';
    protected readonly entityName = AlertSubscriptionService.ENTITY_NAME;
    protected readonly model: TouristPriceAlertModel;

    protected readonly createSchema = CreatePriceAlertInputSchema;
    protected readonly updateSchema = PriceAlertUpdateInputSchema;
    protected readonly searchSchema = AlertSubscriptionSearchSchema;

    /**
     * Used to (a) validate the target accommodation exists before creating a
     * subscription and (b) read its current `price.price` to compute the
     * `basePriceSnapshot` taken at subscription time.
     */
    private readonly accommodationModel: AccommodationModel;

    protected getDefaultListRelations() {
        return { accommodation: true };
    }

    constructor(
        ctx: ServiceConfig & {
            model?: TouristPriceAlertModel;
            accommodationModel?: AccommodationModel;
        }
    ) {
        super(ctx, AlertSubscriptionService.ENTITY_NAME);
        this.model = ctx.model ?? new TouristPriceAlertModel();
        this.accommodationModel = ctx.accommodationModel ?? new AccommodationModel();
    }

    // ── create ──────────────────────────────────────────────────────────────

    /**
     * Any authenticated actor may create a price-alert subscription for
     * themselves. Ownership is enforced by `_beforeCreate` (which injects
     * `userId: actor.id`, so a caller can never subscribe another user), not
     * by a role/permission check — there is no dedicated `PRICE_ALERT_CREATE`
     * permission because plan/entitlement gating happens at the route layer.
     */
    protected _canCreate(actor: Actor, _data: CreatePriceAlertInput): void {
        checkCanCreate(actor);
    }

    /**
     * Resolves the accommodation, snapshots its current price (converted to
     * centavos — see the unit-conversion note below), and rejects duplicate
     * subscriptions.
     *
     * Runs AFTER `_canCreate` and BEFORE the INSERT (confirmed from
     * `BaseCrudWrite.create()`: the pipeline is
     * `_canCreate → normalize → _beforeCreate → INSERT`), so both the
     * existence check and the duplicate check happen here rather than in
     * `_canCreate` — `_canCreate` has no way to `await` a DB lookup and
     * report `NOT_FOUND`/`ALREADY_EXISTS` (it's a permission gate, not a
     * data gate).
     *
     * The duplicate check is a pre-check SELECT, not a caught unique-
     * violation (Postgres error 23505) from the T-003 `UNIQUE(user_id,
     * accommodation_id)` index. There is no existing precedent anywhere in
     * this codebase for translating a raw constraint violation into a
     * `ServiceErrorCode` — every comparable service (see `OwnerPromotionService`,
     * `UserBookmarkService`) does an explicit pre-check query instead. The DB
     * unique index is a race-condition safety net, not the primary validation
     * path.
     */
    protected async _beforeCreate(
        data: CreatePriceAlertInput,
        actor: Actor,
        ctx: ServiceContext
    ): Promise<Partial<PriceAlert>> {
        const accommodation = await this.accommodationModel.findById(data.accommodationId, ctx.tx);
        if (!accommodation) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `Accommodation not found: ${data.accommodationId}`
            );
        }

        const priceInDecimalCurrency = accommodation.price?.price;
        if (priceInDecimalCurrency === null || priceInDecimalCurrency === undefined) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Cannot subscribe to price alerts for an accommodation with no price set'
            );
        }

        // UNIT-CONVERSION NOTE: `accommodation.price.price` (AccommodationPriceSchema,
        // extending the shared `PriceSchema`) is a plain decimal currency amount
        // (e.g. ARS pesos, `20000`), NOT centavos — verified by reading
        // `apps/web/src/components/accommodation/PricingSidebar.astro`, which
        // feeds `price.price` directly into `Intl.NumberFormat({ style: 'currency' })`
        // with no `/100` conversion, and by `accommodations.dbschema.ts`, where
        // `price` is a free-form `jsonb` column with no integer/centavos
        // constraint. `PriceAlert.basePriceSnapshot` (T-002/T-003), by contrast,
        // is explicitly documented as integer centavos (the project-wide money
        // convention from CLAUDE.md). This is the one boundary where the two
        // conventions meet — convert here, once.
        const basePriceSnapshot = Math.round(priceInDecimalCurrency * 100);

        const existingAlert = await this.model.findOne(
            {
                userId: actor.id,
                accommodationId: data.accommodationId,
                deletedAt: null
            },
            ctx.tx
        );
        if (existingAlert) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'You already have an active alert for this accommodation'
            );
        }

        return {
            ...data,
            userId: actor.id,
            basePriceSnapshot,
            targetPercentDrop: data.targetPercentDrop ?? null,
            isActive: true
        };
    }

    // ── view / softDelete: owner or staff bypass ──────────────────────────────

    /**
     * Owner or staff (`ACCOMMODATION_VIEW_ALL`) may view a subscription.
     * Mirrors {@link _canSoftDelete}'s bypass scope — see
     * `checkCanAccessAlert` for the shared rule.
     */
    protected _canView(actor: Actor, entity: PriceAlert): void {
        checkCanAccessAlert(actor, entity);
    }

    /**
     * Owner or staff (`ACCOMMODATION_VIEW_ALL`) may cancel (soft-delete) a
     * subscription. Staff access here is deliberate: support/moderation may
     * need to clear a stuck or abusive alert on a tourist's behalf.
     */
    protected _canSoftDelete(actor: Actor, entity: PriceAlert): void {
        checkCanAccessAlert(actor, entity);
    }

    // ── update / hardDelete / restore / updateVisibility: no product meaning ──

    /**
     * Always denied. A subscription's threshold is changed by deleting and
     * re-creating it (see `PriceAlertUpdateInputSchema` doc comment) — this
     * makes `BaseCrudService.update()` a hard no-op if ever called by
     * mistake, since no route exposes it.
     */
    protected _canUpdate(_actor: Actor, _entity: PriceAlert): void {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Price alerts cannot be updated — delete and re-create instead'
        );
    }

    /** Always denied. Only soft-delete (cancel) is supported for this entity. */
    protected _canHardDelete(_actor: Actor, _entity: PriceAlert): void {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Price alerts do not support hard delete — cancel via softDelete instead'
        );
    }

    /** Always denied. Re-subscribing is just `create()` again. */
    protected _canRestore(_actor: Actor, _entity: PriceAlert): void {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Price alerts do not support restore — create a new subscription instead'
        );
    }

    /** Always denied. Price alerts have no visibility concept. */
    protected _canUpdateVisibility(
        _actor: Actor,
        _entity: PriceAlert,
        _newVisibility: unknown
    ): void {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Price alerts have no visibility concept'
        );
    }

    // ── list: always self-scoped, no admin bypass (no admin list in v1) ──────

    /**
     * Any authenticated actor may list — but only ever THEIR OWN
     * subscriptions (see `_beforeList`). Unlike `_canView`/`_canSoftDelete`,
     * there is deliberately NO staff bypass here: the product decision for
     * v1 is "no admin list for price alerts", so the permission check only
     * confirms authentication and the scoping override does the rest.
     */
    protected _canList(actor: Actor): void {
        checkCanListOwn(actor);
    }

    /**
     * Security override (mirrors `OwnerPromotionService._executeSearch`'s
     * force-overriding pattern): every `list()` call is scoped to the
     * caller's own subscriptions, discarding any caller-supplied
     * `options.where.userId`. `deletedAt: null` (excluding cancelled alerts)
     * is already applied by default by `BaseCrudRead.list()` for tables with
     * a `deletedAt` column, so it isn't repeated here.
     */
    protected async _beforeList(
        options: ListOptions,
        actor: Actor,
        _ctx: ServiceContext
    ): Promise<ListOptions> {
        return { ...options, where: { ...options.where, userId: actor.id } };
    }

    // ── search: no product meaning, denied ────────────────────────────────────

    /**
     * Always denied — see the class doc comment's "no product meaning"
     * section. `list()` (self-scoped, no free-text filter) covers every UI
     * need for this small per-user collection.
     */
    protected _canSearch(_actor: Actor): void {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Price alerts do not support free-text search — use list() instead'
        );
    }

    /**
     * Implemented only to satisfy the abstract-method contract; unreachable
     * via the public `search()` method because `_canSearch` always throws
     * first. Mirrors `_executeCount`'s forced `userId` scoping defensively,
     * in case a test or future caller invokes this protected method directly.
     */
    protected async _executeSearch(params: AlertSubscriptionSearchInput, actor: Actor) {
        const filter: Record<string, unknown> = { userId: actor.id, deletedAt: null };
        if (params.isActive !== undefined) {
            filter.isActive = params.isActive;
        }
        return this.model.findAll(filter, { page: 1, pageSize: 10 });
    }

    // ── count: live, backs countActive() ──────────────────────────────────────

    /**
     * Same authentication-only rule as `_canList` — `count()` is always
     * self-scoped (see `_executeCount`), so no additional permission is
     * required beyond being a real actor.
     */
    protected _canCount(actor: Actor): void {
        checkCanListOwn(actor);
    }

    /**
     * Security override: `userId` is ALWAYS forced to the calling actor,
     * regardless of what was passed in `params` — mirrors `_beforeList`.
     * `isActive` is a legitimate optional filter (used by `countActive()`
     * to count only active subscriptions).
     */
    protected async _executeCount(params: AlertSubscriptionSearchInput, actor: Actor) {
        const filter: Record<string, unknown> = { userId: actor.id, deletedAt: null };
        if (params.isActive !== undefined) {
            filter.isActive = params.isActive;
        }
        const count = await this.model.count(filter);
        return { count };
    }

    /**
     * Convenience wrapper around `count()`, scoped to the caller's currently
     * active (non-deleted) subscriptions.
     *
     * Exists for the T-005 `gateAlerts()` middleware pre-population use case:
     * the route needs the actor's active-alert count BEFORE the limit-check
     * middleware runs, and calling `count()` directly would require every
     * caller to remember the `{ userId, isActive }` shape by hand. This is
     * additive sugar on top of the native `count()` — it does not replace or
     * shadow it.
     *
     * @param actor - The actor whose active subscriptions are being counted.
     * @param ctx - Optional service context.
     * @returns A `ServiceOutput` with the active-subscription count.
     */
    public async countActive(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ count: number }>> {
        // `page`/`pageSize` are stripped by `BaseCrudRead.count()` before reaching
        // `_executeCount` (they're irrelevant to a COUNT query) — passed here only
        // because `z.infer<TSearchSchema>` (the OUTPUT type, post-`.default()`)
        // requires them at the type level even though the schema itself defaults
        // both when omitted at the JSON boundary.
        return this.count(actor, { userId: actor.id, isActive: true, page: 1, pageSize: 1 }, ctx);
    }
}
