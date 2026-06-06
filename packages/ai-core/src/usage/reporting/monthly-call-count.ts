/**
 * Monthly AI call-count helper for quota enforcement (SPEC-173 T-031).
 *
 * Provides a thin RO-RO wrapper that resolves the current UTC calendar-month
 * range from a supplied `now` value and delegates the actual count query to
 * `countAiUsageForUserFeatureMonth` in the storage layer.
 *
 * **AC-4 compliance**: this module NEVER imports `@repo/db` directly. All DB
 * access is delegated to the `storage/` layer which is the ONLY sub-module
 * permitted to import `@repo/db`.
 *
 * **Quota counting decision (owner-approved T-031)**: only calls that
 * _delivered value_ count against a user's monthly quota.  Specifically,
 * only rows with `status IN ('success', 'fallback')` are counted:
 *
 * - `'success'`   — the primary provider responded; value was delivered.
 * - `'fallback'`  — a backup provider responded; value was still delivered.
 * - `'error'`     — the provider call failed; no value delivered → excluded.
 * - `'quota_exceeded'` — rejected before the call; no value delivered → excluded.
 * - `'ceiling_hit'`    — rejected before the call; no value delivered → excluded.
 * - `'kill_switch'`    — rejected before the call; no value delivered → excluded.
 *
 * Excluding failed/rejected rows means that transient provider errors and
 * quota-rejected attempts do NOT consume the user's monthly allowance.
 *
 * @module ai-core/usage/reporting/monthly-call-count
 */

import { countAiUsageForUserFeatureMonth } from '../../storage/index.js';
import { getUtcMonthRange } from './month-range.js';

// ---------------------------------------------------------------------------
// QUOTA_COUNT_STATUSES
// ---------------------------------------------------------------------------

/**
 * The `status` values that count against a user's monthly AI quota.
 *
 * Decision (owner-approved T-031): only successful deliveries consume quota.
 * Provider errors and rejected attempts are excluded. See module JSDoc for the
 * full rationale.
 */
const QUOTA_COUNT_STATUSES: readonly string[] = ['success', 'fallback'] as const;

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

/**
 * Input for {@link getMonthlyCallCount}.
 */
export interface GetMonthlyCallCountInput {
    /**
     * UUID of the authenticated user whose monthly usage is being counted.
     */
    readonly userId: string;
    /**
     * AI feature to count (e.g. `'text_improve'`, `'chat'`, `'search'`,
     * `'support'`).
     */
    readonly feature: string;
    /**
     * The reference instant used to determine the current calendar month (UTC).
     * Callers MUST pass `new Date()` in production; tests may pass a fixed date
     * for deterministic results.
     */
    readonly now: Date;
}

// ---------------------------------------------------------------------------
// getMonthlyCallCount
// ---------------------------------------------------------------------------

/**
 * Returns the number of AI calls that delivered value for a given user and
 * feature during the current UTC calendar month.
 *
 * "Delivered value" means `status IN ('success', 'fallback')`.  Provider
 * errors and rejected attempts (`quota_exceeded`, `ceiling_hit`,
 * `kill_switch`) are excluded — they do NOT count against quota.
 *
 * The calendar month is derived from `now` using {@link getUtcMonthRange},
 * which matches the repo convention (calendar-month UTC, NOT billing-cycle
 * anniversary).
 *
 * @param input - {@link GetMonthlyCallCountInput}
 * @returns The number of quota-consuming calls in the current month (≥ 0).
 *
 * @example
 * ```ts
 * const count = await getMonthlyCallCount({
 *   userId: 'abc-123',
 *   feature: 'text_improve',
 *   now: new Date(),
 * });
 * // count === 7  →  user has made 7 text_improve calls this month
 * ```
 */
export async function getMonthlyCallCount(input: GetMonthlyCallCountInput): Promise<number> {
    const { userId, feature, now } = input;

    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1; // getUTCMonth() is 0-based

    const { monthStart, monthEnd } = getUtcMonthRange({ year, month });

    return countAiUsageForUserFeatureMonth({
        userId,
        feature,
        monthStart,
        monthEnd,
        statuses: QUOTA_COUNT_STATUSES
    });
}
