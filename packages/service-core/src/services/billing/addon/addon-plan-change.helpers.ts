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

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Direction of a billing plan change relative to aggregate limits.
 */
export type PlanChangeDirection = 'upgrade' | 'downgrade' | 'lateral';

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
