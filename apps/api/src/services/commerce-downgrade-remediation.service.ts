/**
 * Commerce downgrade remediation (HOS-1122).
 *
 * The commerce half of what `plan-downgrade-remediation.service.ts` does for
 * accommodation: work out which of an owner's listings the tier they are moving
 * DOWN to no longer covers, let them choose which to keep, and restrict the
 * rest. Plus the inverse, for when they move back up.
 *
 * ---
 * WHY THIS IS A SEPARATE MODULE AND NOT A WIDENING
 *
 * The owner's decision for HOS-1122 was explicit: commerce reuses the
 * accommodation MECHANISM — compute the excess, let the owner pick, mail the
 * warning, schedule for period end, restrict at apply time — rather than
 * inventing a second one. That is the shape this module follows step for step.
 *
 * What it does not reuse is the accommodation SERVICE, and the reason is
 * concrete rather than aesthetic. `computeDowngradeExcess` reads
 * `MAX_ACCOMMODATIONS`, `MAX_ACTIVE_PROMOTIONS` and
 * `MAX_PHOTOS_PER_ACCOMMODATION` off the target plan, resolving each absent key
 * with `?? -1`. A commerce tier declares none of the three. Feeding one to that
 * function does not fail: it reports three unlimited caps, zero excess, and a
 * successful no-op. Widening it to also read `MAX_GASTRONOMIES` would leave the
 * three accommodation dimensions still answering `-1` on every commerce call
 * and the commerce dimension answering `-1` on every accommodation one — five
 * silent unlimiteds where there used to be three.
 *
 * ---
 * THE CAP IS READ, AND ITS ABSENCE IS AN ERROR
 *
 * `resolveCommerceListingCap` throws when the target tier does not declare its
 * own vertical's listing key. Nothing else in this flow may substitute a
 * default: the limit engine resolves an unknown key as *unlimited* through five
 * layers without raising (HOS-1078 / HOS-973 R-2), so a downgrade that could
 * not find its cap must stop rather than compute an excess of zero and report
 * that it restricted nothing.
 *
 * Since HOS-975 the cap genuinely differs between tiers — gastronomy 1/3/5,
 * experiences 1/5/10 — so premium → pro on experiences is a real cut from ten
 * listings to five, not the "returns the carta and nothing else" the original
 * issue described.
 *
 * ---
 * WHAT "RESTRICTED" MEANS FOR A LISTING
 *
 * `entity_subscriptions.plan_restricted = true` on the listing's link row, plus
 * a visibility reconcile that takes the listing PRIVATE + INACTIVE. The flag is
 * what makes it stick: the reconciler reads it, so the next renewal webhook or
 * dunning recovery — which sees an `active` subscription and would otherwise
 * republish — leaves it alone. See the column's own docblock for why the flag
 * lives on the link row and why unlinking would have been worse.
 *
 * What it does NOT do is free a quota slot. `countOwnListings`
 * (`middlewares/commerce-limit-enforcement.ts`) counts every listing the owner
 * holds, restricted or not, so a cut listing keeps occupying its place and no
 * replacement can be created for it. That matches accommodation and is left
 * exactly as it is — see that function's docblock for why it is recorded as
 * undecided rather than quietly changed here.
 *
 * @module services/commerce-downgrade-remediation
 */

import {
    type CommerceVertical,
    findCommercePlanForVertical,
    LIMIT_KEY_BY_COMMERCE_VERTICAL
} from '@repo/billing';
import type { DrizzleClient } from '@repo/db';
import { and, entitySubscriptions, eq, getDb, inArray } from '@repo/db';
import type { CommerceDowngradePreview, DowngradeExcessItem, KeepSelections } from '@repo/schemas';
import type { EntityChangeData } from '@repo/service-core';
import { getRevalidationService } from '@repo/service-core';
import { apiLogger } from '../utils/logger';
import {
    bindCommerceCompletenessResolver,
    resolveCommerceEntityModel
} from './commerce-reconcile.service';

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

/**
 * Thrown when the target commerce tier does not declare the listing cap of its
 * own vertical.
 *
 * Distinct from "the plan is not in the catalogue" (that is a
 * `PlanDomainMismatchError` upstream): this one means the plan EXISTS and is a
 * tier of the right vertical, but is missing the single limit key the whole
 * downgrade turns on. Treating that as "unlimited" is the platform's
 * best-documented failure mode, so it is an error instead.
 */
export class CommerceListingCapMissingError extends Error {
    readonly planSlug: string;
    readonly vertical: CommerceVertical;

    constructor(planSlug: string, vertical: CommerceVertical) {
        super(
            `Commerce plan '${planSlug}' declares no ${LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical]} limit — refusing to treat a missing cap as unlimited`
        );
        this.name = 'CommerceListingCapMissingError';
        this.planSlug = planSlug;
        this.vertical = vertical;
    }
}

// ---------------------------------------------------------------------------
// Dependency injection contract
// ---------------------------------------------------------------------------

/** A listing as this module needs to see it, whatever vertical it is from. */
export interface CommerceListingForExcess {
    readonly id: string;
    readonly name: string;
    readonly updatedAt: Date;
    readonly slug?: string | null;
}

/**
 * External data access, injected as a record so the whole module is unit
 * testable without a database.
 */
export interface CommerceDowngradeDeps {
    /**
     * Link rows for one subscription and one vertical, newest listing first is
     * NOT required — this module sorts.
     */
    getLinkedListings(input: {
        subscriptionId: string;
        vertical: CommerceVertical;
        planRestricted: boolean;
    }): Promise<Array<{ entityId: string }>>;

    /** Resolves listing display data for the given ids of one vertical. */
    getListings(input: {
        vertical: CommerceVertical;
        ids: readonly string[];
    }): Promise<CommerceListingForExcess[]>;

    /** Flips `entity_subscriptions.plan_restricted` for the given listings. */
    setPlanRestricted(input: {
        subscriptionId: string;
        vertical: CommerceVertical;
        entityIds: readonly string[];
        planRestricted: boolean;
        db?: DrizzleClient;
    }): Promise<void>;

    /**
     * Re-derives one listing's public visibility. Wraps the SAME reconciler the
     * billing lifecycle uses, so listing visibility keeps exactly one writer.
     */
    reconcileListing(input: {
        vertical: CommerceVertical;
        entityId: string;
        subscriptionStatus: string;
        planRestricted: boolean;
    }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Vertical -> concrete thing (exhaustive, never a binary ternary)
// ---------------------------------------------------------------------------

/**
 * The `@repo/db` model that owns a vertical's listings.
 *
 * An exhaustive `switch` with a throwing default, rather than the binary
 * vertical ternary `scripts/check-no-binary-vertical-ternary.sh` forbids
 * (HOS-1079). That shape answers its ELSE branch for every value that is not
 * the one literal it tests — `'accommodation'` and `'partner'` included — so a
 * widened parameter would send a host's downgrade at the other vertical's
 * table and quietly restrict nothing.
 *
 * Not `resolveCommerceEntityModel` from `commerce-reconcile.service`: that one
 * returns the deliberately narrow `CommerceEntityModel` (`findById` + `update`
 * only), and this needs `findByIds` to fetch a whole keep set in one query.
 *
 * @param vertical - The commerce vertical.
 * @returns The full model for that vertical's listings.
 */
async function listingModelFor(
    vertical: CommerceVertical
): Promise<{ findByIds: (ids: string[]) => Promise<unknown> }> {
    const { experienceModel, gastronomyModel } = await import('@repo/db');
    switch (vertical) {
        case 'gastronomy':
            // The two models are structurally compatible with the narrow
            // `{ findByIds }` shape this function promises, but their concrete
            // `BaseModelImpl<Gastronomy>` / `BaseModelImpl<Experience>` types
            // are wider and mutually incompatible, so no common supertype
            // exists to return them both as. Only `findByIds` is ever called,
            // and its rows are read field-by-field into
            // `CommerceListingForExcess` immediately after, so nothing
            // downstream trusts the erased type.
            //
            // TYPE-WORKAROUND: same cast, and the same reason, as
            // `resolveCommerceEntityModel` in `commerce-reconcile.service.ts`.
            return gastronomyModel as unknown as { findByIds: (ids: string[]) => Promise<unknown> };
        case 'experience':
            // TYPE-WORKAROUND: same structural compatibility as gastronomy above.
            return experienceModel as unknown as { findByIds: (ids: string[]) => Promise<unknown> };
        default:
            throw new Error(`listingModelFor: unsupported commerce vertical '${vertical}'`);
    }
}

/**
 * The revalidation event for one listing of a vertical.
 *
 * Exhaustive for the same reason {@link listingModelFor} is: the fallback of a
 * ternary here would purge the wrong vertical's pages and report success.
 *
 * @param vertical - The commerce vertical.
 * @param id - The listing's UUID.
 * @returns The typed {@link EntityChangeData} for that listing.
 */
function revalidationEventFor(vertical: CommerceVertical, id: string): EntityChangeData {
    switch (vertical) {
        case 'gastronomy':
            return { entityType: 'gastronomy', id };
        case 'experience':
            return { entityType: 'experience', id };
        default:
            throw new Error(`revalidationEventFor: unsupported commerce vertical '${vertical}'`);
    }
}

// ---------------------------------------------------------------------------
// Production dependencies
// ---------------------------------------------------------------------------

/**
 * Production wiring.
 *
 * Exported for the same reason `plan-downgrade-remediation`'s `defaultDeps` is:
 * every unit test injects its own, so without a test that drives this object
 * directly it would never execute in CI at all.
 */
export const defaultCommerceDowngradeDeps: CommerceDowngradeDeps = {
    async getLinkedListings({ subscriptionId, vertical, planRestricted }) {
        const rows = await getDb()
            .select({ entityId: entitySubscriptions.entityId })
            .from(entitySubscriptions)
            .where(
                and(
                    eq(entitySubscriptions.subscriptionId, subscriptionId),
                    eq(entitySubscriptions.entityType, vertical),
                    eq(entitySubscriptions.planRestricted, planRestricted)
                )
            );
        return rows;
    },

    async getListings({ vertical, ids }) {
        if (ids.length === 0) return [];
        const rows = (await listingModelFor(vertical).then((model) =>
            model.findByIds([...ids])
        )) as Array<Record<string, unknown>>;
        return (
            rows
                // `findByIds` applies NO soft-delete filtering — its own docblock
                // says so and tells callers to filter the result themselves. This
                // caller did not, and three things turned that into lost revenue:
                // `softDelete` writes `updatedAt` alongside `deletedAt`, so a
                // deleted listing becomes the owner's most-recently-updated one;
                // `compareByRecency` sorts `updatedAt` DESC and marks the first
                // `cap` entries `keepByDefault`; and nothing removes the
                // `entity_subscriptions` row when a commerce listing is deleted
                // (the orphan-pruning cron is scoped to `entityType =
                // 'accommodation'`). Deleted listings therefore entered the keep
                // band FIRST and pushed live, paid ones out of it.
                //
                // Filtering here rather than in the query keeps this ONE
                // `SELECT ... WHERE id IN (…)` and puts the exclusion where the
                // contract says it belongs, in sight of the sort that depends on
                // it.
                .filter((row) => row.deletedAt === null || row.deletedAt === undefined)
                .map((row) => ({
                    id: row.id as string,
                    name:
                        (row.name as string | undefined) ?? (row.slug as string | undefined) ?? '',
                    updatedAt: (row.updatedAt as Date | undefined) ?? new Date(0),
                    slug: (row.slug as string | undefined) ?? null
                }))
        );
    },

    async setPlanRestricted({ subscriptionId, vertical, entityIds, planRestricted, db }) {
        if (entityIds.length === 0) return;
        const client = db ?? getDb();
        await client
            .update(entitySubscriptions)
            .set({ planRestricted, updatedAt: new Date() })
            .where(
                and(
                    eq(entitySubscriptions.subscriptionId, subscriptionId),
                    eq(entitySubscriptions.entityType, vertical),
                    inArray(entitySubscriptions.entityId, [...entityIds])
                )
            );
    },

    async reconcileListing({ vertical, entityId, subscriptionStatus, planRestricted }) {
        const { reconcileCommerceListingVisibility } = await import('@repo/service-core');
        await reconcileCommerceListingVisibility(
            { entityType: vertical, entityId, subscriptionStatus, planRestricted },
            resolveCommerceEntityModel(vertical),
            bindCommerceCompletenessResolver(vertical)
        );
    }
};

// ---------------------------------------------------------------------------
// Cap resolution
// ---------------------------------------------------------------------------

/**
 * Reads a commerce tier's listing cap.
 *
 * @param vertical - The vertical the subscription belongs to.
 * @param planSlug - The target tier's catalogue slug.
 * @returns The cap (`>= 0`).
 * @throws {CommerceListingCapMissingError} When the tier declares no cap, or
 *   declares it as `-1`. A commerce tier with an unlimited listing cap is not a
 *   thing the catalogue expresses, so `-1` here means the value fell through
 *   rather than that somebody chose it.
 * @throws {Error} When the slug names no tier of that vertical — the caller is
 *   expected to have validated membership through `resolveCommercePlanSlug`.
 */
export function resolveCommerceListingCap(vertical: CommerceVertical, planSlug: string): number {
    const plan = findCommercePlanForVertical({ vertical, slug: planSlug });
    if (!plan) {
        throw new Error(
            `resolveCommerceListingCap: '${planSlug}' is not a tier of the '${vertical}' vertical`
        );
    }
    const limitKey = LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical];
    const cap = plan.limits.find((limit) => limit.key === limitKey)?.value;
    if (cap === undefined || cap < 0) {
        throw new CommerceListingCapMissingError(planSlug, vertical);
    }
    return cap;
}

// ---------------------------------------------------------------------------
// Excess computation
// ---------------------------------------------------------------------------

/** Most-recently-updated first; the same default-keep order accommodation uses. */
function compareByRecency(a: CommerceListingForExcess, b: CommerceListingForExcess): number {
    return b.updatedAt.getTime() - a.updatedAt.getTime();
}

/**
 * Compute which of a commerce subscription's listings the target tier stops
 * covering. **Read-only.**
 *
 * @param input.subscriptionId - The commerce subscription being downgraded.
 * @param input.vertical - Its vertical.
 * @param input.targetPlanSlug - The tier being moved to.
 * @param deps - Injected data access; defaults to production.
 * @returns A {@link CommerceDowngradePreview}.
 * @throws {CommerceListingCapMissingError} See {@link resolveCommerceListingCap}.
 */
export async function computeCommerceDowngradeExcess(
    input: {
        readonly subscriptionId: string;
        readonly vertical: CommerceVertical;
        readonly targetPlanSlug: string;
    },
    deps: CommerceDowngradeDeps = defaultCommerceDowngradeDeps
): Promise<CommerceDowngradePreview> {
    const { subscriptionId, vertical, targetPlanSlug } = input;

    const cap = resolveCommerceListingCap(vertical, targetPlanSlug);

    // Already-restricted rows are excluded, exactly as `computeDowngradeExcess`
    // filters `planRestricted` accommodations: it is what makes a second run
    // over the same subscription a no-op instead of a second cut.
    const links = await deps.getLinkedListings({
        subscriptionId,
        vertical,
        planRestricted: false
    });
    const listings = await deps.getListings({
        vertical,
        ids: links.map((link) => link.entityId)
    });

    const sorted = [...listings].sort(compareByRecency);
    const activeCount = sorted.length;
    const excessCount = Math.max(0, activeCount - cap);

    const items: DowngradeExcessItem[] =
        excessCount === 0
            ? []
            : sorted.map((listing, index) => ({
                  id: listing.id,
                  name: listing.name,
                  updatedAt: listing.updatedAt.toISOString(),
                  // Commerce listings have no cheap view counter to break ties
                  // with; `updatedAt` alone decides, as it does for promotions.
                  viewCount: null,
                  keepByDefault: index < cap
              }));

    return { vertical, cap, activeCount, excessCount, items, hasExcess: excessCount > 0 };
}

// ---------------------------------------------------------------------------
// Keep-set resolution
// ---------------------------------------------------------------------------

/**
 * Resolves which listing ids survive, merging the owner's selection with the
 * default order.
 *
 * Same three rules `plan-downgrade-remediation`'s `resolveKeepIds` applies —
 * drop unknown ids, truncate an over-cap selection through the default band,
 * fall back to the default band when nothing valid remains — so a downgrade
 * behaves the same way whichever vertical it is in.
 */
function resolveKeepListingIds(params: {
    readonly items: readonly DowngradeExcessItem[];
    readonly cap: number;
    readonly selectedIds?: readonly string[];
}): { readonly keepIds: ReadonlySet<string>; readonly fromSelection: readonly string[] } {
    const { items, cap, selectedIds } = params;
    const allIds = new Set(items.map((item) => item.id));
    const defaultKeep = items.filter((item) => item.keepByDefault).map((item) => item.id);

    if (cap >= items.length || items.length === 0) {
        return { keepIds: allIds, fromSelection: [] };
    }

    const valid = selectedIds?.filter((id) => allIds.has(id)) ?? [];
    if (valid.length === 0) {
        return { keepIds: new Set(defaultKeep.slice(0, cap)), fromSelection: [] };
    }

    const chosen = valid.slice(0, cap);
    const keepIds = new Set(chosen);
    // Fill any slots the owner left unclaimed from the default band, so a
    // partial selection never restricts MORE than the cap requires.
    for (const id of defaultKeep) {
        if (keepIds.size >= cap) break;
        keepIds.add(id);
    }
    return { keepIds, fromSelection: chosen };
}

// ---------------------------------------------------------------------------
// Apply — restriction
// ---------------------------------------------------------------------------

/** What a restriction pass did. */
export interface CommerceDowngradeSummary {
    /** Listing ids restricted in this run. Empty on an idempotent re-run. */
    readonly restricted: readonly string[];
    /** Listing ids kept because the owner asked for them by id. */
    readonly keptBySelection: readonly string[];
    /** The cap that was applied. */
    readonly cap: number;
}

/**
 * Restrict the listings a commerce downgrade no longer covers.
 *
 * **Idempotent**: a second run recomputes the excess over the rows that are
 * still unrestricted and finds none.
 *
 * @param input.subscriptionId - The downgraded subscription.
 * @param input.vertical - Its vertical.
 * @param input.targetPlanSlug - The tier now in force.
 * @param input.subscriptionStatus - The subscription's status, forwarded to the
 *   visibility reconciler. A downgrade applies to a LIVE subscription, so this
 *   is normally `'active'`; it is passed rather than assumed because assuming it
 *   would republish a listing whose subscription had lapsed in the meantime.
 * @param input.keepSelections - The owner's persisted choice, if any.
 * @returns A {@link CommerceDowngradeSummary}.
 */
export async function applyCommerceDowngradeRestrictions(input: {
    readonly subscriptionId: string;
    readonly vertical: CommerceVertical;
    readonly targetPlanSlug: string;
    readonly subscriptionStatus: string;
    readonly keepSelections?: KeepSelections;
    readonly deps?: CommerceDowngradeDeps;
}): Promise<CommerceDowngradeSummary> {
    const { subscriptionId, vertical, targetPlanSlug, subscriptionStatus, keepSelections } = input;
    const deps = input.deps ?? defaultCommerceDowngradeDeps;

    const preview = await computeCommerceDowngradeExcess(
        { subscriptionId, vertical, targetPlanSlug },
        deps
    );

    if (!preview.hasExcess) {
        apiLogger.info(
            { subscriptionId, vertical, targetPlanSlug, cap: preview.cap },
            'commerce-downgrade-remediation: no excess — idempotent no-op'
        );
        return { restricted: [], keptBySelection: [], cap: preview.cap };
    }

    const { keepIds, fromSelection } = resolveKeepListingIds({
        items: preview.items,
        cap: preview.cap,
        selectedIds: keepSelections?.listingIds
    });
    const restrictIds = preview.items.map((item) => item.id).filter((id) => !keepIds.has(id));

    await deps.setPlanRestricted({
        subscriptionId,
        vertical,
        entityIds: restrictIds,
        planRestricted: true
    });

    // Visibility per listing, through the shared reconciler. Each is
    // independent: one listing failing to flip must not leave the others
    // public, and the flag is already written either way — the 6-hourly
    // reconcile and the next lifecycle event both re-derive from it.
    for (const entityId of restrictIds) {
        try {
            await deps.reconcileListing({
                vertical,
                entityId,
                subscriptionStatus,
                planRestricted: true
            });
        } catch (error) {
            apiLogger.error(
                {
                    subscriptionId,
                    vertical,
                    entityId,
                    error: error instanceof Error ? error.message : String(error)
                },
                'commerce-downgrade-remediation: listing visibility reconcile failed — flag is written, continuing'
            );
        }
    }

    scheduleCommerceRevalidation({ vertical, entityIds: restrictIds, reason: targetPlanSlug });

    apiLogger.info(
        {
            subscriptionId,
            vertical,
            targetPlanSlug,
            cap: preview.cap,
            activeCount: preview.activeCount,
            restrictedCount: restrictIds.length,
            keptBySelectionCount: fromSelection.length
        },
        'commerce-downgrade-remediation: restriction pass complete'
    );

    return { restricted: restrictIds, keptBySelection: fromSelection, cap: preview.cap };
}

// ---------------------------------------------------------------------------
// Apply — restoration (the inverse)
// ---------------------------------------------------------------------------

/**
 * Restore listings a previous downgrade restricted, up to the new tier's cap.
 *
 * The mirror of {@link applyCommerceDowngradeRestrictions}, and the reason the
 * restriction is a reversible FLAG rather than an unlinked row: an upgrade has
 * to know which listings to bring back, and a cleared `subscription_id` could
 * not say.
 *
 * **Partial restore at cap**: when the headroom is smaller than the restricted
 * set, the most-recently-updated of them come back and the rest stay restricted
 * — the same treatment `applyUpgradeRestorations` gives accommodations.
 *
 * @param input.subscriptionId - The upgraded subscription.
 * @param input.vertical - Its vertical.
 * @param input.newPlanSlug - The tier now in force.
 * @param input.subscriptionStatus - Status forwarded to the reconciler.
 * @returns The listing ids restored, and those still restricted.
 */
export async function applyCommerceUpgradeRestorations(input: {
    readonly subscriptionId: string;
    readonly vertical: CommerceVertical;
    readonly newPlanSlug: string;
    readonly subscriptionStatus: string;
    readonly deps?: CommerceDowngradeDeps;
}): Promise<{ readonly restored: readonly string[]; readonly stillRestricted: readonly string[] }> {
    const { subscriptionId, vertical, newPlanSlug, subscriptionStatus } = input;
    const deps = input.deps ?? defaultCommerceDowngradeDeps;

    const cap = resolveCommerceListingCap(vertical, newPlanSlug);

    const [restrictedLinks, coveredLinks] = await Promise.all([
        deps.getLinkedListings({ subscriptionId, vertical, planRestricted: true }),
        deps.getLinkedListings({ subscriptionId, vertical, planRestricted: false })
    ]);

    if (restrictedLinks.length === 0) {
        return { restored: [], stillRestricted: [] };
    }

    const headroom = Math.max(0, cap - coveredLinks.length);
    if (headroom === 0) {
        return { restored: [], stillRestricted: restrictedLinks.map((link) => link.entityId) };
    }

    const restricted = await deps.getListings({
        vertical,
        ids: restrictedLinks.map((link) => link.entityId)
    });
    const ordered = [...restricted].sort(compareByRecency);
    const restoreIds = ordered.slice(0, headroom).map((listing) => listing.id);
    const stillRestricted = ordered.slice(headroom).map((listing) => listing.id);

    await deps.setPlanRestricted({
        subscriptionId,
        vertical,
        entityIds: restoreIds,
        planRestricted: false
    });

    for (const entityId of restoreIds) {
        try {
            await deps.reconcileListing({
                vertical,
                entityId,
                subscriptionStatus,
                planRestricted: false
            });
        } catch (error) {
            apiLogger.error(
                {
                    subscriptionId,
                    vertical,
                    entityId,
                    error: error instanceof Error ? error.message : String(error)
                },
                'commerce-downgrade-remediation: listing visibility restore failed — flag is cleared, continuing'
            );
        }
    }

    scheduleCommerceRevalidation({ vertical, entityIds: restoreIds, reason: newPlanSlug });

    apiLogger.info(
        {
            subscriptionId,
            vertical,
            newPlanSlug,
            cap,
            restoredCount: restoreIds.length,
            stillRestrictedCount: stillRestricted.length
        },
        'commerce-downgrade-remediation: restoration pass complete'
    );

    return { restored: restoreIds, stillRestricted };
}

/**
 * The one entry point the UPGRADE paths call (HOS-1122).
 *
 * `applyUpgradeRestorationsOrWarn` — the accommodation restore — now refuses a
 * plan from another domain, so the upgrade sites that a commerce subscription
 * can reach need something to call instead of nothing. This is it, and it is
 * shaped to be safe at a call site that does not know which domain it is in:
 *
 * - it resolves the plan's slug itself, and returns quietly when that slug is
 *   not a commerce tier (an accommodation upgrade passing through is a no-op,
 *   not an error);
 * - it never throws. An upgrade has already committed and been paid for by the
 *   time this runs; a failure here leaves listings restricted that could have
 *   come back, which the owner can see and support can re-run, whereas a throw
 *   would break a webhook.
 *
 * @param input.subscriptionId - The upgraded subscription.
 * @param input.newPlanId - The plan UUID it now sits on.
 * @param input.subscriptionStatus - Its status, forwarded to the reconciler.
 */
export async function restoreCommerceListingsForUpgrade(input: {
    readonly subscriptionId: string;
    readonly newPlanId: string;
    readonly subscriptionStatus: string;
}): Promise<void> {
    const { subscriptionId, newPlanId, subscriptionStatus } = input;
    try {
        const [{ getQZPayBilling }, { commerceVerticalForPlanSlug }] = await Promise.all([
            import('../middlewares/billing'),
            import('@repo/billing')
        ]);
        const billing = getQZPayBilling();
        if (!billing) return;

        const plan = await billing.plans.get(newPlanId);
        const planSlug = plan?.name ?? null;
        if (planSlug === null) return;

        const vertical = commerceVerticalForPlanSlug(planSlug);
        if (vertical === undefined) {
            // An accommodation or partner plan — not this module's business.
            return;
        }

        const result = await applyCommerceUpgradeRestorations({
            subscriptionId,
            vertical,
            newPlanSlug: planSlug,
            subscriptionStatus
        });
        apiLogger.info(
            {
                subscriptionId,
                vertical,
                planSlug,
                restoredCount: result.restored.length,
                stillRestrictedCount: result.stillRestricted.length
            },
            'commerce-downgrade-remediation: upgrade restoration applied'
        );
    } catch (error) {
        apiLogger.error(
            {
                subscriptionId,
                newPlanId,
                error: error instanceof Error ? error.message : String(error)
            },
            'commerce-downgrade-remediation: upgrade restoration failed — non-blocking, upgrade already committed'
        );
    }
}

// ---------------------------------------------------------------------------
// Revalidation
// ---------------------------------------------------------------------------

/**
 * Purge the cached pages of listings whose visibility just moved.
 *
 * Fire-and-forget and fully swallowed: a listing that is PRIVATE in the
 * database but still cached at the edge is a stale page, not a wrong write, and
 * must never undo a restriction that already committed.
 */
function scheduleCommerceRevalidation(params: {
    vertical: CommerceVertical;
    entityIds: readonly string[];
    reason: string;
}): void {
    const { vertical, entityIds, reason } = params;
    if (entityIds.length === 0) return;
    try {
        const revalidationService = getRevalidationService();
        if (!revalidationService) return;
        const events: EntityChangeData[] = entityIds.map((id) =>
            revalidationEventFor(vertical, id)
        );
        revalidationService.scheduleRevalidationBatch({
            events,
            reason: `commerce-downgrade-remediation: ${reason}`
        });
    } catch (error) {
        apiLogger.warn(
            { vertical, error: error instanceof Error ? error.message : String(error) },
            'commerce-downgrade-remediation: revalidation scheduling failed (non-blocking)'
        );
    }
}
