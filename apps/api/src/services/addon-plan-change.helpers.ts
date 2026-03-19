/**
 * Addon Plan Change — Pure Helper Utilities
 *
 * Extracted from addon-plan-change.service.ts to keep that module under 500 lines.
 * All functions here are pure (no side-effects beyond logging/Sentry) and have no
 * dependency on service state or DB connections.
 *
 * @module services/addon-plan-change.helpers
 */

import { getPlanBySlug } from '@repo/billing';
import * as Sentry from '@sentry/node';
import { apiLogger } from '../utils/logger.js';
import type { PlanChangeDirection } from './addon-plan-change.service.js';

// ─── Advisory lock helper (GAP-043-035) ──────────────────────────────────────

/**
 * Maps a customer UUID string to a 32-bit signed integer suitable for use as
 * a PostgreSQL advisory lock key via `pg_advisory_xact_lock`.
 *
 * The hash is purely deterministic — same input always yields same output.
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
 * Resolves the base limit value for a given limit key from a plan definition.
 * Returns `0` when the key is not present in the plan's limits array.
 *
 * @param planSlug - Billing plan slug (e.g. `'owner-basico'`)
 * @param limitKey - Limit key to look up (e.g. `'accommodations'`)
 * @returns Base limit value, or `0` if the plan or key is not found
 */
export function resolvePlanBaseLimit(planSlug: string, limitKey: string): number {
    const planDef = getPlanBySlug(planSlug);
    if (!planDef) {
        apiLogger.warn(
            { planSlug, limitKey },
            'Plan not found in billing config for base limit resolution — using 0'
        );
        Sentry.captureMessage(
            `Plan "${planSlug}" not found in billing config during base limit resolution`,
            {
                level: 'warning',
                tags: { subsystem: 'billing-addon-lifecycle', action: 'resolve-plan-base-limit' },
                extra: { planSlug, limitKey }
            }
        );
        return 0;
    }
    return planDef.limits.find((l) => l.key === limitKey)?.value ?? 0;
}

// ─── Direction computation ────────────────────────────────────────────────────

/**
 * Determines the overall direction of a plan change by comparing summed base
 * limits across all affected limit keys. Unlimited values (-1) are excluded
 * from the comparison sum to avoid misleading -1 dominating the result.
 *
 * @param limitKeys - Array of limit key strings affected by the plan change
 * @param oldPlanId - Slug of the plan the customer is leaving
 * @param newPlanId - Slug of the plan the customer is moving to
 * @returns `'upgrade'` | `'downgrade'` | `'lateral'`
 */
export function computeDirection(
    limitKeys: readonly string[],
    oldPlanId: string,
    newPlanId: string
): PlanChangeDirection {
    let oldTotal = 0;
    let newTotal = 0;

    for (const key of limitKeys) {
        const oldBase = resolvePlanBaseLimit(oldPlanId, key);
        const newBase = resolvePlanBaseLimit(newPlanId, key);

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
