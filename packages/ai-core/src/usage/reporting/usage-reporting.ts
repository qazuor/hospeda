/**
 * Public AI usage reporting orchestration (SPEC-173 T-018).
 *
 * This module provides the public API for usage reporting.  It calls storage
 * query helpers (via `../../storage/index.js`) and returns rows validated
 * against `@repo/schemas` aggregate types.
 *
 * AC-4 isolation: this module NEVER imports `@repo/db` or any Drizzle types
 * directly.  All database access flows through the storage layer.
 *
 * Decision (owner-approved 2026-06-04): the "month" period is calendar-month
 * UTC.  The `year` and `month` parameters are supplied by the caller (route /
 * admin service) — this module does NOT read `Date.now()` to derive the
 * current calendar month.
 *
 * @module ai-core/usage/reporting/usage-reporting
 */

import type {
    AiUsageByFeatureModelRow,
    AiUsageByFeatureRow,
    AiUsageByModelRow,
    AiUsageByProviderRow,
    AiUsageByUserRow,
    AiUsageDailyRow,
    AiUsageMonthlyRow
} from '@repo/schemas';
import {
    aggregateAiUsageByFeature,
    aggregateAiUsageByFeatureModel,
    aggregateAiUsageByModel,
    aggregateAiUsageByMonth,
    aggregateAiUsageByProvider,
    aggregateAiUsageByUser,
    aggregateAiUsageDaily
} from '../../storage/index.js';
import { getUtcMonthRange } from './month-range.js';

// ---------------------------------------------------------------------------
// getMonthlyUsage
// ---------------------------------------------------------------------------

/**
 * Input for {@link getMonthlyUsage}.
 */
export interface GetMonthlyUsageInput {
    /**
     * Inclusive start date for the query window.
     * When omitted, the query covers all rows up to `until` (or all rows).
     */
    readonly since?: Date;
    /**
     * Exclusive end date for the query window.
     * When omitted, the query covers all rows from `since` (or all rows).
     */
    readonly until?: Date;
    /**
     * Narrow results to a specific user.
     * When omitted, aggregates across all users.
     */
    readonly userId?: string;
    /**
     * Narrow results to a specific AI feature (e.g. `'text_improve'`).
     * When omitted, aggregates across all features.
     */
    readonly feature?: string;
}

/**
 * Returns AI usage aggregated by calendar month (UTC).
 *
 * Each row in the result covers one calendar month and includes totals for
 * calls, prompt tokens, completion tokens, and cost (integer µUSD).
 *
 * Months with zero activity are NOT included — the caller is responsible for
 * filling gaps for chart rendering.
 *
 * Decision (owner-approved 2026-06-04): bucketing is calendar-month UTC,
 * NOT the billing-cycle anniversary.
 *
 * @param input - {@link GetMonthlyUsageInput}
 * @returns Immutable array of {@link AiUsageMonthlyRow} ordered by month ASC.
 *
 * @example
 * ```ts
 * const rows = await getMonthlyUsage({
 *   since: new Date('2026-01-01T00:00:00Z'),
 *   until: new Date('2026-07-01T00:00:00Z'),
 * });
 * // [{ month: '2026-01', calls: 5, tokensIn: 1200, tokensOut: 600, costMicroUsd: 400 }, ...]
 * ```
 */
export async function getMonthlyUsage(
    input: GetMonthlyUsageInput
): Promise<readonly AiUsageMonthlyRow[]> {
    const rows = await aggregateAiUsageByMonth(input);
    return rows as readonly AiUsageMonthlyRow[];
}

// ---------------------------------------------------------------------------
// getUsageByUser
// ---------------------------------------------------------------------------

/**
 * Input for {@link getUsageByUser}.
 */
export interface GetUsageByUserInput {
    /**
     * The 4-digit calendar year (e.g. `2026`).
     */
    readonly year: number;
    /**
     * The 1-based calendar month (1 = January … 12 = December).
     */
    readonly month: number;
    /**
     * Narrow results to a specific AI feature.
     * When omitted, aggregates across all features.
     */
    readonly feature?: string;
}

/**
 * Returns AI usage aggregated by user for the given calendar month (UTC).
 *
 * The month window is computed as the half-open range `[monthStart, monthEnd)`
 * using UTC calendar boundaries.  Rows with `userId: null` represent
 * anonymised usage from deleted users.
 *
 * Decision (owner-approved 2026-06-04): the `year`/`month` parameters specify
 * a calendar-month UTC window — the caller (route/admin service) supplies
 * these values from the request context.
 *
 * @param input - {@link GetUsageByUserInput}
 * @returns Immutable array of {@link AiUsageByUserRow} ordered by calls DESC.
 *
 * @example
 * ```ts
 * const rows = await getUsageByUser({ year: 2026, month: 6 });
 * // [{ userId: 'abc...', calls: 50, tokensIn: 10000, ... }, { userId: null, calls: 2, ... }]
 * ```
 */
export async function getUsageByUser(
    input: GetUsageByUserInput
): Promise<readonly AiUsageByUserRow[]> {
    const { year, month, feature } = input;
    const { monthStart, monthEnd } = getUtcMonthRange({ year, month });

    const rows = await aggregateAiUsageByUser({ monthStart, monthEnd, feature });
    return rows as readonly AiUsageByUserRow[];
}

// ---------------------------------------------------------------------------
// getUsageByFeature
// ---------------------------------------------------------------------------

/**
 * Input for {@link getUsageByFeature}.
 */
export interface GetUsageByFeatureInput {
    /**
     * The 4-digit calendar year (e.g. `2026`).
     */
    readonly year: number;
    /**
     * The 1-based calendar month (1 = January … 12 = December).
     */
    readonly month: number;
    /**
     * Narrow results to a specific user.
     * When omitted, aggregates across all users.
     */
    readonly userId?: string;
}

/**
 * Returns AI usage aggregated by feature for the given calendar month (UTC).
 *
 * The month window is computed as the half-open range `[monthStart, monthEnd)`
 * using UTC calendar boundaries.
 *
 * Decision (owner-approved 2026-06-04): the `year`/`month` parameters specify
 * a calendar-month UTC window — the caller (route/admin service) supplies
 * these values from the request context.
 *
 * @param input - {@link GetUsageByFeatureInput}
 * @returns Immutable array of {@link AiUsageByFeatureRow} ordered by calls DESC.
 *
 * @example
 * ```ts
 * const rows = await getUsageByFeature({ year: 2026, month: 6 });
 * // [{ feature: 'chat', calls: 100, tokensIn: 20000, tokensOut: 8000, costMicroUsd: 5000 }]
 * ```
 */
export async function getUsageByFeature(
    input: GetUsageByFeatureInput
): Promise<readonly AiUsageByFeatureRow[]> {
    const { year, month, userId } = input;
    const { monthStart, monthEnd } = getUtcMonthRange({ year, month });

    const rows = await aggregateAiUsageByFeature({ monthStart, monthEnd, userId });
    return rows as readonly AiUsageByFeatureRow[];
}

// ---------------------------------------------------------------------------
// getUsageByModel (SPEC-260 T-008)
// ---------------------------------------------------------------------------

/**
 * Input for {@link getUsageByModel}.
 */
export interface GetUsageByModelInput {
    /**
     * The 4-digit calendar year (e.g. `2026`).
     * Provide `year` + `month` OR explicit `since`/`until` — not both.
     */
    readonly year?: number;
    /**
     * The 1-based calendar month (1 = January … 12 = December).
     * Provide `year` + `month` OR explicit `since`/`until` — not both.
     */
    readonly month?: number;
    /**
     * Explicit inclusive start date for the query window.
     * Used when `year`/`month` are not provided.
     */
    readonly since?: Date;
    /**
     * Explicit exclusive end date for the query window.
     * Used when `year`/`month` are not provided.
     */
    readonly until?: Date;
    /**
     * Narrow results to a specific AI feature.
     * When omitted, aggregates across all features.
     */
    readonly feature?: string;
    /**
     * Narrow results to a specific AI provider.
     * When omitted, aggregates across all providers.
     */
    readonly provider?: string;
}

/**
 * Returns AI usage aggregated by model for the given window.
 *
 * When `year` and `month` are given, the window is the half-open UTC calendar
 * month `[monthStart, monthEnd)`.  When `since`/`until` are given directly,
 * those dates are used as-is.  The two modes are mutually exclusive — the
 * caller should provide one or the other.
 *
 * Decision (SPEC-260): the AC-4 isolation rule requires that storage is
 * storage-agnostic here — all DB access flows through `aggregateAiUsageByModel`.
 *
 * @param input - {@link GetUsageByModelInput}
 * @returns Immutable array of {@link AiUsageByModelRow} ordered by cost DESC.
 *
 * @example
 * ```ts
 * const rows = await getUsageByModel({ year: 2026, month: 6 });
 * // [{ model: 'gpt-4o-mini', calls: 120, tokensIn: 240000, tokensOut: 90000, costMicroUsd: 90000 }]
 * ```
 */
export async function getUsageByModel(
    input: GetUsageByModelInput
): Promise<readonly AiUsageByModelRow[]> {
    const resolvedWindow = resolveWindow(input);
    const rows = await aggregateAiUsageByModel({
        ...resolvedWindow,
        feature: input.feature,
        provider: input.provider
    });
    return rows as readonly AiUsageByModelRow[];
}

// ---------------------------------------------------------------------------
// getUsageByProvider (SPEC-260 T-008)
// ---------------------------------------------------------------------------

/**
 * Input for {@link getUsageByProvider}.
 */
export interface GetUsageByProviderInput {
    /**
     * The 4-digit calendar year (e.g. `2026`).
     * Provide `year` + `month` OR explicit `since`/`until` — not both.
     */
    readonly year?: number;
    /**
     * The 1-based calendar month (1 = January … 12 = December).
     * Provide `year` + `month` OR explicit `since`/`until` — not both.
     */
    readonly month?: number;
    /**
     * Explicit inclusive start date for the query window.
     * Used when `year`/`month` are not provided.
     */
    readonly since?: Date;
    /**
     * Explicit exclusive end date for the query window.
     * Used when `year`/`month` are not provided.
     */
    readonly until?: Date;
    /**
     * Narrow results to a specific AI feature.
     * When omitted, aggregates across all features.
     */
    readonly feature?: string;
}

/**
 * Returns AI usage aggregated by provider for the given window.
 *
 * When `year` and `month` are given, the window is the half-open UTC calendar
 * month `[monthStart, monthEnd)`.  When `since`/`until` are given directly,
 * those dates are used as-is.
 *
 * @param input - {@link GetUsageByProviderInput}
 * @returns Immutable array of {@link AiUsageByProviderRow} ordered by cost DESC.
 *
 * @example
 * ```ts
 * const rows = await getUsageByProvider({ year: 2026, month: 6 });
 * // [{ provider: 'openai', calls: 200, tokensIn: 40000, tokensOut: 15000, costMicroUsd: 12000 }]
 * ```
 */
export async function getUsageByProvider(
    input: GetUsageByProviderInput
): Promise<readonly AiUsageByProviderRow[]> {
    const resolvedWindow = resolveWindow(input);
    const rows = await aggregateAiUsageByProvider({
        ...resolvedWindow,
        feature: input.feature
    });
    return rows as readonly AiUsageByProviderRow[];
}

// ---------------------------------------------------------------------------
// getUsageByFeatureModel (SPEC-260 T-008)
// ---------------------------------------------------------------------------

/**
 * Input for {@link getUsageByFeatureModel}.
 */
export interface GetUsageByFeatureModelInput {
    /**
     * The 4-digit calendar year (e.g. `2026`).
     * Provide `year` + `month` OR explicit `since`/`until` — not both.
     */
    readonly year?: number;
    /**
     * The 1-based calendar month (1 = January … 12 = December).
     * Provide `year` + `month` OR explicit `since`/`until` — not both.
     */
    readonly month?: number;
    /**
     * Explicit inclusive start date for the query window.
     * Used when `year`/`month` are not provided.
     */
    readonly since?: Date;
    /**
     * Explicit exclusive end date for the query window.
     * Used when `year`/`month` are not provided.
     */
    readonly until?: Date;
}

/**
 * Returns AI usage aggregated by feature × model cross for the given window.
 *
 * Each row represents one unique `(feature, model)` combination present in
 * the window, enabling direct cost comparison of models within a feature.
 *
 * When `year` and `month` are given, the window is the half-open UTC calendar
 * month `[monthStart, monthEnd)`.  When `since`/`until` are given directly,
 * those dates are used as-is.
 *
 * @param input - {@link GetUsageByFeatureModelInput}
 * @returns Immutable array of {@link AiUsageByFeatureModelRow} ordered by
 *   feature ASC then cost DESC.
 *
 * @example
 * ```ts
 * const rows = await getUsageByFeatureModel({ year: 2026, month: 6 });
 * // [{ feature: 'chat', model: 'gpt-4o-mini', calls: 120, ... }]
 * ```
 */
export async function getUsageByFeatureModel(
    input: GetUsageByFeatureModelInput
): Promise<readonly AiUsageByFeatureModelRow[]> {
    const resolvedWindow = resolveWindow(input);
    const rows = await aggregateAiUsageByFeatureModel(resolvedWindow);
    return rows as readonly AiUsageByFeatureModelRow[];
}

// ---------------------------------------------------------------------------
// getDailyUsage (SPEC-260 T-008)
// ---------------------------------------------------------------------------

/**
 * Input for {@link getDailyUsage}.
 */
export interface GetDailyUsageInput {
    /**
     * The 4-digit calendar year (e.g. `2026`).
     * Provide `year` + `month` OR explicit `since`/`until` — not both.
     */
    readonly year?: number;
    /**
     * The 1-based calendar month (1 = January … 12 = December).
     * Provide `year` + `month` OR explicit `since`/`until` — not both.
     */
    readonly month?: number;
    /**
     * Explicit inclusive start date for the query window.
     * Used when `year`/`month` are not provided.
     */
    readonly since?: Date;
    /**
     * Explicit exclusive end date for the query window.
     * Used when `year`/`month` are not provided.
     */
    readonly until?: Date;
    /**
     * Narrow results to a specific AI feature.
     * When omitted, aggregates across all features.
     */
    readonly feature?: string;
    /**
     * Narrow results to a specific AI model.
     * When omitted, aggregates across all models.
     */
    readonly model?: string;
    /**
     * Narrow results to a specific AI provider.
     * When omitted, aggregates across all providers.
     */
    readonly provider?: string;
}

/**
 * Returns AI usage aggregated by UTC calendar day for the given window.
 *
 * **Daily zero-fill (AC-3.3):** the storage layer only returns days that have
 * at least one row.  This wrapper fills every UTC day within the resolved
 * window that is absent from the storage result with a zero row, so callers
 * always receive a **continuous day series** — no gaps.
 *
 * UTC off-by-one guard: the window boundaries are resolved exclusively via
 * {@link getUtcMonthRange} (when `year`+`month` is given) or the caller's
 * explicit `since`/`until` dates.  `since` is inclusive, `until` is exclusive.
 * Day iteration uses the same UTC epoch arithmetic as `getUtcMonthRange` to
 * avoid boundary confusion.
 *
 * When `year` and `month` are given, the window is the half-open UTC calendar
 * month `[monthStart, monthEnd)`.  When `since`/`until` are given directly,
 * those dates are used as-is.
 *
 * @param input - {@link GetDailyUsageInput}
 * @returns Immutable array of {@link AiUsageDailyRow} ordered by day ASC
 *   (`YYYY-MM-DD`), with zero rows inserted for any day with no activity.
 *
 * @example
 * ```ts
 * const rows = await getDailyUsage({ year: 2026, month: 6 });
 * // 30 rows — one per day in June 2026, zeros where no calls occurred.
 * ```
 */
export async function getDailyUsage(
    input: GetDailyUsageInput
): Promise<readonly AiUsageDailyRow[]> {
    const resolvedWindow = resolveWindow(input);
    const storageRows = await aggregateAiUsageDaily({
        ...resolvedWindow,
        feature: input.feature,
        model: input.model,
        provider: input.provider
    });

    // Build a lookup map from day string to storage row for O(1) access.
    const rowByDay = new Map<string, (typeof storageRows)[number]>();
    for (const row of storageRows) {
        rowByDay.set(row.day, row);
    }

    // Zero-fill: iterate every UTC day in [since, until) and emit a zero row
    // for any day that the storage layer did not return.
    //
    // UTC off-by-one safety: we advance by exactly 86,400,000 ms per day
    // (milliseconds in one day) using epoch arithmetic, matching the UTC day
    // boundary the DB uses for date_trunc('day', ...).  This avoids DST
    // ambiguity because Date.UTC always operates in UTC.
    const result: AiUsageDailyRow[] = [];

    if (resolvedWindow.since !== undefined && resolvedWindow.until !== undefined) {
        const MS_PER_DAY = 86_400_000;
        // Truncate since to UTC midnight to align with date_trunc('day', ...)
        const sinceEpoch = resolvedWindow.since.getTime();
        // Align to the UTC day start (floor to midnight)
        const sinceDayStart = sinceEpoch - (sinceEpoch % MS_PER_DAY);
        const untilEpoch = resolvedWindow.until.getTime();

        for (let dayEpoch = sinceDayStart; dayEpoch < untilEpoch; dayEpoch += MS_PER_DAY) {
            const dayDate = new Date(dayEpoch);
            // Format as YYYY-MM-DD in UTC to match DB to_char output
            const day = formatUtcDay(dayDate);
            const stored = rowByDay.get(day);
            result.push(
                stored ?? {
                    day,
                    calls: 0,
                    tokensIn: 0,
                    tokensOut: 0,
                    costMicroUsd: 0
                }
            );
        }
    } else {
        // No window bounds: return storage rows as-is (cannot zero-fill without bounds)
        for (const row of storageRows) {
            result.push(row as AiUsageDailyRow);
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolved query window with optional `since` / `until` Date boundaries.
 * @internal
 */
interface ResolvedWindow {
    readonly since?: Date;
    readonly until?: Date;
}

/**
 * Resolves a query window from either `year`+`month` (calendar-month UTC) or
 * explicit `since`/`until` dates.
 *
 * When `year` and `month` are both provided, delegates to `getUtcMonthRange`
 * and returns `{ since: monthStart, until: monthEnd }`.
 * Otherwise, passes `since`/`until` through unchanged.
 *
 * @internal
 */
function resolveWindow(input: {
    readonly year?: number;
    readonly month?: number;
    readonly since?: Date;
    readonly until?: Date;
}): ResolvedWindow {
    if (input.year !== undefined && input.month !== undefined) {
        const { monthStart, monthEnd } = getUtcMonthRange({
            year: input.year,
            month: input.month
        });
        return { since: monthStart, until: monthEnd };
    }
    return { since: input.since, until: input.until };
}

/**
 * Formats a Date as `'YYYY-MM-DD'` using UTC date components.
 *
 * Matches the output of `to_char(date_trunc('day', created_at), 'YYYY-MM-DD')`
 * in PostgreSQL (which truncates to UTC midnight when the column has time zone).
 *
 * @internal
 */
function formatUtcDay(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
