/**
 * UTC calendar-month boundary helpers (SPEC-173 T-018).
 *
 * Decision (owner-approved 2026-06-04): the "month" period for all AI usage
 * reporting is **calendar-month UTC** — the window `[monthStart, monthEnd)`
 * where `monthStart` is `Date.UTC(year, month - 1, 1, 0, 0, 0, 0)` and
 * `monthEnd` is the first instant of the following month.  This matches the
 * existing repo precedent (conversation.model monthly stats, cron_runs) and
 * is NOT the billing-cycle anniversary.
 *
 * Note on "current month": this module does NOT use `Date.now()` / `new Date()`
 * to derive the current calendar month.  The caller (route or service) is
 * responsible for supplying `year` and `month` from the request context,
 * which keeps this module pure and deterministic for tests.
 *
 * @module ai-core/usage/reporting/month-range
 */

// ---------------------------------------------------------------------------
// GetUtcMonthRangeInput / UtcMonthRange
// ---------------------------------------------------------------------------

/**
 * Input for {@link getUtcMonthRange}.
 */
export interface GetUtcMonthRangeInput {
    /**
     * The 4-digit calendar year (e.g. `2026`).
     */
    readonly year: number;
    /**
     * The 1-based calendar month (1 = January … 12 = December).
     */
    readonly month: number;
}

/**
 * Half-open UTC calendar-month boundary pair.
 *
 * `monthStart` is included (`gte`), `monthEnd` is excluded (`lt`).
 *
 * Decision (owner-approved 2026-06-04): calendar-month UTC, NOT billing cycle.
 */
export interface UtcMonthRange {
    /** First instant of the target month in UTC (inclusive). */
    readonly monthStart: Date;
    /** First instant of the following month in UTC (exclusive). */
    readonly monthEnd: Date;
}

// ---------------------------------------------------------------------------
// getUtcMonthRange
// ---------------------------------------------------------------------------

/**
 * Computes the half-open UTC calendar-month boundary `[monthStart, monthEnd)`
 * for the given `year` and `month`.
 *
 * `monthStart` is the first millisecond of the first day of the month (UTC).
 * `monthEnd` is the first millisecond of the first day of the **next** month
 * (UTC), handling year rollovers correctly (December → January of year+1).
 *
 * Decision (owner-approved 2026-06-04): all AI usage reporting uses
 * calendar-month UTC boundaries, matching the repo precedent in
 * `conversation.model.ts`. NOT the billing-cycle anniversary.
 *
 * @param input - {@link GetUtcMonthRangeInput}
 * @returns {@link UtcMonthRange} with half-open `[monthStart, monthEnd)` dates.
 *
 * @throws {RangeError} When `year` is not a positive integer or `month` is
 *   outside `[1, 12]`.
 *
 * @example
 * ```ts
 * getUtcMonthRange({ year: 2026, month: 6 })
 * // { monthStart: 2026-06-01T00:00:00.000Z, monthEnd: 2026-07-01T00:00:00.000Z }
 *
 * getUtcMonthRange({ year: 2026, month: 12 })
 * // { monthStart: 2026-12-01T00:00:00.000Z, monthEnd: 2027-01-01T00:00:00.000Z }
 * ```
 */
export function getUtcMonthRange(input: GetUtcMonthRangeInput): UtcMonthRange {
    const { year, month } = input;

    if (!Number.isInteger(year) || year <= 0) {
        throw new RangeError(`year must be a positive integer, got ${year}`);
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new RangeError(`month must be an integer in [1, 12], got ${month}`);
    }

    // Date.UTC uses 0-based month index.
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));

    // Adding 1 to the 0-based month index handles December → January correctly:
    // Date.UTC(2026, 12, 1) → 2027-01-01T00:00:00Z (JS normalises overflow).
    const monthEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    return { monthStart, monthEnd };
}
