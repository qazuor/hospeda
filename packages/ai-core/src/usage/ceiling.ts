/**
 * Cost-ceiling check for AI usage (SPEC-173 T-017).
 *
 * Compares accumulated AI spend for the current calendar month against the
 * admin-configured ceilings in `ai_settings.costCeilings`.  Throws
 * {@link AiCeilingHitError} when spend has reached or exceeded a ceiling
 * (global or per-feature), hard-stopping the call before any provider is
 * invoked.
 *
 * ## AC-4 isolation
 *
 * This module NEVER imports `@repo/db` directly.  All spend data comes from
 * `aggregateAiUsageByMonth` (via `../storage/index.js`) and all config access
 * goes through `resolveConfig` (via `../config/index.js`).
 *
 * ## Ceiling semantics
 *
 * The comparison is `>=` (at-or-over blocks).  Rationale: AC-8 states that a
 * spend equal to the ceiling value constitutes a breach — e.g. if the ceiling
 * is $200 and the cumulative spend is exactly $200, the next call should be
 * blocked so spend cannot exceed the intended limit.
 *
 * ## Per-provider ceiling
 *
 * Decision (owner-approved 2026-06-04): per-provider ceiling is OUT OF SCOPE
 * / DEFERRED for SPEC-173.  Only global and per-feature ceilings are
 * implemented here.
 * // Follow-up (SPEC-173): per-provider ceiling deferred per owner 2026-06-04.
 * // When implemented, add `aggregateAiUsageByMonth` calls filtered by
 * // `provider` and check against a new `perProviderMonthlyMicroUsd` key in
 * // `AiCostCeilingsSchema`.
 *
 * @module ai-core/usage/ceiling
 */

import type { AiFeature } from '@repo/schemas';
import { resolveConfig } from '../config/index.js';
import { AiCeilingHitError } from '../engine/errors.js';
import type { AggregateAiUsageByMonthInput } from '../storage/index.js';
import { aggregateAiUsageByMonth } from '../storage/index.js';
import { getUtcMonthRange } from './reporting/month-range.js';

// ---------------------------------------------------------------------------
// I/O shapes
// ---------------------------------------------------------------------------

/**
 * Input for {@link checkCostCeiling}.
 */
export interface CheckCostCeilingInput {
    /**
     * The AI feature being invoked.
     * Used for the per-feature ceiling lookup.
     */
    readonly feature: AiFeature;

    /**
     * The current wall-clock instant, supplied by the caller.
     *
     * **MUST be passed by parameter** — this module never calls `Date.now()` or
     * `new Date()` without args, per the repo convention that prevents
     * non-deterministic time in isolated logic.  The `apps/api` route layer
     * (T-019) is responsible for supplying `now`.
     *
     * `year` and `month` are derived from this via `getUTCFullYear()` /
     * `getUTCMonth() + 1`.
     */
    readonly now: Date;

    /**
     * Optional Drizzle transaction client forwarded to the aggregate queries.
     * When omitted the queries use `getDb()` (the module-level connection pool).
     */
    readonly tx?: AggregateAiUsageByMonthInput['tx'];
}

// ---------------------------------------------------------------------------
// checkCostCeiling
// ---------------------------------------------------------------------------

/**
 * Checks whether the current calendar-month spend has reached or exceeded
 * any configured cost ceiling (global or per-feature).
 *
 * **Returns** `void` when spend is below all applicable ceilings, or when no
 * ceilings are configured.
 *
 * **Throws** {@link AiCeilingHitError} when:
 * - Global ceiling is set AND total month spend `>= globalMonthlyMicroUsd`.
 * - Per-feature ceiling is set for `feature` AND that feature's month spend
 *   `>= perFeatureMonthlyMicroUsd[feature]`.
 *
 * The global check runs first; if it throws, the per-feature check is skipped.
 *
 * @param input - {@link CheckCostCeilingInput}
 * @returns `Promise<void>` — resolves silently when no ceiling is breached.
 * @throws {AiCeilingHitError} When a ceiling is at-or-over the configured value.
 *
 * @example
 * ```ts
 * // In the engine checkCeiling hook (T-019 wiring):
 * await checkCostCeiling({ feature: 'chat', now: requestTimestamp });
 * // ^ throws AiCeilingHitError if the ceiling is hit; otherwise resolves.
 * ```
 */
export async function checkCostCeiling(input: CheckCostCeilingInput): Promise<void> {
    const { feature, now, tx } = input;

    // 1. Resolve config (uses in-memory TTL cache — fast path is a sync return).
    const config = await resolveConfig();

    // 2. No ceilings configured → nothing to check, allow the call.
    if (config.costCeilings === undefined || config.costCeilings === null) {
        return;
    }

    const { costCeilings } = config;

    // 3. Derive the current calendar-month boundaries from the supplied `now`.
    //    `getUTCMonth()` returns 0-based (0 = Jan), so add 1 for 1-based month.
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const { monthStart, monthEnd } = getUtcMonthRange({ year, month });

    // 4. GLOBAL ceiling check.
    //    Comparison is >= (at-or-over blocks) per AC-8 boundary decision above.
    if (costCeilings.globalMonthlyMicroUsd !== undefined) {
        const globalRows = await aggregateAiUsageByMonth({
            since: monthStart,
            until: monthEnd,
            tx
        });

        // Sum defensively across the returned rows — should be a single row for
        // the current month, but we aggregate in case of edge-case duplicates.
        const globalSpent = globalRows.reduce((acc, row) => acc + row.costMicroUsd, 0);
        const globalCeiling = costCeilings.globalMonthlyMicroUsd;

        if (globalSpent >= globalCeiling) {
            throw new AiCeilingHitError({
                scope: 'global',
                spentMicroUsd: globalSpent,
                ceilingMicroUsd: globalCeiling
            });
        }
    }

    // 5. PER-FEATURE ceiling check.
    //    Only runs when `perFeatureMonthlyMicroUsd` has an entry for this feature.
    const featureCeiling = costCeilings.perFeatureMonthlyMicroUsd?.[feature];
    if (featureCeiling !== undefined) {
        const featureRows = await aggregateAiUsageByMonth({
            since: monthStart,
            until: monthEnd,
            feature,
            tx
        });

        const featureSpent = featureRows.reduce((acc, row) => acc + row.costMicroUsd, 0);

        if (featureSpent >= featureCeiling) {
            throw new AiCeilingHitError({
                scope: 'feature',
                feature,
                spentMicroUsd: featureSpent,
                ceilingMicroUsd: featureCeiling
            });
        }
    }
}
