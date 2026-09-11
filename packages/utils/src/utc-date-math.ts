/**
 * Calendar arithmetic on UTC instants — adding months and years to a moment
 * without the answer depending on where the process happens to run.
 * @module utils/utc-date-math
 *
 * WHY THIS MODULE EXISTS
 *
 * `Date`'s month arithmetic reads and writes in the process's LOCAL timezone.
 * Every `timestamp` column in this repo is `timestamptz` (397 of them, without
 * exception), so Drizzle always hands back a `Date` that is a UTC instant.
 * Feeding one to `setMonth(getMonth() + n)` therefore asks a UTC value what
 * month it is in Buenos Aires — and `2026-11-01T00:00:00.000Z` answers
 * "October", because locally it is the 31st at 21:00.
 *
 * Measured on `courtesy-grant.calc.ts` before this module existed
 * (HOS-1010, under `TZ=America/Argentina/Buenos_Aires`):
 *
 *   2026-02-01 + 1 month => 2026-03-04   (three days too many)
 *   2026-03-01 + 1 month => 2026-03-29   (three days too few)
 *
 * Both are correct under `TZ=UTC`. That is the whole trap: production and CI
 * run on Alpine with no `TZ` set, so they are UTC and never see it, while a
 * developer machine in Argentina computes something else from the same row.
 *
 * HOW THIS MODULE DIFFERS FROM `calendar-date`
 *
 * `calendar-date` is about values that name a DAY with no time of day, and it
 * says so: do not use it for a real instant. This module is the mirror image —
 * it operates on instants that DO have a time of day (a period end, a charge
 * date) and preserves that time exactly, moving only the calendar month. Use
 * `calendar-date` to render a day; use this to do arithmetic on a moment.
 */

/**
 * What to do when the source day does not exist in the target month —
 * 31 January plus one month, or 29 February plus one year.
 *
 * There is no universally right answer, which is why this is a required
 * argument rather than a default: the caller has to state which rule its
 * domain follows, in writing, at the call site.
 *
 * - `'clamp'` — land on the last day that exists in the target month.
 *   31 January + 1 month = 28 February (29 in a leap year).
 * - `'overflow'` — let the surplus days run into the next month, which is what
 *   bare `Date` does. 31 January + 1 month = 3 March.
 */
export type DayOverflowRule = 'clamp' | 'overflow';

/** Input for {@link addCalendarMonths}. */
export interface AddCalendarMonthsInput {
    /** The instant to move. Not mutated. */
    readonly from: Date;
    /** Months to add. May be negative; zero returns an equal instant. */
    readonly months: number;
    /** Which rule applies when the day does not exist in the target month. */
    readonly dayOverflow: DayOverflowRule;
}

/**
 * Adds calendar months to an instant, in UTC, with an explicit overflow rule.
 *
 * The time of day is carried across untouched (in UTC), so an instant at
 * 14:32:05.123Z stays at 14:32:05.123Z — only the calendar month moves. The
 * result is identical in every process timezone, which is the point.
 *
 * @param input - {@link AddCalendarMonthsInput}.
 * @returns A new `Date`. Returns an `Invalid Date` if `from` is invalid, rather
 *          than silently substituting the current time.
 *
 * @example
 * ```ts
 * // The case that has no single right answer — state which rule you follow:
 * addCalendarMonths({ from: new Date('2026-01-31T00:00:00Z'), months: 1, dayOverflow: 'clamp' });
 * // 2026-02-28T00:00:00.000Z
 * addCalendarMonths({ from: new Date('2026-01-31T00:00:00Z'), months: 1, dayOverflow: 'overflow' });
 * // 2026-03-03T00:00:00.000Z
 *
 * // Every other case is the same under both rules:
 * addCalendarMonths({ from: new Date('2026-11-01T00:00:00Z'), months: 1, dayOverflow: 'clamp' });
 * // 2026-12-01T00:00:00.000Z — and 2026-12-02 under the local-time bug this replaces
 * ```
 */
export function addCalendarMonths({ from, months, dayOverflow }: AddCalendarMonthsInput): Date {
    if (Number.isNaN(from.getTime())) return new Date(Number.NaN);

    const year = from.getUTCFullYear();
    const monthIndex = from.getUTCMonth();
    const day = from.getUTCDate();
    const targetMonthIndex = monthIndex + months;

    // Day 0 of the month AFTER the target is the target's last day. Date.UTC
    // normalises a month index outside 0-11 into the right year on its own,
    // and that normalisation is unambiguous because there is no timezone in it.
    const lastDayOfTargetMonth = new Date(Date.UTC(year, targetMonthIndex + 1, 0)).getUTCDate();

    const targetDay = dayOverflow === 'clamp' ? Math.min(day, lastDayOfTargetMonth) : day;

    return new Date(
        Date.UTC(
            year,
            targetMonthIndex,
            targetDay,
            from.getUTCHours(),
            from.getUTCMinutes(),
            from.getUTCSeconds(),
            from.getUTCMilliseconds()
        )
    );
}

/** Input for {@link addCalendarYears}. */
export interface AddCalendarYearsInput {
    /** The instant to move. Not mutated. */
    readonly from: Date;
    /** Years to add. May be negative. */
    readonly years: number;
    /**
     * Which rule applies on the only day this can matter: 29 February moving to
     * a non-leap year.
     */
    readonly dayOverflow: DayOverflowRule;
}

/**
 * Adds calendar years to an instant, in UTC.
 *
 * A thin, honestly-named wrapper over {@link addCalendarMonths} — a year is
 * twelve calendar months, and routing through one implementation means the leap
 * day cannot be handled one way here and another way there.
 *
 * @param input - {@link AddCalendarYearsInput}.
 * @returns A new `Date`.
 *
 * @example
 * ```ts
 * addCalendarYears({ from: new Date('2028-02-29T00:00:00Z'), years: 1, dayOverflow: 'clamp' });
 * // 2029-02-28T00:00:00.000Z
 * ```
 */
export function addCalendarYears({ from, years, dayOverflow }: AddCalendarYearsInput): Date {
    return addCalendarMonths({ from, months: years * 12, dayOverflow });
}
