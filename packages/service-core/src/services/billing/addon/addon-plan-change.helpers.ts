/**
 * Addon Plan Change .. Pure Helper Utilities
 *
 * Extracted from addon-plan-change.service.ts to keep that module under 500 lines.
 * All functions here are pure (no side-effects) and have no dependency on service
 * state or DB connections.
 *
 * SPEC-192 T-026: `resolvePlanBaseLimit` and `computeDirection` now accept
 * pre-fetched `Record<string,number>` limits maps (the DB shape returned by
 * `PlanService`) instead of plan slugs/IDs. This removes the `getPlanBySlug`
 * config import and makes callers responsible for resolving plans via
 * `PlanService` before calling these helpers.
 *
 * @module services/addon-plan-change.helpers
 */

import { productDomainForLimitKey } from '@repo/billing';
import type { ProductDomainValue } from '@repo/schemas';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Direction of a billing plan change relative to aggregate limits.
 */
export type PlanChangeDirection = 'upgrade' | 'downgrade' | 'lateral';

// ─── Limit-key ↔ plan domain classification (HOS-1279) ───────────────────────

/**
 * What a plan change may do with one of the customer's active limit add-ons.
 *
 * - `'owned'`        — the add-on's cap belongs to the domain of the plan being
 *                      changed. Recalculate it.
 * - `'foreign'`      — the cap belongs to a DIFFERENT vertical. Leave it alone.
 * - `'unclassified'` — the cap, or the plan, could not be placed in a domain at
 *                      all. Refuse; never guess.
 */
export type LimitKeyDomainVerdict =
    | { readonly kind: 'owned' }
    | { readonly kind: 'foreign'; readonly limitDomain: ProductDomainValue }
    | { readonly kind: 'unclassified'; readonly limitDomain: ProductDomainValue | undefined };

/**
 * Decides whether a limit key is one that a plan change in `planDomain` is
 * allowed to rewrite (HOS-1279).
 *
 * ---
 * WHY THIS EXISTS
 *
 * `handlePlanChangeAddonRecalculation` loads EVERY active add-on purchase the
 * customer holds and recomputes each one's cap as
 * `newPlan.limits[limitKey] ?? 0` + the add-on's increase. That is correct only
 * while a customer holds one subscription. Since the per-vertical split
 * (HOS-688) one billing customer legitimately holds several at once, and a plan
 * from vertical A does not declare vertical B's caps — so the `?? 0` resolved
 * the base of a foreign cap to ZERO and wrote it back.
 *
 * Measured shape of the bug: a host holding an active `extra-gastronomies-1`
 * add-on (gastronomy plan base 5, +1 = 6) who changes their ACCOMMODATION plan
 * gets `limits.set({ limitKey: 'max_gastronomies', maxValue: 0 + 1 })` — their
 * restaurant cap is silently stomped from 6 to 1 by a plan change that had
 * nothing to do with gastronomy. It runs in the other direction too: the
 * commerce plan-change route reaches the same recalculation through
 * `applyTrialingPlanUpgrade`, so a gastronomy tier change stomps the owner's
 * accommodation add-on caps.
 *
 * ---
 * WHY THE DOMAIN IS DERIVED AND NOT STORED
 *
 * `billing_customer_limits` is keyed `(customer_id, limit_key)` and carries no
 * domain column. It does not need one, and adding one would be WRONG for part
 * of the vocabulary:
 *
 *   - 17 of the 22 `LimitKey` members belong to exactly one domain, so the key
 *     ITSELF is the discriminator — `productDomainForLimitKey` is exhaustive
 *     over `LimitKey` by type (HOS-1078), so `max_gastronomies` can never be
 *     ambiguous;
 *   - the other 5 (the `TOURIST_VIP_LIMITS` block) are declared by plans in
 *     FOUR different domains on purpose — every accommodation plan, both
 *     tourist plans and all six commerce tiers spread that constant whole — and
 *     a customer has ONE favorites allowance, not one per vertical. A domain
 *     column would have no correct value to write for those five.
 *
 * So the fix is a derivation at the point of use, not a migration.
 *
 * ---
 * WHY `===` AND NOT `subscriptionMatchesDomain`
 *
 * That function is the single comparator for a SUBSCRIPTION ROW's domain, and
 * it fails OPEN for accommodation because `billing_subscriptions.product_domain`
 * post-dates most rows (SPEC-239). Neither argument here is a subscription row:
 * both sides are derived from the static catalogues, where a missing value means
 * "we cannot place this", not "an old accommodation record". Failing open here
 * would re-introduce the `?? ACCOMMODATION` that HOS-1078 deleted one layer
 * down — a foreign cap rewritten off a plan that does not declare it.
 *
 * @param input.limitKey - The cap the add-on raises (`addon.affectsLimitKey`).
 * @param input.planDomain - `product_domain` of the plan being changed TO, or
 *   `undefined` when the plan could not be resolved.
 * @returns The verdict; callers must not recalculate anything but `'owned'`.
 *
 * @example
 * ```ts
 * classifyLimitKeyAgainstPlanDomain({ limitKey: 'max_accommodations', planDomain: 'accommodation' });
 * // { kind: 'owned' }
 * classifyLimitKeyAgainstPlanDomain({ limitKey: 'max_gastronomies', planDomain: 'accommodation' });
 * // { kind: 'foreign', limitDomain: 'gastronomy' }
 * classifyLimitKeyAgainstPlanDomain({ limitKey: 'max_typo', planDomain: 'accommodation' });
 * // { kind: 'unclassified', limitDomain: undefined }
 * ```
 */
export function classifyLimitKeyAgainstPlanDomain(input: {
    readonly limitKey: string;
    readonly planDomain: ProductDomainValue | undefined;
}): LimitKeyDomainVerdict {
    const limitDomain = productDomainForLimitKey(input.limitKey);

    // Either side unplaceable ⇒ refuse. An unknown limit key is typically a
    // `billing_addons.affects_limit_key` row that matches nothing; an absent
    // plan domain means the plan row could not be classified. Recalculating on
    // either would write a cap computed from a plan that may not declare it.
    if (limitDomain === undefined || input.planDomain === undefined) {
        return { kind: 'unclassified', limitDomain };
    }

    if (limitDomain !== input.planDomain) {
        return { kind: 'foreign', limitDomain };
    }

    return { kind: 'owned' };
}

// ─── Advisory lock helper (GAP-043-035) ──────────────────────────────────────

/**
 * Maps a customer UUID string to a 32-bit signed integer suitable for use as
 * a PostgreSQL advisory lock key via `pg_advisory_xact_lock`.
 *
 * The hash is purely deterministic .. same input always yields same output.
 * Collisions are theoretically possible but astronomically rare for UUIDs.
 *
 * @param customerId - Billing customer UUID string
 * @returns 32-bit signed integer hash
 */
export function hashCustomerId(customerId: string): number {
    let hash = 0;
    for (const char of customerId) {
        hash = (hash << 5) - hash + char.charCodeAt(0);
        hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

// ─── Plan limit resolution ────────────────────────────────────────────────────

/**
 * Resolves the base limit value for a given limit key from a pre-fetched plan
 * limits map. Returns `0` when the key is not present in the map.
 *
 * The `limits` map is the `Record<string, number>` shape returned by
 * `PlanService.getById` / `PlanService.getBySlug` (DB storage format, where -1
 * means unlimited). Callers are responsible for resolving the plan from the DB
 * before calling this helper (SPEC-192 T-026 cutover from config-backed lookup).
 *
 * @param limits - Plan limits map (`Record<limitKey, value>`) from the DB plan response
 * @param limitKey - Limit key to look up (e.g. `'max_accommodations'`)
 * @returns Base limit value, or `0` if the key is not present in the map
 *
 * @example
 * ```ts
 * const plan = await planService.getBySlug('owner-basico');
 * if (plan.success) {
 *   const base = resolvePlanBaseLimit(plan.data.limits, 'max_accommodations');
 * }
 * ```
 */
export function resolvePlanBaseLimit(
    limits: Readonly<Record<string, number>>,
    limitKey: string
): number {
    return limits[limitKey] ?? 0;
}

// ─── Direction computation ────────────────────────────────────────────────────

/**
 * Determines the overall direction of a plan change by comparing summed base
 * limits across all affected limit keys. Unlimited values (-1) are excluded
 * from the comparison sum to avoid misleading -1 dominating the result.
 *
 * Accepts pre-fetched plan limits maps (the DB `Record<string,number>` shape
 * from `PlanService`) instead of plan slugs/IDs. Callers must resolve both plans
 * before calling this helper (SPEC-192 T-026 cutover from config-backed lookup).
 *
 * @param limitKeys - Array of limit key strings affected by the plan change
 * @param oldPlanLimits - Limits map of the plan the customer is leaving
 * @param newPlanLimits - Limits map of the plan the customer is moving to
 * @returns `'upgrade'` | `'downgrade'` | `'lateral'`
 *
 * @example
 * ```ts
 * const direction = computeDirection(
 *   ['max_accommodations'],
 *   { max_accommodations: 3 },
 *   { max_accommodations: 10 }
 * ); // 'upgrade'
 * ```
 */
export function computeDirection(
    limitKeys: readonly string[],
    oldPlanLimits: Readonly<Record<string, number>>,
    newPlanLimits: Readonly<Record<string, number>>
): PlanChangeDirection {
    let oldTotal = 0;
    let newTotal = 0;

    for (const key of limitKeys) {
        const oldBase = resolvePlanBaseLimit(oldPlanLimits, key);
        const newBase = resolvePlanBaseLimit(newPlanLimits, key);

        if (oldBase !== -1) {
            oldTotal += oldBase;
        }
        if (newBase !== -1) {
            newTotal += newBase;
        }
    }

    if (newTotal > oldTotal) return 'upgrade';
    if (newTotal < oldTotal) return 'downgrade';
    return 'lateral';
}

// ─── Increment summing ────────────────────────────────────────────────────────

/**
 * Sums the `increase` field for a specific `limitKey` across a list of addon
 * purchase rows. Purchases whose `limitAdjustments` array does not contain a
 * matching entry contribute 0.
 *
 * @param purchases - Array of purchase rows with optional `limitAdjustments`
 * @param limitKey - Limit key whose increments should be summed
 * @returns Total increment value across all purchases
 */
export function sumIncrements(
    purchases: ReadonlyArray<{
        limitAdjustments?: Array<{ limitKey: string; increase: number }> | null;
    }>,
    limitKey: string
): number {
    let total = 0;
    for (const purchase of purchases) {
        const adjustments = purchase.limitAdjustments ?? [];
        const match = adjustments.find((la) => la.limitKey === limitKey);
        if (match) {
            total += match.increase;
        }
    }
    return total;
}
