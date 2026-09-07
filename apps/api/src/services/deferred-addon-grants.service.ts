/**
 * What a DEFERRED add-on still grants after the plan that paid for it is gone
 * (HOS-847 PR 7b).
 *
 * ## The hole this closes
 *
 * PR 7a stopped revoking an add-on whose own paid period was still running: the
 * row keeps `status = 'active'`, gains `cancel_at_period_end = true`, and its
 * QZPay entitlement/limit rows are deliberately left in place.
 *
 * That delivered nothing. Both entitlement resolvers return BEFORE they merge
 * customer-level grants when the customer has no live subscription:
 *
 * - `middlewares/entitlement.ts` — the `if (!activeSubscription)` early return
 *   answers with the role-appropriate defaults; `billing.entitlements
 *   .getByCustomerId` / `billing.limits.getByCustomerId` run further down.
 * - `middlewares/owner-entitlement.ts` — same cut, in `loadCustomerEntitlements`
 *   and in the `owner-basico` limits fallback.
 *
 * So a host whose plan ended on the 10th, holding an add-on paid through the
 * 25th, was served `owner-basico` limits on the 11th. The row said `active`, the
 * QZPay grant was intact, and nothing on the request path ever looked at either.
 * The one reader that DID honour the deferral is
 * `packages/service-core/.../featured-entitlement.resolver.ts`, which queries the
 * purchases table directly.
 *
 * ## Why this reads the purchase row and not "everything customer-level"
 *
 * Merging the whole customer-level grant set into those early returns would also
 * revive grants of any other origin — an admin's manual grant, a stale row a
 * failed revocation left behind — which is a far wider behavioural change than
 * the one the owner approved. This module answers a narrower question: **which
 * add-ons did a cause-aware caller deliberately defer, and are still inside the
 * period they were charged for?** Those, and nothing else.
 *
 * The grants come off the purchase ROW (`limit_adjustments` /
 * `entitlement_adjustments`), which is the same source
 * `addon-plan-change.service.ts` and `recalculateAddonLimitsForCustomer` do
 * arithmetic on — not a re-derivation from the catalog. A row whose arrays are
 * empty therefore contributes nothing here, exactly as it contributes nothing
 * there.
 *
 * ## Limits ADD, they do not overwrite
 *
 * A customer-level limit override replaces the plan value
 * (`limits.set(key, maxValue)`), because QZPay stores the already-summed total.
 * An add-on's `limit_adjustments[].increase` is a DELTA over a base plan limit,
 * so it is added to whatever baseline the caller resolved. That baseline is the
 * fallback plan (`owner-basico` or tourist-free), which is the honest base once
 * the paid plan is gone.
 *
 * @module services/deferred-addon-grants
 */

import { type EntitlementKey, isEntitlementKey, isLimitKey, type LimitKey } from '@repo/billing';
import { and, billingAddonPurchases, eq, getDb, gt, isNull } from '@repo/db';
import { parseEntitlementAdjustments, parseLimitAdjustments } from '@repo/service-core';
import { apiLogger } from '../utils/logger';

/**
 * The entitlements and limit deltas contributed by a customer's still-running
 * deferred add-ons.
 */
export interface DeferredAddonGrants {
    /** Entitlement keys the deferred add-ons still grant. */
    readonly entitlements: ReadonlySet<EntitlementKey>;
    /**
     * Per-limit total increase, summed across every deferred add-on that
     * declares that key. A DELTA, not an absolute value.
     */
    readonly limitIncrements: ReadonlyMap<LimitKey, number>;
    /** `billing_addon_purchases.id` of each row that contributed, for logs. */
    readonly purchaseIds: readonly string[];
    /**
     * `true` when the lookup failed and the grants above are empty for that
     * reason rather than because there are none.
     *
     * Callers must not cache a degraded answer: it under-grants, and a 5-minute
     * TTL over an under-grant is five minutes of a customer being denied
     * something they paid for.
     */
    readonly degraded: boolean;
}

/** An answer carrying nothing — the common case, and the failure case. */
const EMPTY_GRANTS: DeferredAddonGrants = {
    entitlements: new Set<EntitlementKey>(),
    limitIncrements: new Map<LimitKey, number>(),
    purchaseIds: [],
    degraded: false
};

/** Input for {@link loadDeferredAddonGrants}. */
export interface LoadDeferredAddonGrantsInput {
    /** QZPay `billing_customers.id`. */
    readonly customerId: string;
}

/**
 * Reads the add-ons this customer is still inside a paid period for, after a
 * cause-aware caller deferred them.
 *
 * The four predicates are each load-bearing:
 * - `status = 'active'` — a revoked or expired row grants nothing.
 * - `cancel_at_period_end = true` — the flag a cause-aware caller sets. Without
 *   it this would pick up a healthy add-on under a live plan, whose grants the
 *   normal customer-level merge already covers, and double-count its increase.
 * - `current_period_end > now()` — an elapsed period is the `addon-expiry`
 *   cron's job, not a grant.
 * - `deleted_at IS NULL` — soft-delete, as everywhere.
 *
 * Never throws: a failed lookup answers empty with `degraded: true`.
 *
 * @param input - The QZPay customer id to resolve.
 * @returns What those add-ons still grant; empty when there are none.
 *
 * @example
 * ```ts
 * const grants = await loadDeferredAddonGrants({ customerId });
 * const merged = mergeDeferredAddonGrants({ grants, entitlements, limits });
 * ```
 */
export async function loadDeferredAddonGrants(
    input: LoadDeferredAddonGrantsInput
): Promise<DeferredAddonGrants> {
    const { customerId } = input;

    try {
        const rows = await getDb()
            .select({
                id: billingAddonPurchases.id,
                addonSlug: billingAddonPurchases.addonSlug,
                limitAdjustments: billingAddonPurchases.limitAdjustments,
                entitlementAdjustments: billingAddonPurchases.entitlementAdjustments
            })
            .from(billingAddonPurchases)
            .where(
                and(
                    eq(billingAddonPurchases.customerId, customerId),
                    eq(billingAddonPurchases.status, 'active'),
                    eq(billingAddonPurchases.cancelAtPeriodEnd, true),
                    gt(billingAddonPurchases.currentPeriodEnd, new Date()),
                    isNull(billingAddonPurchases.deletedAt)
                )
            );

        if (!Array.isArray(rows) || rows.length === 0) {
            return EMPTY_GRANTS;
        }

        const entitlements = new Set<EntitlementKey>();
        const limitIncrements = new Map<LimitKey, number>();
        const purchaseIds: string[] = [];

        for (const row of rows) {
            const parseContext = { purchaseId: row.id, addonSlug: row.addonSlug };
            purchaseIds.push(row.id);

            for (const adjustment of parseEntitlementAdjustments(
                row.entitlementAdjustments,
                parseContext
            )) {
                if (adjustment.granted && isEntitlementKey(adjustment.entitlementKey)) {
                    entitlements.add(adjustment.entitlementKey);
                }
            }

            for (const adjustment of parseLimitAdjustments(row.limitAdjustments, parseContext)) {
                if (!isLimitKey(adjustment.limitKey)) {
                    continue;
                }
                // Summed, not overwritten: two deferred add-ons on the same key
                // each bought their own increase.
                limitIncrements.set(
                    adjustment.limitKey,
                    (limitIncrements.get(adjustment.limitKey) ?? 0) + adjustment.increase
                );
            }
        }

        apiLogger.debug(
            {
                customerId,
                purchaseIds,
                entitlements: Array.from(entitlements),
                limitIncrements: Object.fromEntries(limitIncrements)
            },
            'HOS-847: deferred add-ons still granting after the plan ended'
        );

        return { entitlements, limitIncrements, purchaseIds, degraded: false };
    } catch (error) {
        apiLogger.warn(
            {
                customerId,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-847: could not read deferred add-on grants — a customer inside a paid add-on period may be under-entitled on this request'
        );

        return { ...EMPTY_GRANTS, degraded: true };
    }
}

/** Input for {@link mergeDeferredAddonGrants}. */
export interface MergeDeferredAddonGrantsInput {
    /** What {@link loadDeferredAddonGrants} answered. */
    readonly grants: DeferredAddonGrants;
    /** The baseline entitlement set the caller resolved. */
    readonly entitlements: ReadonlySet<EntitlementKey>;
    /** The baseline limits the caller resolved. */
    readonly limits: ReadonlyMap<LimitKey, number>;
}

/**
 * Folds deferred add-on grants onto a resolved baseline.
 *
 * **Always returns fresh collections.** The callers' baselines include
 * `buildHostDraftDefaultsResult`'s MEMOIZED result, which is shared across every
 * HOST request for five minutes — mutating it in place would leak one customer's
 * add-on into everybody else's entitlements.
 *
 * @param input - The grants and the baseline to fold them onto.
 * @returns New `entitlements` / `limits` collections carrying both.
 *
 * @example
 * ```ts
 * const { entitlements, limits } = mergeDeferredAddonGrants({
 *     grants, entitlements: base.entitlements, limits: base.limits
 * });
 * ```
 */
export function mergeDeferredAddonGrants(input: MergeDeferredAddonGrantsInput): {
    entitlements: Set<EntitlementKey>;
    limits: Map<LimitKey, number>;
} {
    const { grants } = input;

    const entitlements = new Set<EntitlementKey>(input.entitlements);
    const limits = new Map<LimitKey, number>(input.limits);

    for (const key of grants.entitlements) {
        entitlements.add(key);
    }

    for (const [key, increase] of grants.limitIncrements) {
        const base = limits.get(key);
        // `-1` is UNLIMITED across this codebase; adding to it would turn an
        // unlimited allowance into a small finite number. A missing baseline
        // means the fallback plan does not declare the key at all, in which case
        // the add-on's own increase IS the allowance (the same baseline of 0
        // `computeAddonPurchaseAdjustments` uses when a plan cannot be resolved).
        if (base === -1) {
            continue;
        }
        limits.set(key, (base ?? 0) + increase);
    }

    return { entitlements, limits };
}
