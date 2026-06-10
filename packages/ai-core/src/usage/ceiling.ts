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
 * Input payload delivered to {@link ThresholdAlertHook} when a cost band is crossed.
 *
 * Decision (owner-approved 2026-06-04): ai-core declares only the hook TYPE and
 * invokes it; the send/de-dup implementation lives in `apps/api`.
 */
export interface ThresholdAlertInput {
    /** Whether this alert is for the global spend or a specific feature. */
    readonly scope: 'global' | 'feature';
    /**
     * The AI feature that crossed the threshold.
     * Only set when `scope === 'feature'`.
     */
    readonly feature?: AiFeature;
    /** The cost band that was crossed (50%, 80%, or 100%). */
    readonly thresholdPct: 50 | 80 | 100;
    /** Accumulated spend for the current calendar month, in micro-USD. */
    readonly spentMicroUsd: number;
    /** Configured ceiling value, in micro-USD. */
    readonly ceilingMicroUsd: number;
    /**
     * Calendar month identifier in `YYYY-MM` format (UTC).
     *
     * @example `'2026-06'`
     */
    readonly period: string;
}

/**
 * Fire-and-forget hook invoked whenever a cost band (50 / 80 / 100 %) is crossed.
 *
 * **Contract:** this function MUST NOT throw.  Any async work (DB writes, email
 * sends) should be enqueued internally and errors swallowed at the call site.
 * The engine calls this hook without `await`, so a rejection would be an
 * unhandled promise rejection — violating the fire-and-forget contract.
 */
export type ThresholdAlertHook = (input: ThresholdAlertInput) => void;

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

    /**
     * Optional fire-and-forget hook invoked whenever a cost band (50 / 80 / 100 %)
     * is crossed.
     *
     * ai-core fires the hook at the point of detection; de-duplication (once per
     * calendar month) is the responsibility of the `apps/api` factory
     * (`createAiCostThresholdAlertHook`).
     *
     * The hook is called WITHOUT `await` — it must not throw.  If the hook needs
     * async work (DB writes, email delivery) it must enqueue that work internally.
     *
     * Decision (owner-approved 2026-06-04): ai-core MUST NOT import
     * `@repo/notifications` (transitive `@repo/db` pull).  Only this type and
     * the invocation live here.
     *
     * @example
     * ```ts
     * await checkCostCeiling({
     *   feature: 'chat',
     *   now: requestTimestamp,
     *   onThresholdAlert: createAiCostThresholdAlertHook()
     * });
     * ```
     */
    readonly onThresholdAlert?: ThresholdAlertHook;
}

// ---------------------------------------------------------------------------
// checkCostCeiling
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Derives the highest cost band crossed given the ratio of spend to ceiling.
 *
 * Returns `null` when the ratio is below 50%, meaning no alert band is crossed.
 *
 * @param spent - Accumulated spend in micro-USD.
 * @param ceiling - Configured ceiling in micro-USD.
 * @returns The highest crossed band (50 | 80 | 100), or `null` if below 50 %.
 */
function deriveCrossedBand(spent: number, ceiling: number): 50 | 80 | 100 | null {
    // Zero (or negative) ceiling: a ceiling of 0 hard-stops every call via the
    // `spent >= ceiling` check in checkCostCeiling (0 >= 0 is always true, even
    // with zero spend).  Return null here so no spurious alert band is derived —
    // the hard-stop is the right outcome, not a percentage alert.
    if (ceiling <= 0) {
        return null;
    }
    const pct = spent / ceiling;
    if (pct >= 1.0) return 100;
    if (pct >= 0.8) return 80;
    if (pct >= 0.5) return 50;
    return null;
}

/**
 * Fires the threshold-alert hook when a cost band is crossed.
 *
 * The hook is called WITHOUT `await` (fire-and-forget).  Any rejection is an
 * unhandled promise — the hook contract prohibits throwing.
 *
 * @param hook - The alert hook to invoke.
 * @param alertInput - Data describing the crossed threshold.
 */
function fireThresholdAlert(hook: ThresholdAlertHook, alertInput: ThresholdAlertInput): void {
    hook(alertInput);
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
 * When `onThresholdAlert` is provided, the hook is called (fire-and-forget)
 * for the highest cost band crossed (50 / 80 / 100 %).  For the 100 % band the
 * hook fires immediately BEFORE the hard-stop throw so the alert is always
 * delivered even though the call is then blocked.  De-duplication (once per
 * calendar month per threshold) is the responsibility of the hook implementation.
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
 *
 * // With threshold alerts:
 * await checkCostCeiling({
 *   feature: 'chat',
 *   now: requestTimestamp,
 *   onThresholdAlert: createAiCostThresholdAlertHook()
 * });
 * ```
 */
export async function checkCostCeiling(input: CheckCostCeilingInput): Promise<void> {
    const { feature, now, tx, onThresholdAlert } = input;

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
    // Build the period string once — shared by both scope checks below.
    const period = `${String(year)}-${String(month).padStart(2, '0')}`;

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

        // Fire threshold alert before the hard stop so the 100% alert is always sent.
        if (onThresholdAlert !== undefined) {
            const band = deriveCrossedBand(globalSpent, globalCeiling);
            if (band !== null) {
                fireThresholdAlert(onThresholdAlert, {
                    scope: 'global',
                    thresholdPct: band,
                    spentMicroUsd: globalSpent,
                    ceilingMicroUsd: globalCeiling,
                    period
                });
            }
        }

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

        // Fire threshold alert before the hard stop so the 100% alert is always sent.
        if (onThresholdAlert !== undefined) {
            const band = deriveCrossedBand(featureSpent, featureCeiling);
            if (band !== null) {
                fireThresholdAlert(onThresholdAlert, {
                    scope: 'feature',
                    feature,
                    thresholdPct: band,
                    spentMicroUsd: featureSpent,
                    ceilingMicroUsd: featureCeiling,
                    period
                });
            }
        }

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
