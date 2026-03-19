/**
 * Pure addon downgrade detection logic.
 *
 * Provides functions to identify which limit keys were downgraded after a
 * plan change and which of those downgrades exceed current usage.
 * No infra dependencies (logger, Sentry, notifications).
 *
 * @module services/billing/addon/addon-downgrade-detection
 */

import type { RecalculationResult } from './addon-limit-recalculation.service.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A recalculation result that has been identified as a downgrade
 * (newMaxValue < oldMaxValue) and succeeded.
 */
export interface DowngradedKey {
    /** The limit key that was downgraded. */
    readonly limitKey: string;
    /** The old maximum value before the plan change. */
    readonly oldMaxValue: number;
    /** The new (lower) maximum value after the plan change. */
    readonly newMaxValue: number;
}

/**
 * A downgraded key where current usage exceeds the new limit.
 */
export interface ExceededDowngrade extends DowngradedKey {
    /** The customer's current usage for this limit key. */
    readonly currentUsage: number;
}

// ─── Pure detection functions ─────────────────────────────────────────────────

/**
 * Detect which limit keys were downgraded in a set of recalculation results.
 *
 * A key is considered "downgraded" when the recalculation succeeded and
 * the new max value is strictly less than the old max value.
 *
 * @param recalculations - Results from the limit recalculation step.
 * @returns Array of downgraded keys (may be empty).
 *
 * @example
 * ```ts
 * const downgraded = detectDowngradedKeys({ recalculations });
 * // [{ limitKey: 'max_photos', oldMaxValue: 20, newMaxValue: 10 }]
 * ```
 */
export function detectDowngradedKeys({
    recalculations
}: {
    readonly recalculations: readonly RecalculationResult[];
}): readonly DowngradedKey[] {
    return recalculations
        .filter((r) => r.outcome === 'success' && r.newMaxValue < r.oldMaxValue)
        .map((r) => ({
            limitKey: r.limitKey,
            oldMaxValue: r.oldMaxValue,
            newMaxValue: r.newMaxValue
        }));
}

/**
 * Given a list of downgraded keys and their current usage values,
 * determine which ones have usage exceeding the new limit.
 *
 * @param downgrades - Downgraded keys from {@link detectDowngradedKeys}.
 * @param usageByKey - Map of limitKey to current usage value.
 * @returns Only the downgrades where currentUsage > newMaxValue.
 *
 * @example
 * ```ts
 * const exceeded = filterExceededDowngrades({
 *   downgrades: [{ limitKey: 'max_photos', oldMaxValue: 20, newMaxValue: 10 }],
 *   usageByKey: new Map([['max_photos', 15]]),
 * });
 * // [{ limitKey: 'max_photos', oldMaxValue: 20, newMaxValue: 10, currentUsage: 15 }]
 * ```
 */
export function filterExceededDowngrades({
    downgrades,
    usageByKey
}: {
    readonly downgrades: readonly DowngradedKey[];
    readonly usageByKey: ReadonlyMap<string, number>;
}): readonly ExceededDowngrade[] {
    const exceeded: ExceededDowngrade[] = [];

    for (const d of downgrades) {
        const currentUsage = usageByKey.get(d.limitKey);
        if (currentUsage !== undefined && currentUsage > d.newMaxValue) {
            exceeded.push({ ...d, currentUsage });
        }
    }

    return exceeded;
}
