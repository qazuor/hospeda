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

import type { AiUsageByFeatureRow, AiUsageByUserRow, AiUsageMonthlyRow } from '@repo/schemas';
import {
    aggregateAiUsageByFeature,
    aggregateAiUsageByMonth,
    aggregateAiUsageByUser
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
